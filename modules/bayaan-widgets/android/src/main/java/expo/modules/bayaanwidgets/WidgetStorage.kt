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

  @Volatile var onCommandQueued: (() -> Unit)? = null

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun writeSnapshot(context: Context, json: String) =
    prefs(context).edit().putString(KEY_SNAPSHOT, json).apply()

  fun readSnapshot(context: Context): WidgetSnapshot? =
    prefs(context).getString(KEY_SNAPSHOT, null)?.let { SnapshotModels.decode(it) }

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
