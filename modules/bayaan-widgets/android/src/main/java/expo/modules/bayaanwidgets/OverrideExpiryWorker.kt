package expo.modules.bayaanwidgets

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import expo.modules.bayaanwidgets.continuelistening.ContinueListeningWidget
import java.util.concurrent.TimeUnit

/** Re-renders the widget once a playback override has expired. */
class OverrideExpiryWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    runCatching { ContinueListeningWidget.pushState(applicationContext) }
    return Result.success()
  }

  companion object {
    private const val NAME = "bayaan-widgets-override-expiry"

    /** Replaces any pending run, so only the latest tap's expiry fires. */
    fun schedule(context: Context) {
      val request = OneTimeWorkRequestBuilder<OverrideExpiryWorker>()
        .setInitialDelay(PlaybackState.OVERRIDE_TTL_MS + 1_000, TimeUnit.MILLISECONDS)
        .build()
      WorkManager.getInstance(context).enqueueUniqueWork(NAME, ExistingWorkPolicy.REPLACE, request)
    }
  }
}
