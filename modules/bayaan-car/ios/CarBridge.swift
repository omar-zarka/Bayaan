import Foundation

/// Threading model: all mutable state (snapshot, nowPlaying, connection, the
/// pending queue, jsReady, emit) is read and written on the main queue only.
/// Entry points called from other threads (the Expo module on the JS thread)
/// hop to main first. Disk IO and JSON decoding happen on the caller's thread.
final class CarBridge {
  static let shared = CarBridge()
  static let snapshotDidChange = Notification.Name("BayaanCarSnapshotDidChange")
  static let nowPlayingDidChange = Notification.Name("BayaanCarNowPlayingDidChange")

  private(set) var snapshot: CarSnapshot?
  private(set) var nowPlaying: CarNowPlaying?
  private(set) var isConnected = false

  /// Set by BayaanCarModule. Only invoked once JS has called markJsReady.
  var emit: ((String, [String: Any]) -> Void)?
  private var jsReady = false
  private var pending: [(String, [String: Any])] = []

  private var snapshotURL: URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return base.appendingPathComponent("bayaan-car/snapshot.json")
  }

  private init() {
    loadSnapshotFromDisk()
  }

  private func onMain(_ work: @escaping () -> Void) {
    if Thread.isMainThread {
      work()
    } else {
      DispatchQueue.main.async(execute: work)
    }
  }

  func writeSnapshot(json: String) {
    guard let data = json.data(using: .utf8),
          let decoded = try? JSONDecoder().decode(CarSnapshot.self, from: data),
          decoded.version == 1 else { return }
    let url = snapshotURL
    try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try? data.write(to: url, options: .atomic)
    onMain {
      self.snapshot = decoded
      NotificationCenter.default.post(name: CarBridge.snapshotDidChange, object: nil)
    }
  }

  func setNowPlaying(json: String?) {
    let decoded = json.flatMap { $0.data(using: .utf8) }.flatMap { try? JSONDecoder().decode(CarNowPlaying.self, from: $0) }
    onMain {
      self.nowPlaying = decoded
      NotificationCenter.default.post(name: CarBridge.nowPlayingDidChange, object: nil)
    }
  }

  func markJsReady() {
    onMain {
      self.jsReady = true
      let queued = self.pending
      self.pending.removeAll()
      queued.forEach { self.emit?($0.0, $0.1) }
      self.emit?("onCarConnectionChanged", ["connected": self.isConnected])
    }
  }

  /// Called when the JS runtime goes away (dev reload). Later requests queue
  /// until the new runtime calls markJsReady again.
  func resetJsReady() {
    onMain {
      self.jsReady = false
    }
  }

  func send(play request: [String: Any]) {
    send(event: "onPlayRequest", payload: request)
  }

  func send(transport: [String: Any]) {
    send(event: "onTransport", payload: transport)
  }

  func setConnected(_ connected: Bool) {
    onMain {
      self.isConnected = connected
      guard self.jsReady else { return }
      self.emit?("onCarConnectionChanged", ["connected": connected])
    }
  }

  private func send(event: String, payload: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(payload),
          let data = try? JSONSerialization.data(withJSONObject: payload),
          let json = String(data: data, encoding: .utf8) else { return }
    onMain {
      let body: [String: Any] = ["json": json]
      if self.jsReady, let emit = self.emit {
        emit(event, body)
        return
      }
      // Only the latest play request matters; transports queue in order.
      if event == "onPlayRequest" { self.pending.removeAll { $0.0 == "onPlayRequest" } }
      self.pending.append((event, body))
    }
  }

  private func loadSnapshotFromDisk() {
    guard let data = try? Data(contentsOf: snapshotURL),
          let decoded = try? JSONDecoder().decode(CarSnapshot.self, from: data),
          decoded.version == 1 else { return }
    snapshot = decoded
  }
}
