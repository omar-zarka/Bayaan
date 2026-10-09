package expo.modules.bayaanwidgets

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

object WidgetStorage {
  private const val PREFS = "bayaan_widgets"
  private const val KEY_SNAPSHOT = "snapshot"
  private const val KEY_QUEUE = "commandQueue"
  private const val KEY_TASBEEH = "pendingTasbeeh"
  private const val KEY_PLAYBACK_OVERRIDE = "widgets.playbackOverride"

  @Volatile var onCommandQueued: (() -> Unit)? = null

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun writeSnapshot(context: Context, json: String) =
    prefs(context).edit().putString(KEY_SNAPSHOT, json).apply()

  fun readSnapshotJson(context: Context): String? = prefs(context).getString(KEY_SNAPSHOT, null)

  fun readSnapshot(context: Context): WidgetSnapshot? =
    readSnapshotJson(context)?.let { SnapshotModels.decode(it) }

  fun writePlaybackOverride(context: Context, override: PlaybackOverride) {
    prefs(context).edit().putString(KEY_PLAYBACK_OVERRIDE, PlaybackState.encodeOverride(override)).commit()
  }

  fun readPlaybackOverrideJson(context: Context): String? =
    prefs(context).getString(KEY_PLAYBACK_OVERRIDE, null)

  @Synchronized
  fun enqueueCommand(context: Context, command: JSONObject) {
    val queue = JSONArray(prefs(context).getString(KEY_QUEUE, "[]"))
    queue.put(JSONObject().put("command", command).put("enqueuedAt", System.currentTimeMillis()))
    prefs(context).edit().putString(KEY_QUEUE, queue.toString()).commit()
    onCommandQueued?.invoke()
  }

  @Synchronized
  fun take(context: Context, key: String): String {
    val value = prefs(context).getString(key, "[]") ?: "[]"
    prefs(context).edit().remove(key).commit()
    return value
  }

  fun takeQueue(context: Context) = take(context, KEY_QUEUE)
  fun takeTasbeeh(context: Context) = take(context, KEY_TASBEEH)

  fun artworkDir(context: Context): File =
    File(context.filesDir, "widgets/artwork").apply { mkdirs() }
}
