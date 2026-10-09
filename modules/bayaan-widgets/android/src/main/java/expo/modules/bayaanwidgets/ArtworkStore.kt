package expo.modules.bayaanwidgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import androidx.core.graphics.ColorUtils
import androidx.palette.graphics.Palette
import java.io.File
import java.io.FileOutputStream
import java.net.URL

object ArtworkStore {
  private const val SIDE = 300
  private val tintCache = HashMap<String, Int>()

  /** Downloads or copies, center-crops to 300x300, writes JPEG. Runs off the main thread. */
  fun cache(context: Context, sourceUrl: String, fileName: String): Boolean = try {
    val uri = Uri.parse(sourceUrl)
    val input = when (uri.scheme) {
      "http", "https" -> URL(sourceUrl).openStream()
      "file" -> File(requireNotNull(uri.path)).inputStream()
      else -> context.contentResolver.openInputStream(uri)
    }
    val src = input.use { BitmapFactory.decodeStream(it) } ?: throw IllegalStateException("decode")
    val side = minOf(src.width, src.height)
    val cropped = Bitmap.createBitmap(src, (src.width - side) / 2, (src.height - side) / 2, side, side)
    val scaled = Bitmap.createScaledBitmap(cropped, SIDE, SIDE, true)
    FileOutputStream(File(WidgetStorage.artworkDir(context), fileName)).use {
      scaled.compress(Bitmap.CompressFormat.JPEG, 85, it)
    }
    synchronized(tintCache) { tintCache.remove(fileName) }
    true
  } catch (e: Exception) {
    false
  }

  /** Muted dark color from the artwork, darkened so white text stays legible. */
  fun tint(context: Context, fileName: String): Int? {
    synchronized(tintCache) { tintCache[fileName]?.let { return it } }
    val file = File(WidgetStorage.artworkDir(context), fileName)
    val bmp = BitmapFactory.decodeFile(file.path) ?: return null
    val palette = Palette.from(bmp).generate()
    val base = palette.darkMutedSwatch?.rgb ?: palette.dominantSwatch?.rgb ?: return null
    val hsl = FloatArray(3)
    ColorUtils.colorToHSL(base, hsl)
    hsl[2] = minOf(hsl[2], 0.3f)
    val color = ColorUtils.HSLToColor(hsl) or Color.BLACK
    synchronized(tintCache) { tintCache[fileName] = color }
    return color
  }
}
