import UIKit

/// Starts React Native exactly once, into a host window that either the phone
/// scene adopts or that stays offscreen while only CarPlay is connected.
@objc public final class BayaanCarSceneBridge: NSObject {
  @objc public static let shared = BayaanCarSceneBridge()

  private var start: ((UIWindow, [UIApplication.LaunchOptionsKey: Any]) -> Void)?
  private var onWindow: ((UIWindow) -> Void)?
  public private(set) var hostWindow: UIWindow?
  private var layoutTimer: Timer?

  public func configure(
    start: @escaping (UIWindow, [UIApplication.LaunchOptionsKey: Any]) -> Void,
    onWindow: @escaping (UIWindow) -> Void
  ) {
    self.start = start
    self.onWindow = onWindow
  }

  @discardableResult
  public func ensureStarted(
    extraLaunchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
  ) -> UIWindow {
    if let window = hostWindow { return window }
    let window = UIWindow(frame: UIScreen.main.bounds)
    hostWindow = window
    onWindow?(window)
    start?(window, extraLaunchOptions)
    startOffscreenLayout(window)
    return window
  }

  /// UIKit never lays out a window that has no scene, and React Native's safe
  /// area provider renders nothing until a layout pass reports insets. Without
  /// this, a CarPlay-first launch (phone locked, app not running) evaluates JS
  /// but never mounts the React tree, so there is no player and no car bridge.
  /// Lay the host window out ourselves until a phone scene adopts it.
  private func startOffscreenLayout(_ window: UIWindow) {
    guard window.windowScene == nil else { return }
    layoutTimer?.invalidate()
    layoutTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self, weak window] timer in
      guard let window, window.windowScene == nil else {
        timer.invalidate()
        self?.layoutTimer = nil
        return
      }
      window.layoutIfNeeded()
    }
  }
}
