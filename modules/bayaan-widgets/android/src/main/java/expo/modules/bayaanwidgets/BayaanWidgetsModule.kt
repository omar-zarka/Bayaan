package expo.modules.bayaanwidgets

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BayaanWidgetsModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  override fun definition() = ModuleDefinition {
    Name("BayaanWidgets")
    Events("onCommandQueued")

    OnStartObserving { WidgetStorage.onCommandQueued = { sendEvent("onCommandQueued", emptyMap<String, Any>()) } }
    OnStopObserving { WidgetStorage.onCommandQueued = null }

    Function("writeSnapshot") { json: String -> WidgetStorage.writeSnapshot(context, json) }

    Function("reloadWidgets") { kinds: List<String> ->
      for (kind in kinds) {
        when (kind) {
          else -> Unit // widget kinds register here as they are added
        }
      }
    }

    Function("takeQueuedCommands") { WidgetStorage.takeQueue(context) }
    Function("takePendingTasbeeh") { WidgetStorage.takeTasbeeh(context) }

    Function("hasArtwork") { fileName: String ->
      java.io.File(WidgetStorage.artworkDir(context), fileName).exists()
    }

    AsyncFunction("cacheArtwork") { sourceUrl: String, fileName: String ->
      ArtworkStore.cache(context, sourceUrl, fileName)
    }
  }
}
