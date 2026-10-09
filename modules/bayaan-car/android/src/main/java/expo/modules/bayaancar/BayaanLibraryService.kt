package expo.modules.bayaancar

import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import com.facebook.react.ReactApplication
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

class BayaanLibraryService : MediaLibraryService() {
  private var session: MediaLibrarySession? = null

  override fun onCreate() {
    super.onCreate()
    val player = object : SimpleBasePlayer(mainLooper) {
      override fun getState(): State = State.Builder()
        .setAvailableCommands(Player.Commands.Builder().add(Player.COMMAND_PLAY_PAUSE).build())
        .build()
    }
    session = MediaLibrarySession.Builder(this, player, HelloCallback())
      .setId("bayaan-car")
      .build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? = session

  // expo-audio's AudioControlsService owns the phone notification and the
  // foreground state. Ours must never post a second notification.
  override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) = Unit

  override fun onDestroy() {
    session?.run { player.release(); release() }
    session = null
    super.onDestroy()
  }

  private inner class HelloCallback : MediaLibrarySession.Callback {
    override fun onGetLibraryRoot(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<MediaItem>> {
      val root = MediaItem.Builder().setMediaId("root").setMediaMetadata(
        MediaMetadata.Builder().setIsBrowsable(true).setIsPlayable(false).build(),
      ).build()
      return Futures.immediateFuture(LibraryResult.ofItem(root, params))
    }

    override fun onGetChildren(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      parentId: String,
      page: Int,
      pageSize: Int,
      params: LibraryParams?,
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
      // Boot JS headlessly the first time the car browses.
      (application as? ReactApplication)?.reactHost?.start()
      val item = MediaItem.Builder().setMediaId("hello").setMediaMetadata(
        MediaMetadata.Builder().setTitle("Bayaan is connected").setIsBrowsable(false).setIsPlayable(true).build(),
      ).build()
      return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.of(item), params))
    }
  }
}
