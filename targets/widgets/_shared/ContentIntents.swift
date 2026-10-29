// targets/widgets/_shared/ContentIntents.swift
import AppIntents
import Foundation

// AudioPlaybackIntents run in the app process, like PlayTrackIntent. They
// only enqueue a command; services/widgets/contentCommands.ts does the work.

/// Queues a playlist starting at an item (Library Shelf).
@available(iOS 17.0, *)
struct PlayPlaylistIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Playlist"
  static var isDiscoverable = false

  @Parameter(title: "Playlist") var playlistId: String
  @Parameter(title: "Item") var itemId: String?

  init() {}

  init(playlistId: String, itemId: String?) {
    self.playlistId = playlistId
    self.itemId = itemId
  }

  func perform() async throws -> some IntentResult {
    let enqueuedAt = WidgetCommandQueue.enqueue([ // @ai
      "type": "playPlaylist",
      "playlistId": playlistId,
      "itemId": itemId ?? NSNull(),
    ])
    await PlaybackCommand.waitUntilHandled(enqueuedAt) // @ai
    return .result()
  }
}

/// Plays a surah from the start, sets the sleep timer, optionally starts ambient (Bedtime).
@available(iOS 17.0, *)
struct StartBedtimeIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Start Bedtime"
  static var isDiscoverable = false

  @Parameter(title: "Surah") var surahId: Int
  @Parameter(title: "Reciter") var reciterId: String?
  @Parameter(title: "Minutes") var sleepMinutes: Int
  @Parameter(title: "Ambient") var ambient: String?

  init() {}

  init(surahId: Int, reciterId: String?, sleepMinutes: Int, ambient: String?) {
    self.surahId = surahId
    self.reciterId = reciterId
    self.sleepMinutes = sleepMinutes
    self.ambient = ambient
  }

  func perform() async throws -> some IntentResult {
    let enqueuedAt = WidgetCommandQueue.enqueue([ // @ai
      "type": "startBedtime",
      "surahId": surahId,
      "reciterId": reciterId ?? NSNull(),
      "sleepMinutes": sleepMinutes,
      "ambient": ambient ?? NSNull(),
    ])
    await PlaybackCommand.waitUntilHandled(enqueuedAt) // @ai
    return .result()
  }
}

// @ai-start
/// Plays an adhkar list's audio from a dhikr (Adhkar widget). Like the other
/// AudioPlaybackIntents it works with the app closed: the app is launched in
/// the background, boots React, and services/adhkar/playback/widgetPlay.ts
/// starts the session.
@available(iOS 17.0, *)
struct PlayAdhkarIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Play Adhkar"
  static var isDiscoverable = false

  @Parameter(title: "List") var superId: String
  // Start from this dhikr; nil starts from the first one with audio.
  @Parameter(title: "Dhikr") var dhikrId: String?

  init() {}

  init(superId: String, dhikrId: String?) {
    self.superId = superId
    self.dhikrId = dhikrId
  }

  func perform() async throws -> some IntentResult {
    let enqueuedAt = WidgetCommandQueue.enqueue([
      "type": "playAdhkar",
      "superId": superId,
      "dhikrId": dhikrId ?? NSNull(),
    ])
    await PlaybackCommand.waitUntilHandled(enqueuedAt)
    return .result()
  }
}
// @ai-end
