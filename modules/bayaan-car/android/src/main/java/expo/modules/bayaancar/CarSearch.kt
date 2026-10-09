package expo.modules.bayaancar

import java.text.Normalizer

object CarSearch {
  private fun norm(s: String): String = Normalizer.normalize(s, Normalizer.Form.NFD)
    .replace(Regex("\\p{Mn}+"), "")
    .lowercase()
    .replace(Regex("^(surah|sura|surat)\\s+"), "")
    .replace(Regex("^(al|an|ar|as|at|ad|adh|ash|az)[-\\s]"), "")
    .replace(Regex("[^\\p{L}\\p{N}]+"), "")

  fun search(query: String): List<String> = search(CarBridge.snapshot, query)

  /** "al kahf by mishary" -> (surah, reciter?) request JSON strings, best first. */
  fun search(s: CarSnapshot?, query: String): List<String> {
    if (s == null) return emptyList()
    val parts = query.split(Regex("\\s+(by|with)\\s+", RegexOption.IGNORE_CASE), limit = 2)
    val surahQuery = norm(parts[0])
    val reciterQuery = parts.getOrNull(1)?.let { norm(it) }?.takeIf { it.isNotEmpty() }
    if (surahQuery.isEmpty()) return emptyList()

    val surahs = s.surahs.filter {
      val n = norm(it.name)
      n == surahQuery || n.startsWith(surahQuery) || norm(it.nameArabic) == surahQuery || it.id.toString() == surahQuery
    }.sortedBy { if (norm(it.name) == surahQuery) 0 else 1 }

    val reciters = when (reciterQuery) {
      null -> listOfNotNull(s.reciters.firstOrNull { it.id == s.topReciterId }) + s.reciters.filter { it.isFavorite }
      else -> s.reciters.filter { norm(it.name).contains(reciterQuery) }
    }.distinctBy { it.id }

    val out = mutableListOf<String>()
    for (surah in surahs) {
      for (r in reciters) {
        val w = r.rewayat.firstOrNull { it.surahIds.contains(surah.id) } ?: continue
        out.add(CarBrowseTree.surahRequest(r.id, w.id, surah.id))
        if (out.size >= 10) return out
      }
    }
    return out
  }
}
