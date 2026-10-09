package expo.modules.bayaancar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CarArtworkKeysTest {
  @Test fun surahKeysAcceptOnly1To114() {
    assertEquals(ArtworkKey.Surah(1), CarArtworkKeys.parseKey("surah-1"))
    assertEquals(ArtworkKey.Surah(114), CarArtworkKeys.parseKey("surah-114"))
    assertNull(CarArtworkKeys.parseKey("surah-0"))
    assertNull(CarArtworkKeys.parseKey("surah-115"))
    assertNull(CarArtworkKeys.parseKey("surah-018"))
    assertNull(CarArtworkKeys.parseKey("surah--1"))
    assertNull(CarArtworkKeys.parseKey("surah-1.png"))
  }

  @Test fun payloadKeysRejectTraversalAndEncoding() {
    assertNotNull(CarArtworkKeys.parseKey("url-aHR0cHM6Ly9leGFtcGxlLmNvbQ"))
    assertNotNull(CarArtworkKeys.parseKey("tile-QUJ8I2ZmMA"))
    assertNotNull(CarArtworkKeys.parseKey("asset-a_b-c"))
    listOf("url-../x", "url-a/b", "url-..%2Fx", "url-a.b", "url-", "tile-a b", "other-abc", "-abc", "", "..", "url-a\u0000b")
      .forEach { assertNull(it, CarArtworkKeys.parseKey(it)) }
    assertNull(CarArtworkKeys.parseKey(null))
    assertNull(CarArtworkKeys.parseKey("url-" + "a".repeat(2049)))
  }

  @Test fun fileNameIsHashedAndStable() {
    val name = CarArtworkKeys.fileNameFor("surah-18")
    assertTrue(Regex("[0-9a-f]{64}\\.png").matches(name))
    assertEquals(name, CarArtworkKeys.fileNameFor("surah-18"))
    assertTrue(name != CarArtworkKeys.fileNameFor("surah-19"))
  }

  @Test fun sampleSizeKeepsAtLeastTarget() {
    assertEquals(4, CarArtworkKeys.sampleSize(1200, 1200))
    assertEquals(1, CarArtworkKeys.sampleSize(256, 256))
    assertEquals(1, CarArtworkKeys.sampleSize(300, 300))
    assertEquals(2, CarArtworkKeys.sampleSize(600, 2000))
    assertEquals(1, CarArtworkKeys.sampleSize(0, 0))
  }

  @Test fun centerSquareCrops() {
    assertEquals(Triple(100, 0, 200), CarArtworkKeys.centerSquare(400, 200))
    assertEquals(Triple(0, 50, 100), CarArtworkKeys.centerSquare(100, 200))
    assertEquals(Triple(0, 0, 256), CarArtworkKeys.centerSquare(256, 256))
  }

  @Test fun tileTextHandlesEmptyAndLong() {
    assertEquals("", CarArtworkKeys.tileText(""))
    assertEquals("", CarArtworkKeys.tileText("   "))
    assertEquals("AB", CarArtworkKeys.tileText("abc"))
    assertEquals("M", CarArtworkKeys.tileText("m"))
  }

  @Test fun evictionRemovesOldestUntilWithinBounds() {
    val files = listOf("a" to (3L to 10L), "b" to (1L to 10L), "c" to (2L to 10L))
    assertEquals(listOf("b"), CarArtworkKeys.evictionOrder(files, maxFiles = 2, maxBytes = 1000))
    assertEquals(listOf("b", "c"), CarArtworkKeys.evictionOrder(files, maxFiles = 10, maxBytes = 10))
    assertEquals(emptyList<String>(), CarArtworkKeys.evictionOrder(files, maxFiles = 3, maxBytes = 30))
  }

  @Test fun httpsOnly() {
    assertTrue(CarArtworkKeys.isHttps("https://a.com/x.png"))
    assertTrue(!CarArtworkKeys.isHttps("http://a.com/x.png"))
    assertTrue(!CarArtworkKeys.isHttps("https://"))
    assertTrue(!CarArtworkKeys.isHttps("file:///etc/passwd"))
  }

  @Test fun allowlistCollectsHttpsArtworkAndNullSnapshotIsEmpty() {
    assertTrue(CarArtworkKeys.allowedUrls(null, null).isEmpty())
    fun item(id: String, a: CarArtwork) = CarItem(id, "t", null, a, null, false, CarItemAction.BrowseList("x"))
    val snap = CarSnapshot(
      topReciterId = null,
      quickStart = listOf(item("1", CarArtwork.Url("https://a.com/1.png"))),
      sections = listOf(CarSection("s", "S", "grid", listOf(item("2", CarArtwork.Url("http://insecure.com/2.png"))))),
      library = listOf(item("3", CarArtwork.Asset("https://a.com/3.png")), item("4", CarArtwork.Asset("icon_name"))),
      lists = mapOf("l" to CarList("l", "L", listOf(item("5", CarArtwork.Url("https://a.com/5.png"))))),
      reciters = listOf(CarReciter("r", "R", CarArtwork.Url("https://a.com/r.png"), false, emptyList())),
      surahs = emptyList(),
      juz = emptyList(),
      downloadedKeys = emptySet(),
    )
    assertEquals(
      setOf("https://a.com/1.png", "https://a.com/3.png", "https://a.com/5.png", "https://a.com/r.png"),
      CarArtworkKeys.allowedUrls(snap, null),
    )
  }
}
