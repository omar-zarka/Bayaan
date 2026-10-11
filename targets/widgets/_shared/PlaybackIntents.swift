// targets/widgets/_shared/PlaybackIntents.swift
import AppIntents
import Foundation
import WidgetKit

// AudioPlaybackIntent runs in the app process, so the queue notification
// reaches the JS module when the app is alive, and the app launches in the
// background when it is not.
// AudioPlaybackIntent is iOS 17+, and _shared also compiles into the iOS 16.4 app.
// Sends an absolute target state (the opposite of what the widget rendered),
// so repeated taps converge instead of toggling past each other.
@available(iOS 17.0, *)
struct SetPlaybackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play or Pause"
  static var isDiscoverable = false

  @Parameter(title: "Playing") var playing: Bool

  init() {}

  init(playing: Bool) {
    self.playing = playing
  }

  func perform() async throws -> some IntentResult {
    // Optimistic render first, then hand the command to the app.
    PlaybackOverrideStore.write(isPlaying: playing)
    WidgetCenter.shared.reloadTimelines(ofKind: "ContinueListening")
    WidgetCommandQueue.enqueue(["type": "setPlayback", "playing": playing])
    return .result()
  }
}

@available(iOS 17.0, *)
struct PlayTrackIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Surah"
  static var isDiscoverable = false

  @Parameter(title: "Surah") var surahId: Int
  @Parameter(title: "Reciter") var reciterId: String?
  @Parameter(title: "Rewayah") var rewayatId: String?
  // Start from this ayah (Ayah of the Day); nil plays from the start.
  @Parameter(title: "Ayah") var ayah: Int?

  init() {}

  init(surahId: Int, reciterId: String?, rewayatId: String?, ayah: Int? = nil) {
    self.surahId = surahId
    self.reciterId = reciterId
    self.rewayatId = rewayatId
    self.ayah = ayah
  }

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue([
      "type": "playTrack",
      "surahId": surahId,
      "reciterId": reciterId ?? NSNull(),
      "rewayatId": rewayatId ?? NSNull(),
      "ayah": ayah ?? NSNull(),
    ])
    return .result()
  }
}

/// Resumes the reciter's last surah (Pinned Reciter).
@available(iOS 17.0, *)
struct PlayReciterIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Reciter"
  static var isDiscoverable = false

  @Parameter(title: "Reciter") var reciterId: String

  init() {}

  init(reciterId: String) {
    self.reciterId = reciterId
  }

  func perform() async throws -> some IntentResult {
    WidgetCommandQueue.enqueue(["type": "playReciter", "reciterId": reciterId])
    return .result()
  }
}
