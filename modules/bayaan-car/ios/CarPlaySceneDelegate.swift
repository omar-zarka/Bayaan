import CarPlay
import UIKit

@objc(CarPlaySceneDelegate)
public final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?

  public func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    BayaanCarSceneBridge.shared.ensureStarted()
    self.interfaceController = interfaceController
    CarBridge.shared.setConnected(true)
    let item = CPListItem(text: "Bayaan", detailText: "CarPlay is connected")
    let template = CPListTemplate(title: "Home", sections: [CPListSection(items: [item])])
    interfaceController.setRootTemplate(template, animated: false, completion: nil)
  }

  public func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
    CarBridge.shared.setConnected(false)
  }
}
