package expo.modules.bayaanwidgets

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import expo.modules.bayaanwidgets.continuelistening.ContinueListeningWidget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class CommandReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val raw = intent.getStringExtra(EXTRA_COMMAND) ?: return
    val command = try { JSONObject(raw) } catch (e: Exception) { return }
    val pending = goAsync()
    try {
      // MediaController must be used on the main looper.
      CoroutineScope(SupervisorJob() + Dispatchers.Main).launch {
        try {
          handle(context, command)
        } catch (e: Exception) {
          // nothing else to do; the widget re-renders on the next snapshot
        } finally {
          pending.finish()
        }
      }
    } catch (e: Exception) {
      pending.finish()
    }
  }

  private suspend fun handle(context: Context, command: JSONObject) {
    if (command.optString("type") != "setPlayback") {
      queueAndLaunch(context, command)
      return
    }
    val playing = command.optBoolean("playing")
    // Optimistic render before anything slow. Prefs commits stay off main.
    withContext(Dispatchers.IO) {
      WidgetStorage.writePlaybackOverride(context, PlaybackOverride(playing, System.currentTimeMillis()))
    }
    runCatching { ContinueListeningWidget.pushState(context) }
    runCatching { OverrideExpiryWorker.schedule(context) }
    // JS is not listening; try the live media session directly.
    if (WidgetStorage.onCommandQueued == null && controlSession(context, playing)) return
    queueAndLaunch(context, command)
  }

  /** Returns true when a live session with a loaded item took the command. */
  private suspend fun controlSession(context: Context, playing: Boolean): Boolean {
    var controller: MediaController? = null
    try {
      val token = SessionToken(context, ComponentName(context, AUDIO_SERVICE))
      val future = MediaController.Builder(context, token).buildAsync()
      controller = withTimeoutOrNull(CONTROLLER_TIMEOUT_MS) { future.await() }
      if (controller == null) {
        // Timed out; if it connects anyway, release it then.
        future.addListener({ runCatching { future.get().release() } }, MoreExecutors.directExecutor())
        return false
      }
      if (controller.currentMediaItem == null) return false
      if (playing) controller.play() else controller.pause()
      return true
    } catch (e: Exception) {
      return false // fall through to queue + launch
    } finally {
      controller?.let { runCatching { it.release() } }
    }
  }

  private suspend fun <T> ListenableFuture<T>.await(): T = suspendCancellableCoroutine { cont ->
    addListener({
      try {
        cont.resume(get())
      } catch (e: Exception) {
        cont.resumeWithException(e)
      }
    }, MoreExecutors.directExecutor())
    cont.invokeOnCancellation { cancel(false) }
  }

  private suspend fun queueAndLaunch(context: Context, command: JSONObject) {
    withContext(Dispatchers.IO) { WidgetStorage.enqueueCommand(context, command) }
    if (WidgetStorage.onCommandQueued != null) return // JS alive, it will drain
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { context.startActivity(it) }
    }
  }

  companion object {
    const val EXTRA_COMMAND = "command"
    private const val AUDIO_SERVICE = "expo.modules.audio.service.AudioControlsService"
    private const val CONTROLLER_TIMEOUT_MS = 3_000L

    fun intent(context: Context, command: JSONObject): Intent =
      Intent(context, CommandReceiver::class.java).putExtra(EXTRA_COMMAND, command.toString())

    fun pendingIntent(context: Context, command: JSONObject, requestCode: Int): PendingIntent =
      PendingIntent.getBroadcast(
        context, requestCode, intent(context, command),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
  }
}
