package expo.modules.bayaanwidgets.continuelistening

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.remember
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionSendBroadcast
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.currentState
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import expo.modules.bayaanwidgets.ArtworkStore
import expo.modules.bayaanwidgets.CommandReceiver
import expo.modules.bayaanwidgets.PlaybackOverride
import expo.modules.bayaanwidgets.PlaybackState
import expo.modules.bayaanwidgets.SnapshotModels
import expo.modules.bayaanwidgets.WidgetSnapshot
import expo.modules.bayaanwidgets.WidgetStorage
import expo.modules.bayaanwidgets.WidgetTrack
import org.json.JSONObject
import java.io.File
import kotlin.math.roundToInt

// Decoded artwork for one composition, keyed by file and pixel size, so rows
// that share a reciter reuse one bitmap in the RemoteViews payload.
private val LocalArtCache = staticCompositionLocalOf<MutableMap<String, Bitmap?>> { HashMap() }

/** Decodes at (roughly) the rendered pixel size to keep RemoteViews small. */
private fun decodeArt(file: File, px: Int): Bitmap? {
  val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
  BitmapFactory.decodeFile(file.path, bounds)
  if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
  var sample = 1
  while (minOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= px) sample *= 2
  val bmp = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
    ?: return null
  if (bmp.width <= px && bmp.height <= px) return bmp
  val scale = px.toFloat() / maxOf(bmp.width, bmp.height)
  return Bitmap.createScaledBitmap(
    bmp, maxOf(1, (bmp.width * scale).roundToInt()), maxOf(1, (bmp.height * scale).roundToInt()), true,
  )
}

class ContinueListeningWidget : GlanceAppWidget() {
  companion object {
    private val SMALL = DpSize(110.dp, 110.dp)
    private val MEDIUM = DpSize(250.dp, 110.dp)
    private val LARGE = DpSize(250.dp, 250.dp)

    val SNAPSHOT_KEY = stringPreferencesKey("snapshot")
    val OVERRIDE_KEY = stringPreferencesKey("playbackOverride")
    // Changes on every push so a live session always recomposes.
    private val PUSHED_AT_KEY = longPreferencesKey("pushedAt")

    /**
     * Copies the stored snapshot and playback override into each widget's Glance
     * state and recomposes it. A live Glance session only recomposes from its
     * state; it does not re-run provideGlance on update.
     */
    suspend fun pushState(context: Context) {
      val json = WidgetStorage.readSnapshotJson(context)
      val override = WidgetStorage.readPlaybackOverrideJson(context)
      val ids = GlanceAppWidgetManager(context).getGlanceIds(ContinueListeningWidget::class.java)
      for (id in ids) {
        updateAppWidgetState(context, id) { prefs ->
          if (json != null) prefs[SNAPSHOT_KEY] = json else prefs.remove(SNAPSHOT_KEY)
          if (override != null) prefs[OVERRIDE_KEY] = override else prefs.remove(OVERRIDE_KEY)
          prefs[PUSHED_AT_KEY] = System.currentTimeMillis()
        }
        ContinueListeningWidget().update(context, id)
      }
    }
  }

  override val sizeMode = SizeMode.Responsive(setOf(SMALL, MEDIUM, LARGE))

  override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    // Fallbacks for the first composition, before any state has been pushed.
    val initialJson = WidgetStorage.readSnapshotJson(context)
    val initialOverride = WidgetStorage.readPlaybackOverrideJson(context)
    provideContent {
      val prefs = currentState<Preferences>()
      val json = prefs[SNAPSHOT_KEY] ?: initialJson
      val overrideJson = prefs[OVERRIDE_KEY] ?: initialOverride
      val snapshot = remember(json) { json?.let { SnapshotModels.decode(it) } }
      val override = remember(overrideJson) { PlaybackState.decodeOverride(overrideJson) }
      val artCache = remember(json) { HashMap<String, Bitmap?>() }
      CompositionLocalProvider(LocalArtCache provides artCache) {
        Content(context, snapshot, override)
      }
    }
  }

  @Composable
  private fun Content(context: Context, s: WidgetSnapshot?, override: PlaybackOverride?) {
    val track = s?.nowPlaying?.track ?: s?.recent?.firstOrNull() ?: s?.upNext?.firstOrNull()
    val openPlayer = actionStartActivity(
      Intent(Intent.ACTION_VIEW, Uri.parse("bayaan://player")).setPackage(context.packageName),
    )
    val tint = track?.artworkFile?.let { ArtworkStore.tint(context, it) }
    val bg = ColorProvider(Color(tint ?: 0xFF1C1C1E.toInt()))

    Box(
      modifier = GlanceModifier.fillMaxSize().background(bg).cornerRadius(20.dp)
        .padding(14.dp).clickable(openPlayer),
    ) {
      if (s == null || track == null) {
        Text("Start listening", style = TextStyle(color = ColorProvider(Color.White), fontWeight = FontWeight.Medium))
        return@Box
      }
      val size = LocalSize.current
      val isPlaying = s.nowPlaying?.let {
        PlaybackState.effective(it, s.generatedAt, override, System.currentTimeMillis()).isPlaying
      } ?: false
      val sideSource =
        if (s.upNext.isEmpty()) s.recent.drop(if (s.nowPlaying == null) 1 else 0) else s.upNext
      val side = sideSource.take(if (size.height >= LARGE.height) 6 else 3)
      when {
        size.width >= MEDIUM.width && size.height >= LARGE.height -> Large(context, track, s.nowPlaying != null, isPlaying, side)
        size.width >= MEDIUM.width -> Medium(context, track, s.nowPlaying != null, isPlaying, side)
        else -> Small(context, track, s.nowPlaying != null, isPlaying)
      }
    }
  }

  @Composable
  private fun Art(context: Context, file: String?, size: Int) {
    val cache = LocalArtCache.current
    val px = maxOf(1, (size * context.resources.displayMetrics.density).roundToInt())
    val bmp = file?.let { name ->
      cache.getOrPut("$name@$px") {
        File(WidgetStorage.artworkDir(context), name).takeIf { it.exists() }?.let { decodeArt(it, px) }
      }
    }
    if (bmp != null) {
      Image(
        ImageProvider(bmp), contentDescription = null,
        modifier = GlanceModifier.size(size.dp).cornerRadius((size / 6).dp),
        contentScale = ContentScale.Crop,
      )
    } else {
      Spacer(GlanceModifier.size(size.dp).background(ColorProvider(Color(0x26FFFFFF))).cornerRadius((size / 6).dp))
    }
  }

  /**
   * Play/pause for the current item. With nothing loaded (the hero is a recent
   * item or the surah of the day), it starts that track instead.
   */
  @Composable
  private fun PlayPause(context: Context, track: WidgetTrack, hasNowPlaying: Boolean, isPlaying: Boolean) {
    val cmd = when {
      // Absolute target: the opposite of what is rendered.
      hasNowPlaying -> JSONObject().put("type", "setPlayback").put("playing", !isPlaying)
      track.isUserUpload || track.surahId == 0 -> return
      else -> playTrackCommand(track)
    }
    Image(
      ImageProvider(if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play),
      contentDescription = if (isPlaying) "Pause" else "Play",
      modifier = GlanceModifier.size(34.dp).background(ColorProvider(Color(0x2EFFFFFF))).cornerRadius(17.dp)
        .padding(7.dp).clickable(
          actionSendBroadcast(
            CommandReceiver.intent(context, cmd)
              .setData(Uri.parse("bayaan-widget://hero/${cmd.toString().hashCode()}")),
          ),
        ),
    )
  }

  @Composable
  private fun Titles(track: WidgetTrack, titleSp: Int) {
    val white = ColorProvider(Color.White)
    Text(track.surahName, maxLines = 1, style = TextStyle(color = white, fontSize = titleSp.sp, fontWeight = FontWeight.Bold))
    Text(track.reciterName, maxLines = 1, style = TextStyle(color = ColorProvider(Color(0xBFFFFFFF)), fontSize = 12.sp))
  }

  @Composable
  private fun Small(context: Context, track: WidgetTrack, hasNowPlaying: Boolean, isPlaying: Boolean) {
    Column(GlanceModifier.fillMaxSize()) {
      Row(GlanceModifier.fillMaxWidth()) {
        Art(context, track.artworkFile, 56)
        Spacer(GlanceModifier.defaultWeight())
        PlayPause(context, track, hasNowPlaying, isPlaying)
      }
      Spacer(GlanceModifier.defaultWeight())
      Titles(track, 15)
    }
  }

  @Composable
  private fun Medium(context: Context, track: WidgetTrack, hasNowPlaying: Boolean, isPlaying: Boolean, side: List<WidgetTrack>) {
    Row(GlanceModifier.fillMaxSize()) {
      Column(GlanceModifier.defaultWeight().fillMaxHeight()) {
        Art(context, track.artworkFile, 60)
        Spacer(GlanceModifier.defaultWeight())
        Titles(track, 15)
        Spacer(GlanceModifier.height(6.dp))
        PlayPause(context, track, hasNowPlaying, isPlaying)
      }
      Spacer(GlanceModifier.width(12.dp))
      Column(GlanceModifier.defaultWeight()) { side.forEach { t -> TrackRow(context, t, 30) } }
    }
  }

  @Composable
  private fun Large(context: Context, track: WidgetTrack, hasNowPlaying: Boolean, isPlaying: Boolean, rows: List<WidgetTrack>) {
    Column(GlanceModifier.fillMaxSize()) {
      Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Art(context, track.artworkFile, 72)
        Spacer(GlanceModifier.width(12.dp))
        Column(GlanceModifier.defaultWeight()) { Titles(track, 18) }
        PlayPause(context, track, hasNowPlaying, isPlaying)
      }
      Spacer(GlanceModifier.height(12.dp))
      rows.forEach { t -> TrackRow(context, t, 36) }
    }
  }

  private fun playTrackCommand(t: WidgetTrack): JSONObject =
    JSONObject().put("type", "playTrack").put("surahId", t.surahId)
      .put("reciterId", t.reciterId).put("rewayatId", t.rewayatId ?: JSONObject.NULL).put("ayah", JSONObject.NULL)

  @Composable
  private fun TrackRow(context: Context, t: WidgetTrack, art: Int) {
    val cmd = playTrackCommand(t)
    val base = if (t.isUserUpload || t.surahId == 0) GlanceModifier else GlanceModifier.clickable(
      actionSendBroadcast(
        CommandReceiver.intent(context, cmd)
          .setData(Uri.parse("bayaan-widget://row/${t.surahId}/${t.reciterId}")),
      ),
    )
    Row(base.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
      Art(context, t.artworkFile, art)
      Spacer(GlanceModifier.width(8.dp))
      Column { Titles(t, 13) }
    }
  }
}
