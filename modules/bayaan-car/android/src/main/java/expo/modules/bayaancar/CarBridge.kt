package expo.modules.bayaancar

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.io.File

/**
 * Threading model: snapshot, nowPlaying, connection, jsReady, pending, emit and
 * the listener lists are read and written on the main looper only. Entry points
 * called from other threads (the Expo module on the JS thread) post to main.
 * File IO and JSON parsing happen on the caller's thread.
 */
object CarBridge {
  private val main = Handler(Looper.getMainLooper())
  @Volatile private var file: File? = null

  var snapshot: CarSnapshot? = null
    private set
  var nowPlaying: CarNowPlaying? = null
    private set
  var isConnected = false
    private set

  var emit: ((String, Map<String, Any>) -> Unit)? = null
  val onSnapshotChanged = mutableListOf<() -> Unit>()
  val onNowPlayingChanged = mutableListOf<() -> Unit>()

  private var jsReady = false
  private val pending = mutableListOf<Pair<String, Map<String, Any>>>()

  @Synchronized
  fun init(context: Context) {
    if (file != null) return
    val f = File(context.filesDir, "bayaan-car/snapshot.json")
    file = f
    if (f.exists()) snapshot = runCatching { CarSnapshot.parse(f.readText()) }.getOrNull()
  }

  /** Called when the JS runtime goes away; later requests queue until markJsReady. */
  fun resetJsReady() = main.post {
    jsReady = false
    emit = null
  }

  fun writeSnapshot(json: String) {
    val parsed = CarSnapshot.parse(json) ?: return
    file?.let { f ->
      runCatching {
        f.parentFile?.mkdirs()
        val tmp = File(f.parentFile, "snapshot.json.tmp")
        tmp.writeText(json)
        if (!tmp.renameTo(f)) tmp.delete()
      }
    }
    main.post {
      snapshot = parsed
      onSnapshotChanged.forEach { it() }
    }
  }

  fun setNowPlaying(json: String?) {
    val parsed = json?.let { CarNowPlaying.parse(it) }
    main.post {
      nowPlaying = parsed
      onNowPlayingChanged.forEach { it() }
    }
  }

  fun markJsReady() = main.post {
    jsReady = true
    val queued = pending.toList()
    pending.clear()
    queued.forEach { (name, body) -> emit?.invoke(name, body) }
    emit?.invoke("onCarConnectionChanged", mapOf("connected" to isConnected))
  }

  fun sendPlay(requestJson: String) = send("onPlayRequest", requestJson)
  fun sendTransport(transportJson: String) = send("onTransport", transportJson)

  fun setConnected(connected: Boolean) = main.post {
    isConnected = connected
    if (jsReady) emit?.invoke("onCarConnectionChanged", mapOf("connected" to connected))
  }

  private fun send(event: String, json: String) = main.post {
    val body = mapOf<String, Any>("json" to json)
    val e = emit
    if (jsReady && e != null) {
      e(event, body)
      return@post
    }
    if (event == "onPlayRequest") pending.removeAll { it.first == "onPlayRequest" }
    pending.add(event to body)
  }
}
