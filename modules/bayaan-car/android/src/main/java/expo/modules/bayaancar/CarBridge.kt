package expo.modules.bayaancar

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Handler
import android.os.Looper
import java.io.File

/**
 * Threading model: snapshot, nowPlaying, connection, jsReady, pending, emit,
 * owner and the listener lists are read and written on the main looper only.
 * Entry points called from other threads (the Expo module on the JS thread)
 * post to main. File IO and JSON parsing happen on the caller's thread.
 *
 * The emitter is owned by one module instance (owner token). A late
 * unregister from an old instance after a reload cannot clear the new
 * instance's emitter or ready flag.
 */
object CarBridge {
  private const val MAX_PENDING = 32
  private val main = Handler(Looper.getMainLooper())

  @Volatile private var file: File? = null

  var snapshot: CarSnapshot? = null
    private set
  var nowPlaying: CarNowPlaying? = null
    private set
  var isConnected = false
    private set

  val onSnapshotChanged = mutableListOf<() -> Unit>()
  val onNowPlayingChanged = mutableListOf<() -> Unit>()

  private var emit: ((String, Map<String, Any>) -> Unit)? = null
  private var owner: Any? = null
  private var jsReady = false
  private val pending = mutableListOf<Pair<String, Map<String, Any>>>()

  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
  }

  @Synchronized
  fun init(context: Context) {
    if (file != null) return
    CarLog.enabled = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    val f = File(context.filesDir, "bayaan-car/snapshot.json")
    file = f
    if (!f.exists()) return
    val parsed = runCatching { CarSnapshot.parse(f.readText()) }.getOrNull() ?: return
    onMain {
      // A snapshot written by JS in the meantime is newer; keep it.
      if (snapshot == null) {
        snapshot = parsed
        onSnapshotChanged.forEach { it() }
      }
    }
  }

  /** A new module instance (new JS runtime) takes over. Not ready until markJsReady. */
  fun registerEmitter(token: Any, emitter: (String, Map<String, Any>) -> Unit) = onMain {
    owner = token
    emit = emitter
    jsReady = false
  }

  /** Clears emitter state only if [token] still owns it. */
  fun unregisterEmitter(token: Any) = onMain {
    if (owner !== token) return@onMain
    owner = null
    emit = null
    jsReady = false
  }

  fun writeSnapshot(json: String) {
    val parsed = CarSnapshot.parse(json)
    if (parsed == null) {
      CarLog.d("snapshot parse failed or unsupported version")
      return
    }
    file?.let { f ->
      runCatching {
        f.parentFile?.mkdirs()
        val tmp = File(f.parentFile, "snapshot.json.tmp")
        tmp.writeText(json)
        if (!tmp.renameTo(f)) tmp.delete()
      }.onFailure { CarLog.d("snapshot write failed: $it") }
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

  fun markJsReady() {
    main.post {
      // Never flush into a missing emitter: keep events queued.
      val e = emit ?: return@post
      jsReady = true
      val queued = pending.toList()
      pending.clear()
      queued.forEach { (name, body) -> e(name, body) }
      e("onCarConnectionChanged", mapOf("connected" to isConnected))
    }
  }

  fun sendPlay(requestJson: String) = send("onPlayRequest", requestJson)
  fun sendTransport(transportJson: String) = send("onTransport", transportJson)

  fun setConnected(connected: Boolean) {
    main.post {
      isConnected = connected
      if (jsReady) emit?.invoke("onCarConnectionChanged", mapOf("connected" to connected))
    }
  }

  private fun send(event: String, json: String) {
    main.post {
      val body = mapOf<String, Any>("json" to json)
      val e = emit
      if (jsReady && e != null) {
        e(event, body)
        return@post
      }
      // A new play request supersedes everything queued before it.
      if (event == "onPlayRequest") pending.clear()
      pending.add(event to body)
      while (pending.size > MAX_PENDING) pending.removeAt(0)
    }
  }
}
