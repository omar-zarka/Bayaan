package expo.modules.bayaancar

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Serves car artwork to Android Auto. Exported but read-only; every key is
 * validated, network fetches are limited to https URLs present in the current
 * snapshot (plus the fixed surah CDN), and the on-disk cache is bounded.
 */
class CarArtworkProvider : ContentProvider() {
  companion object {
    private const val SURAH_BASE = "https://cdn.thebayaan.com/assets/og-images/surah/"
    private const val TIMEOUT_MS = 10_000
    private const val STALE_TMP_MS = 10 * 60 * 1000L

    @Volatile private var authority: String? = null
    private val locks = ConcurrentHashMap<String, Any>()

    // Cached allowlist, rebuilt only when the snapshot or now playing instance changes.
    private class Allow(val snapshot: CarSnapshot?, val nowPlaying: CarNowPlaying?, val urls: Set<String>)
    @Volatile private var allow: Allow? = null

    fun uriFor(artwork: CarArtwork): Uri? {
      val auth = authority ?: return null
      val key = when (artwork) {
        is CarArtwork.Surah -> "surah-${artwork.surahId}"
        is CarArtwork.Url -> "url-" + encode(artwork.url)
        is CarArtwork.Asset -> "asset-" + encode(artwork.uri)
        is CarArtwork.Monogram -> "tile-" + encode("${artwork.label}|${artwork.hex}")
        is CarArtwork.Color -> "tile-" + encode("${artwork.label}|${artwork.hex}")
      }
      if (CarArtworkKeys.parseKey(key) == null) return null
      return Uri.parse("content://$auth/$key")
    }

    private fun encode(s: String): String =
      Base64.encodeToString(s.toByteArray(Charsets.UTF_8), Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING)

    private fun decode(s: String): String? = runCatching {
      String(Base64.decode(s, Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING), Charsets.UTF_8)
    }.getOrNull()

    private fun allowedUrls(): Set<String> {
      val snapshot = CarBridge.snapshot
      val nowPlaying = CarBridge.nowPlaying
      val cached = allow
      if (cached != null && cached.snapshot === snapshot && cached.nowPlaying === nowPlaying) return cached.urls
      val urls = CarArtworkKeys.allowedUrls(snapshot, nowPlaying)
      allow = Allow(snapshot, nowPlaying, urls)
      return urls
    }
  }

  override fun onCreate(): Boolean {
    val ctx = context ?: return false
    authority = "${ctx.packageName}.bayaancar.artwork"
    // Cold process hit by the provider alone: load the persisted snapshot for the allowlist.
    CarBridge.init(ctx.applicationContext ?: ctx)
    return true
  }

  private fun cacheDir(): File? {
    val ctx = context ?: return null
    return File(ctx.cacheDir, "bayaan-car/artwork").also { it.mkdirs() }
  }

  override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor? {
    if (mode != "r") return null
    val keyString = uri.pathSegments.singleOrNull() ?: return null
    val key = CarArtworkKeys.parseKey(keyString) ?: return null
    val dir = cacheDir() ?: return null
    val name = CarArtworkKeys.fileNameFor(keyString)
    val file = File(dir, name)
    val lock = locks.getOrPut(name) { Any() }
    synchronized(lock) {
      if (!file.isFile) {
        val bitmap = render(key) ?: return null
        if (!writeAtomically(dir, file, bitmap)) return null
        evict(dir)
      } else {
        file.setLastModified(System.currentTimeMillis())
      }
      return runCatching { ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY) }.getOrNull()
    }
  }

  private fun writeAtomically(dir: File, target: File, bitmap: Bitmap): Boolean {
    val tmp = File(dir, "${UUID.randomUUID()}.tmp")
    return try {
      FileOutputStream(tmp).use { if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) return false }
      if (!tmp.renameTo(target)) return false
      true
    } catch (e: Exception) {
      CarLog.d("artwork write failed: $e")
      false
    } finally {
      tmp.delete()
    }
  }

  private fun evict(dir: File) {
    val all = dir.listFiles() ?: return
    val now = System.currentTimeMillis()
    all.filter { it.name.endsWith(".tmp") && now - it.lastModified() > STALE_TMP_MS }.forEach { it.delete() }
    val pngs = all.filter { it.name.endsWith(".png") }
    val doomed = CarArtworkKeys.evictionOrder(pngs.map { it.name to (it.lastModified() to it.length()) })
    doomed.forEach { File(dir, it).delete() }
  }

  private fun render(key: ArtworkKey): Bitmap? = when (key) {
    is ArtworkKey.Surah -> download("$SURAH_BASE${key.surahId}.png")
    is ArtworkKey.Url -> decode(key.encoded)?.let { fetchIfAllowed(it) }
    is ArtworkKey.Asset -> decode(key.encoded)?.let { asset(it) }
    is ArtworkKey.Tile -> decode(key.encoded)?.let { d ->
      val parts = d.split("|", limit = 2)
      tile(parts[0], parts.getOrElse(1) { "#333333" })
    }
  }

  private fun fetchIfAllowed(url: String): Bitmap? {
    if (!CarArtworkKeys.isHttps(url) || url !in allowedUrls()) return null
    return download(url)
  }

  private fun download(url: String): Bitmap? {
    var conn: HttpURLConnection? = null
    return try {
      conn = (URL(url).openConnection() as? HttpURLConnection) ?: return null
      conn.connectTimeout = TIMEOUT_MS
      conn.readTimeout = TIMEOUT_MS
      conn.instanceFollowRedirects = false
      if (conn.responseCode != HttpURLConnection.HTTP_OK) return null
      if (conn.contentLengthLong > CarArtworkKeys.MAX_DOWNLOAD_BYTES) return null
      val bytes = readCapped(conn) ?: return null
      decodeSquare(bytes)
    } catch (e: Exception) {
      CarLog.d("artwork download failed: $e")
      null
    } finally {
      conn?.disconnect()
    }
  }

  private fun readCapped(conn: HttpURLConnection): ByteArray? {
    val out = ByteArrayOutputStream()
    val buf = ByteArray(16 * 1024)
    conn.inputStream.use { input ->
      while (true) {
        val n = input.read(buf)
        if (n < 0) break
        if (out.size() + n > CarArtworkKeys.MAX_DOWNLOAD_BYTES) return null
        out.write(buf, 0, n)
      }
    }
    return out.toByteArray()
  }

  /** Downsamples while decoding, center-crops to a square and scales to SIZE. */
  private fun decodeSquare(bytes: ByteArray): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    val opts = BitmapFactory.Options().apply { inSampleSize = CarArtworkKeys.sampleSize(bounds.outWidth, bounds.outHeight) }
    val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts) ?: return null
    return squareScaled(decoded)
  }

  private fun squareScaled(src: Bitmap): Bitmap {
    val (left, top, side) = CarArtworkKeys.centerSquare(src.width, src.height)
    val square = if (side == src.width && side == src.height) src else Bitmap.createBitmap(src, left, top, side, side)
    return if (side == CarArtworkKeys.SIZE) square else Bitmap.createScaledBitmap(square, CarArtworkKeys.SIZE, CarArtworkKeys.SIZE, true)
  }

  private fun asset(uri: String): Bitmap? {
    if (uri.startsWith("http")) return fetchIfAllowed(uri)
    if (!CarArtworkKeys.isValidDrawableName(uri)) return null
    val ctx = context ?: return null
    val id = ctx.resources.getIdentifier(uri, "drawable", ctx.packageName)
    if (id == 0) return null
    val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeResource(ctx.resources, id, opts)
    val sample = CarArtworkKeys.sampleSize(opts.outWidth, opts.outHeight)
    val decoded = BitmapFactory.decodeResource(ctx.resources, id, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
    return squareScaled(decoded)
  }

  private fun tile(label: String, hex: String): Bitmap {
    val size = CarArtworkKeys.SIZE
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(runCatching { Color.parseColor(hex) }.getOrDefault(Color.DKGRAY))
    val text = CarArtworkKeys.tileText(label)
    if (text.isEmpty()) return bitmap
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      textSize = size * 0.3f
      textAlign = Paint.Align.CENTER
      isFakeBoldText = true
    }
    val y = size / 2f - (paint.descent() + paint.ascent()) / 2f
    canvas.drawText(text, size / 2f, y, paint)
    return bitmap
  }

  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
  override fun getType(uri: Uri): String? =
    if (CarArtworkKeys.parseKey(uri.pathSegments.singleOrNull()) != null) "image/png" else null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
