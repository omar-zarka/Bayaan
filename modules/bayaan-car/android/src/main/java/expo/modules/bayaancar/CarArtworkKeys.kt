package expo.modules.bayaancar

import java.security.MessageDigest

/** A validated artwork key. Pure data so it can be unit tested on the JVM. */
sealed class ArtworkKey {
  data class Surah(val surahId: Int) : ArtworkKey()
  data class Url(val encoded: String) : ArtworkKey()
  data class Asset(val encoded: String) : ArtworkKey()
  data class Tile(val encoded: String) : ArtworkKey()
}

object CarArtworkKeys {
  const val SIZE = 256
  const val MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024
  const val MAX_CACHE_FILES = 1000
  const val MAX_CACHE_BYTES = 50L * 1024 * 1024

  private val payload = Regex("[A-Za-z0-9_-]{1,2048}")
  private val surahKey = Regex("surah-([0-9]{1,3})")
  private val drawableName = Regex("[A-Za-z0-9_]{1,128}")

  /** Strictly validates a URI path segment. Returns null for anything unexpected. */
  fun parseKey(key: String?): ArtworkKey? {
    if (key.isNullOrEmpty()) return null
    surahKey.matchEntire(key)?.let { m ->
      val id = m.groupValues[1].toInt()
      return if (id in 1..114 && m.groupValues[1] == id.toString()) ArtworkKey.Surah(id) else null
    }
    val dash = key.indexOf('-')
    if (dash <= 0) return null
    val body = key.substring(dash + 1)
    if (!payload.matches(body)) return null
    return when (key.substring(0, dash)) {
      "url" -> ArtworkKey.Url(body)
      "asset" -> ArtworkKey.Asset(body)
      "tile" -> ArtworkKey.Tile(body)
      else -> null
    }
  }

  fun isValidDrawableName(name: String): Boolean = drawableName.matches(name)

  /** On-disk file name: SHA-256 hex of the key, so keys never touch the file system. */
  fun fileNameFor(key: String): String =
    MessageDigest.getInstance("SHA-256").digest(key.toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it) } + ".png"

  /** Every https artwork URL referenced by the snapshot and now playing. */
  fun allowedUrls(snapshot: CarSnapshot?, nowPlaying: CarNowPlaying?): Set<String> {
    if (snapshot == null) return emptySet()
    val out = HashSet<String>()
    fun add(a: CarArtwork?) {
      val u = when (a) {
        is CarArtwork.Url -> a.url
        is CarArtwork.Asset -> a.uri
        else -> null
      } ?: return
      if (isHttps(u)) out.add(u)
    }
    snapshot.reciters.forEach { add(it.artwork) }
    snapshot.quickStart.forEach { add(it.artwork) }
    snapshot.library.forEach { add(it.artwork) }
    snapshot.sections.forEach { s -> s.items.forEach { add(it.artwork) } }
    snapshot.lists.values.forEach { l -> l.items.forEach { add(it.artwork) } }
    add(nowPlaying?.artwork)
    return out
  }

  fun isHttps(url: String): Boolean = url.startsWith("https://") && url.length > "https://".length

  /** Largest power-of-two sample size that keeps both dimensions at or above [target]. */
  fun sampleSize(width: Int, height: Int, target: Int = SIZE): Int {
    if (width <= 0 || height <= 0) return 1
    var sample = 1
    val shortSide = minOf(width, height)
    while (shortSide / (sample * 2) >= target) sample *= 2
    return sample
  }

  /** Center square crop as (left, top, side). */
  fun centerSquare(width: Int, height: Int): Triple<Int, Int, Int> {
    val side = minOf(width, height)
    return Triple((width - side) / 2, (height - side) / 2, side)
  }

  /** Initials for a tile; empty label gives empty text (plain tile). */
  fun tileText(label: String): String {
    val trimmed = label.trim()
    if (trimmed.isEmpty()) return ""
    val points = trimmed.codePoints().limit(2).toArray()
    return String(points, 0, points.size).uppercase()
  }

  /** Files to delete (oldest first) so the cache stays within both bounds. */
  fun evictionOrder(files: List<Pair<String, Pair<Long, Long>>>, maxFiles: Int = MAX_CACHE_FILES, maxBytes: Long = MAX_CACHE_BYTES): List<String> {
    // Each entry: name to (lastModified, length).
    val sorted = files.sortedBy { it.second.first }
    var count = sorted.size
    var bytes = sorted.sumOf { it.second.second }
    val out = ArrayList<String>()
    for (f in sorted) {
      if (count <= maxFiles && bytes <= maxBytes) break
      out.add(f.first)
      count--
      bytes -= f.second.second
    }
    return out
  }
}
