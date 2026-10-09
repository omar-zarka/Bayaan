package expo.modules.bayaancar

import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.common.util.UnstableApi
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject

/**
 * Mirrors expo-audio's state (pushed from JS) and forwards every command to
 * JS. It never plays audio itself.
 */
@UnstableApi
class CarForwardingPlayer(looper: Looper) : SimpleBasePlayer(looper) {
  private val listener: () -> Unit = { invalidateState() }

  /**
   * A controller that starts a media item sends setMediaItems, prepare, then
   * play. The play request already starts playback in JS, so a play command
   * arriving right after one would only resume the previous item for a moment.
   */
  private var ignorePlayUntilMs = 0L

  init {
    CarBridge.onNowPlayingChanged.add(listener)
  }

  fun detach() {
    CarBridge.onNowPlayingChanged.remove(listener)
  }

  fun notePlayRequestSent() {
    ignorePlayUntilMs = SystemClock.elapsedRealtime() + PLAY_SUPPRESS_MS
  }

  override fun getState(): State {
    val np = CarBridge.nowPlaying
    val commands = Player.Commands.Builder().addAll(
      Player.COMMAND_PLAY_PAUSE,
      Player.COMMAND_PREPARE,
      Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
      Player.COMMAND_SEEK_TO_NEXT,
      Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
      Player.COMMAND_SEEK_TO_PREVIOUS,
      Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
      Player.COMMAND_SEEK_TO_MEDIA_ITEM,
      Player.COMMAND_SET_SPEED_AND_PITCH,
      Player.COMMAND_SET_REPEAT_MODE,
      Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
      Player.COMMAND_GET_TIMELINE,
      Player.COMMAND_GET_METADATA,
      Player.COMMAND_SET_MEDIA_ITEM,
    ).build()
    if (np == null || np.queue.isEmpty()) {
      return State.Builder().setAvailableCommands(commands).setPlaybackState(Player.STATE_IDLE).build()
    }
    val playlist = np.queue.mapIndexed { index, entry ->
      val metadata = MediaMetadata.Builder()
        .setTitle(entry.title)
        .setArtist(entry.subtitle)
        .setIsPlayable(true)
        .setIsBrowsable(false)
        .apply { entry.surahId?.let { setArtworkUri(CarArtworkProvider.uriFor(CarArtwork.Surah(it))) } }
        .build()
      val item = MediaItem.Builder().setMediaId("queue:$index").setMediaMetadata(metadata).build()
      val builder = MediaItemData.Builder("queue:$index").setMediaItem(item)
      if (index == np.currentIndex && np.durationSec > 0) builder.setDurationUs((np.durationSec * 1_000_000).toLong())
      builder.build()
    }
    val positionMs = (np.positionSec * 1000).toLong()
    // getState() can run later than the JS push, so advance by the time since.
    val nowMs = SystemClock.elapsedRealtime()
    val livePositionMs = if (np.isPlaying) positionMs + ((nowMs - np.receivedAtMs) * np.rate).toLong() else positionMs
    return State.Builder()
      .setAvailableCommands(commands)
      .setPlaylist(playlist)
      .setCurrentMediaItemIndex(np.currentIndex.coerceIn(0, playlist.size - 1))
      .setPlaybackState(Player.STATE_READY)
      .setPlayWhenReady(np.isPlaying, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
      .setPlaybackParameters(PlaybackParameters(np.rate.toFloat()))
      .setRepeatMode(
        when (np.repeatMode) {
          "track" -> Player.REPEAT_MODE_ONE
          "queue" -> Player.REPEAT_MODE_ALL
          else -> Player.REPEAT_MODE_OFF
        },
      )
      .setContentPositionMs(
        if (np.isPlaying) PositionSupplier.getExtrapolating(livePositionMs, np.rate.toFloat())
        else PositionSupplier.getConstant(positionMs),
      )
      .build()
  }

  private fun transport(kind: String, extra: (JSONObject) -> Unit = {}): ListenableFuture<*> {
    val o = JSONObject().put("kind", kind)
    extra(o)
    CarBridge.sendTransport(o.toString())
    return Futures.immediateVoidFuture()
  }

  override fun handleSetPlayWhenReady(playWhenReady: Boolean): ListenableFuture<*> {
    if (playWhenReady && SystemClock.elapsedRealtime() < ignorePlayUntilMs) return Futures.immediateVoidFuture()
    return transport(if (playWhenReady) "play" else "pause")
  }

  // The real queue comes from JS; media items set by a controller are handled in the session callback.
  override fun handleSetMediaItems(mediaItems: List<MediaItem>, startIndex: Int, startPositionMs: Long): ListenableFuture<*> =
    Futures.immediateVoidFuture()

  override fun handlePrepare(): ListenableFuture<*> = Futures.immediateVoidFuture()

  override fun handleSeek(mediaItemIndex: Int, positionMs: Long, seekCommand: Int): ListenableFuture<*> = when (seekCommand) {
    Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM -> transport("next")
    Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> transport("previous")
    Player.COMMAND_SEEK_TO_MEDIA_ITEM -> transport("jumpTo") { it.put("index", mediaItemIndex) }
    else -> transport("seek") { it.put("position", positionMs / 1000.0) }
  }

  override fun handleSetPlaybackParameters(playbackParameters: PlaybackParameters): ListenableFuture<*> =
    transport("rate") { it.put("value", playbackParameters.speed.toDouble()) }

  // parse.ts has no explicit repeat mode, so the request cycles JS's own mode.
  override fun handleSetRepeatMode(repeatMode: Int): ListenableFuture<*> = transport("cycleRepeat")

  private companion object {
    const val PLAY_SUPPRESS_MS = 2000L
  }
}
