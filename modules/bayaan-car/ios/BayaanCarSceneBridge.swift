import UIKit

/// Starts React Native exactly once, into a host window that either the phone
/// scene adopts or that stays offscreen while only CarPlay is connected.
@objc public final class BayaanCarSceneBridge: NSObject {
  @objc public static let shared = BayaanCarSceneBridge()

  private var start: ((UIWindow, [UIApplication.LaunchOptionsKey: Any]) -> Void)?
  private var onWindow: ((UIWindow) -> Void)?
  public private(set) var hostWindow: UIWindow?

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
    return window
  }
}
