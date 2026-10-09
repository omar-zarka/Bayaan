package expo.modules.bayaancar

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BayaanCarModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BayaanCar")
    Events("onPlayRequest", "onTransport", "onCarConnectionChanged")

    OnCreate {
      appContext.reactContext?.applicationContext?.let { CarBridge.init(it) }
      CarBridge.emit = { name, body -> sendEvent(name, body) }
    }

    OnDestroy {
      CarBridge.resetJsReady()
    }

    Function("writeSnapshot") { json: String -> CarBridge.writeSnapshot(json) }
    Function("setNowPlaying") { json: String? -> CarBridge.setNowPlaying(json) }
    Function("markJsReady") { CarBridge.markJsReady() }
  }
}
