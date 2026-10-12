import ExpoModulesCore
import UIKit
import WidgetKit

let commandQueuedNotification = Notification.Name("BayaanWidgetCommandQueued")

private func appGroupId() -> String? {
  Bundle.main.object(forInfoDictionaryKey: "BayaanAppGroup") as? String
}

private func widgetsDir() -> URL? {
  guard let id = appGroupId(),
        let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
  else { return nil }
  let dir = base.appendingPathComponent("widgets", isDirectory: true)
  try? FileManager.default.createDirectory(
    at: dir.appendingPathComponent("artwork"), withIntermediateDirectories: true)
  return dir
}

/// Same lock file as WidgetQueueLock in targets/widgets/_shared, so a take
/// cannot interleave with an enqueue and drop the appended command. flock
/// works across threads and processes, unlike an in-process NSLock.
private func withQueueLock<T>(_ body: () -> T) -> T {
  guard let dir = widgetsDir() else { return body() }
  let fd = open(dir.appendingPathComponent("queue.lock").path, O_CREAT | O_RDWR, 0o644)
  guard fd >= 0 else { return body() }
  defer { close(fd) }
  flock(fd, LOCK_EX)
  defer { flock(fd, LOCK_UN) }
  return body()
}

private func takeString(_ key: String) -> String {
  guard let id = appGroupId(), let defaults = UserDefaults(suiteName: id) else { return "[]" }
  return withQueueLock {
    let value = defaults.string(forKey: key) ?? "[]"
    defaults.removeObject(forKey: key)
    return value
  }
}

public class BayaanWidgetsModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("BayaanWidgets")
    Events("onCommandQueued")

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: commandQueuedNotification, object: nil, queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onCommandQueued", [:])
      }
    }

    OnStopObserving {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
      self.observer = nil
    }

    Function("writeSnapshot") { (json: String) in
      guard let dir = widgetsDir() else { return }
      try? json.data(using: .utf8)?.write(
        to: dir.appendingPathComponent("snapshot.json"), options: .atomic)
    }

    // ListeningAccessory reads the same snapshot slice as ContinueListening.
    Function("reloadWidgets") { (kinds: [String]) in
      for kind in kinds {
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
        if kind == "ContinueListening" {
          WidgetCenter.shared.reloadTimelines(ofKind: "ListeningAccessory")
        }
      }
    }

    Function("takeQueuedCommands") { () -> String in takeString("widgets.commandQueue") }
    Function("takePendingTasbeeh") { () -> String in takeString("widgets.pendingTasbeeh") }

    Function("writeCatalog") { (json: String) in
      guard let dir = widgetsDir() else { return }
      try? json.data(using: .utf8)?.write(
        to: dir.appendingPathComponent("catalog.json"), options: .atomic)
    }

    // Written by the widget extension (ArtworkRequestStore); read only, the
    // app skips files it already cached.
    Function("readArtworkRequests") { () -> String in
      guard let id = appGroupId(), let defaults = UserDefaults(suiteName: id) else { return "{}" }
      return defaults.string(forKey: "widgets.artworkRequests") ?? "{}"
    }

    Function("hasArtwork") { (fileName: String) -> Bool in
      guard let dir = widgetsDir() else { return false }
      return FileManager.default.fileExists(
        atPath: dir.appendingPathComponent("artwork/\(fileName)").path)
    }

    AsyncFunction("cacheArtwork") { (sourceUrl: String, fileName: String) async -> Bool in
      guard let dir = widgetsDir(), let url = URL(string: sourceUrl) else { return false }
      let data: Data
      if url.isFileURL {
        guard let d = try? Data(contentsOf: url) else { return false }
        data = d
      } else {
        guard let (d, _) = try? await URLSession.shared.data(from: url) else { return false }
        data = d
      }
      guard let image = UIImage(data: data) else { return false }
      let side: CGFloat = 300
      let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side))
      let resized = renderer.jpegData(withCompressionQuality: 0.85) { _ in
        let scale = max(side / image.size.width, side / image.size.height)
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        image.draw(in: CGRect(
          x: (side - size.width) / 2, y: (side - size.height) / 2,
          width: size.width, height: size.height))
      }
      do {
        try resized.write(to: dir.appendingPathComponent("artwork/\(fileName)"), options: .atomic)
        return true
      } catch {
        return false
      }
    }
  }
}
