import UIKit

@objc(PhoneSceneDelegate)
public final class PhoneSceneDelegate: UIResponder, UIWindowSceneDelegate {
  public var window: UIWindow?

  public func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    var extra: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      extra[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      extra[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType: activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    NSLog("[DBGCAR] willConnect urls=%@ extra=%@", connectionOptions.urlContexts.map { $0.url.absoluteString }, String(describing: extra))
    let bridge = BayaanCarSceneBridge.shared
    let hostWindow = bridge.ensureStarted(extraLaunchOptions: extra)
    hostWindow.windowScene = windowScene
    hostWindow.frame = windowScene.coordinateSpace.bounds
    hostWindow.makeKeyAndVisible()
    window = hostWindow

    // Scene-based launches never reach the app delegate's open/continue
    // callbacks, which expo-linking relies on for its initial URL. Mirror what
    // UIKit does for app-delegate launches. When React already booted from
    // CarPlay, launch options were consumed, so this also delivers the live event.
    if let url = connectionOptions.urlContexts.first?.url {
      forward(url: url)
    }
    if let activity = connectionOptions.userActivities.first {
      forward(activity: activity)
    }
  }

  public func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      forward(url: context.url, sourceApplication: context.options.sourceApplication)
    }
  }

  public func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    forward(activity: userActivity)
  }

  private func forward(url: URL, sourceApplication: String? = nil) {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    if let sourceApplication { options[.sourceApplication] = sourceApplication }
    _ = UIApplication.shared.delegate?.application?(UIApplication.shared, open: url, options: options)
  }

  private func forward(activity: NSUserActivity) {
    _ = UIApplication.shared.delegate?.application?(
      UIApplication.shared, continue: activity, restorationHandler: { _ in })
  }
}
