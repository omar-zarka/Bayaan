package expo.modules.bayaancar

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CarSearchTest {
  private val art = CarArtwork.Color("", "#333333")
  private val snapshot = CarSnapshot(
    topReciterId = "alafasy",
    quickStart = emptyList(),
    sections = emptyList(),
    library = emptyList(),
    lists = emptyMap(),
    reciters = listOf(
      CarReciter("alafasy", "Mishary Alafasy", art, true, listOf(CarRewayah("hafs", "Hafs", "hafs", listOf(1, 18)))),
      CarReciter("sudais", "Abdul Rahman Al-Sudais", art, false, listOf(CarRewayah("hafs", "Hafs", "hafs", listOf(1, 18)))),
    ),
    surahs = listOf(
      CarSurah(1, "Al-Fatihah", "الفاتحة", "The Opening", 7),
      CarSurah(18, "Al-Kahf", "الكهف", "The Cave", 110),
    ),
    juz = emptyList(),
    downloadedKeys = emptySet(),
  )

  private fun ids(requests: List<String>): List<Pair<String, Int>> =
    requests.map { JSONObject(it).let { o -> o.getString("reciterId") to o.getInt("surahId") } }

  @Test fun surahWithReciter() {
    assertEquals(listOf("alafasy" to 18), ids(CarSearch.search(snapshot, "al kahf by mishary")))
  }

  @Test fun prefixAndSurahWordAreIgnored() {
    assertEquals(listOf("alafasy" to 18, "sudais" to 18).take(1), ids(CarSearch.search(snapshot, "Surah Kahf")).take(1))
    assertEquals(ids(CarSearch.search(snapshot, "kahf")), ids(CarSearch.search(snapshot, "Al-Kahf")))
  }

  @Test fun noReciterUsesTopThenFavorites() {
    assertEquals(listOf("alafasy" to 1), ids(CarSearch.search(snapshot, "fatiha")))
  }

  @Test fun surahNumberAndArabicMatch() {
    assertEquals(listOf("alafasy" to 18), ids(CarSearch.search(snapshot, "18")))
    assertEquals(listOf("alafasy" to 18), ids(CarSearch.search(snapshot, "الكهف")))
  }

  @Test fun unknownOrEmptyYieldsNothing() {
    assertTrue(CarSearch.search(snapshot, "nonexistent").isEmpty())
    assertTrue(CarSearch.search(snapshot, "kahf by nobody").isEmpty())
    assertTrue(CarSearch.search(snapshot, "").isEmpty())
    assertTrue(CarSearch.search(null, "kahf").isEmpty())
  }

  @Test fun requestsMatchTheJsContract() {
    val o = JSONObject(CarSearch.search(snapshot, "kahf").first())
    assertEquals("surah", o.getString("kind"))
    assertEquals("hafs", o.getString("rewayatId"))
    assertEquals(18, o.getInt("surahId"))
  }
}
