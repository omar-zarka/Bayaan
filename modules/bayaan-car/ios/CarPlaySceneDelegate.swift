import CarPlay
import UIKit

@objc(CarPlaySceneDelegate)
public final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?
  private var builder: CarTemplateBuilder?
  private var nowPlaying: CarNowPlayingController?
  private var observers: [NSObjectProtocol] = []

  public func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    BayaanCarSceneBridge.shared.ensureStarted()
    self.interfaceController = interfaceController
    let builder = CarTemplateBuilder(interfaceController: interfaceController) { [weak interfaceController] in
      interfaceController?.carTraitCollection.userInterfaceStyle ?? .dark
    }
    self.builder = builder
    nowPlaying = CarNowPlayingController(interfaceController: interfaceController)
    let tabBar = CPTabBarTemplate(templates: builder.tabTemplates())
    interfaceController.setRootTemplate(tabBar, animated: false, completion: nil)
    observers.append(
      NotificationCenter.default.addObserver(forName: CarBridge.snapshotDidChange, object: nil, queue: .main) {
        [weak self] _ in
        self?.builder?.refresh()
      })
    CarBridge.shared.setConnected(true)
  }

  public func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    observers.forEach(NotificationCenter.default.removeObserver)
    observers.removeAll()
    nowPlaying?.tearDown()
    nowPlaying = nil
    builder = nil
    self.interfaceController = nil
    CarBridge.shared.setConnected(false)
  }
}
