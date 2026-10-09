import CryptoKit
import UIKit

/// Threading: `image(for:...)` is called on main. Memory lookups are
/// synchronous. Disk reads, network and downscaling run on a utility queue;
/// completions are delivered on main after the memory cache is populated.
/// All in-flight and failure bookkeeping is guarded by `lock`.
final class CarArtworkCache {
  static let shared = CarArtworkCache()

  private static let pixels: CGFloat = 256
  private static let renderScale: CGFloat = 2
  private static let retryAfter: TimeInterval = 60

  private let memory = NSCache<NSString, UIImage>()
  private let dir: URL
  private let session: URLSession
  private let work = DispatchQueue(label: "bayaan.car.artwork", qos: .utility, attributes: .concurrent)
  private let lock = NSLock()
  private var inFlight: [String: [(UIImage) -> Void]] = [:]
  private var failedAt: [String: Date] = [:]
  private let surahBase = "https://cdn.thebayaan.com/assets/og-images/surah/"

  private init() {
    let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    dir = base.appendingPathComponent("bayaan-car/artwork", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let config = URLSessionConfiguration.default
    config.timeoutIntervalForRequest = 15
    config.requestCachePolicy = .reloadIgnoringLocalCacheData
    session = URLSession(configuration: config)
    memory.countLimit = 300
    memory.totalCostLimit = 48 * 1024 * 1024
  }

  /// Returns something drawable immediately. `completion` fires on main with
  /// the real image only when it was not already available synchronously.
  func image(
    for artwork: CarArtwork,
    size: CGFloat = 128,
    style: UIUserInterfaceStyle,
    completion: @escaping (UIImage) -> Void
  ) -> UIImage {
    switch artwork {
    case .monogram(let label, let hex), .color(let label, let hex):
      return tile(label: label, hex: hex, size: size)
    case .surah(let id):
      let suffix = style == .light ? "-light" : ""
      return remote(
        key: "surah-\(id)\(suffix)",
        url: URL(string: "\(surahBase)\(id)\(suffix).png"),
        size: size,
        placeholder: tile(label: "\(id)", hex: "#1F2937", size: size),
        completion: completion)
    case .url(let string):
      return remote(
        key: "url-\(Self.digest(string))", url: URL(string: string), size: size,
        placeholder: tile(label: "", hex: "#374151", size: size), completion: completion)
    case .asset(let uri):
      if uri.hasPrefix("http") {
        return remote(
          key: "asset-\(Self.digest(uri))", url: URL(string: uri), size: size,
          placeholder: tile(label: "", hex: "#374151", size: size), completion: completion)
      }
      return localAsset(uri: uri, size: size, completion: completion)
    }
  }

  // MARK: Remote

  private func remote(
    key: String, url: URL?, size: CGFloat, placeholder: UIImage, completion: @escaping (UIImage) -> Void
  ) -> UIImage {
    let cacheKey = "\(key)@\(Int(size))" as NSString
    if let hit = memory.object(forKey: cacheKey) { return hit }
    guard let url else { return placeholder }

    lock.lock()
    if let failed = failedAt[key], Date().timeIntervalSince(failed) < Self.retryAfter {
      lock.unlock()
      return placeholder
    }
    if inFlight[cacheKey as String] != nil {
      inFlight[cacheKey as String]?.append(completion)
      lock.unlock()
      return placeholder
    }
    inFlight[cacheKey as String] = [completion]
    lock.unlock()

    let file = dir.appendingPathComponent("\(key).png")
    work.async { [weak self] in
      guard let self else { return }
      if let data = try? Data(contentsOf: file), let cached = UIImage(data: data) {
        self.finish(key: key, cacheKey: cacheKey, image: self.downscale(cached, size: size))
        return
      }
      self.session.dataTask(with: url) { [weak self] data, response, _ in
        guard let self else { return }
        let ok = (response as? HTTPURLResponse)?.statusCode == 200
        guard ok, let data, let full = UIImage(data: data) else {
          self.fail(key: key, cacheKey: cacheKey)
          return
        }
        let small = self.downscale(full, size: Self.pixels / Self.renderScale)
        if let png = small.pngData() { try? png.write(to: file, options: .atomic) }
        self.finish(key: key, cacheKey: cacheKey, image: self.downscale(small, size: size))
      }.resume()
    }
    return placeholder
  }

  private func finish(key: String, cacheKey: NSString, image: UIImage) {
    memory.setObject(image, forKey: cacheKey, cost: Int(image.size.width * image.size.height * 4 * Self.renderScale * Self.renderScale))
    lock.lock()
    let waiting = inFlight.removeValue(forKey: cacheKey as String) ?? []
    failedAt.removeValue(forKey: key)
    lock.unlock()
    DispatchQueue.main.async { waiting.forEach { $0(image) } }
  }

  private func fail(key: String, cacheKey: NSString) {
    lock.lock()
    inFlight.removeValue(forKey: cacheKey as String)
    failedAt[key] = Date()
    lock.unlock()
  }

  // MARK: Local assets

  private func localAsset(uri: String, size: CGFloat, completion: @escaping (UIImage) -> Void) -> UIImage {
    let placeholder = tile(label: "", hex: "#374151", size: size)
    let cacheKey = "local-\(Self.digest(uri))@\(Int(size))" as NSString
    if let hit = memory.object(forKey: cacheKey) { return hit }
    let path = uri.hasPrefix("file://") ? (URL(string: uri)?.path ?? String(uri.dropFirst(7))) : uri
    work.async { [weak self] in
      guard let self, let image = UIImage(contentsOfFile: path) else { return }
      let small = self.downscale(image, size: size)
      self.memory.setObject(small, forKey: cacheKey)
      DispatchQueue.main.async { completion(small) }
    }
    return placeholder
  }

  // MARK: Drawing

  /// Aspect-fill into a square so wide source art is not stretched.
  private func downscale(_ image: UIImage, size: CGFloat) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.scale = Self.renderScale
    format.opaque = false
    let target = CGSize(width: size, height: size)
    let source = image.size
    guard source.width > 0, source.height > 0 else { return image }
    let factor = max(target.width / source.width, target.height / source.height)
    let drawn = CGSize(width: source.width * factor, height: source.height * factor)
    let origin = CGPoint(x: (target.width - drawn.width) / 2, y: (target.height - drawn.height) / 2)
    return UIGraphicsImageRenderer(size: target, format: format).image { _ in
      image.draw(in: CGRect(origin: origin, size: drawn))
    }
  }

  private func tile(label: String, hex: String, size: CGFloat) -> UIImage {
    let key = "tile-\(label)-\(hex)@\(Int(size))" as NSString
    if let hit = memory.object(forKey: key) { return hit }
    let format = UIGraphicsImageRendererFormat()
    format.scale = Self.renderScale
    format.opaque = true
    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    let image = UIGraphicsImageRenderer(size: rect.size, format: format).image { ctx in
      UIColor(hex: hex).setFill()
      ctx.fill(rect)
      let text = String(label.prefix(3))
      if text.isEmpty {
        // No label: draw a quiet symbol instead of a blank tile.
        let config = UIImage.SymbolConfiguration(pointSize: size * 0.4, weight: .regular)
        if let symbol = UIImage(systemName: "book.closed.fill", withConfiguration: config)?
          .withTintColor(UIColor.white.withAlphaComponent(0.6), renderingMode: .alwaysOriginal)
        {
          symbol.draw(at: CGPoint(x: (size - symbol.size.width) / 2, y: (size - symbol.size.height) / 2))
        }
        return
      }
      let attrs: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: size * 0.3, weight: .semibold),
        .foregroundColor: UIColor.white,
      ]
      let textSize = (text as NSString).size(withAttributes: attrs)
      (text as NSString).draw(
        at: CGPoint(x: (size - textSize.width) / 2, y: (size - textSize.height) / 2), withAttributes: attrs)
    }
    memory.setObject(image, forKey: key)
    return image
  }

  private static func digest(_ string: String) -> String {
    SHA256.hash(data: Data(string.utf8)).prefix(12).map { String(format: "%02x", $0) }.joined()
  }
}

extension UIColor {
  convenience init(hex: String) {
    let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var value: UInt64 = 0
    Scanner(string: cleaned).scanHexInt64(&value)
    self.init(
      red: CGFloat((value >> 16) & 0xFF) / 255,
      green: CGFloat((value >> 8) & 0xFF) / 255,
      blue: CGFloat(value & 0xFF) / 255,
      alpha: 1)
  }
}
