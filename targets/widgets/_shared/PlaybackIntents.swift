// targets/widgets/_shared/PlaybackIntents.swift
import AppIntents
import Foundation

// AudioPlaybackIntent runs in the app process, so the queue notification
// reaches the JS module when the app is alive, and the app launches in the
// background when it is not.
struct TogglePlaybackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play or Pause"
  static var isDiscoverable = false

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue(["type": "togglePlayback"])
    return .result()
  }
}

struct PlayTrackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Surah"
  static var isDiscoverable = false

  @Parameter(title: "Surah") var surahId: Int
  @Parameter(title: "Reciter") var reciterId: String?
  @Parameter(title: "Rewayah") var rewayatId: String?

  init() {}

  init(surahId: Int, reciterId: String?, rewayatId: String?) {
    self.surahId = surahId
    self.reciterId = reciterId
    self.rewayatId = rewayatId
  }

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue([
      "type": "playTrack",
      "surahId": surahId,
      "reciterId": reciterId ?? NSNull(),
      "rewayatId": rewayatId ?? NSNull(),
      "ayah": NSNull(),
    ])
    return .result()
  }
}
