package expo.modules.bayaanwidgets

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import org.json.JSONObject

class CommandReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val raw = intent.getStringExtra(EXTRA_COMMAND) ?: return
    val command = try { JSONObject(raw) } catch (e: Exception) { return }
    val pending = goAsync()

    if (command.optString("type") == "togglePlayback" && WidgetStorage.onCommandQueued == null) {
      // JS is not listening; try the live media session directly.
      val token = SessionToken(context, ComponentName(context, AUDIO_SERVICE))
      val future = MediaController.Builder(context, token).buildAsync()
      future.addListener({
        try {
          val controller = future.get()
          if (controller.currentMediaItem != null) {
            if (controller.isPlaying) controller.pause() else controller.play()
            controller.release()
            pending.finish()
            return@addListener
          }
          controller.release()
        } catch (e: Exception) { /* fall through to queue + launch */ }
        queueAndLaunch(context, command)
        pending.finish()
      }, MoreExecutors.directExecutor())
      return
    }

    queueAndLaunch(context, command)
    pending.finish()
  }

  private fun queueAndLaunch(context: Context, command: JSONObject) {
    WidgetStorage.enqueueCommand(context, command)
    if (WidgetStorage.onCommandQueued != null) return // JS alive, it will drain
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(it)
    }
  }

  companion object {
    const val EXTRA_COMMAND = "command"
    private const val AUDIO_SERVICE = "expo.modules.audio.service.AudioControlsService"

    fun intent(context: Context, command: JSONObject): Intent =
      Intent(context, CommandReceiver::class.java).putExtra(EXTRA_COMMAND, command.toString())

    fun pendingIntent(context: Context, command: JSONObject, requestCode: Int): PendingIntent =
      PendingIntent.getBroadcast(
        context, requestCode, intent(context, command),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
  }
}
