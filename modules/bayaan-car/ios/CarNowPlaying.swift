import CarPlay
import MediaPlayer
import UIKit

/// Main-thread only. Owns the CarPlay Now Playing buttons, the Up Next and
/// album-artist (reciter) pushes, and the next/previous remote commands for
/// the lifetime of one CarPlay connection.
///
/// expo-audio never touches `nextTrackCommand` or `previousTrackCommand`; it
/// only toggles play, pause, position and skip forward/backward. So our
/// registrations are not undone by its metadata updates, and with the skip
/// commands disabled (JS car mode) CarPlay shows next/previous instead.
final class CarNowPlayingController: NSObject, CPNowPlayingTemplateObserver {
  private weak var interfaceController: CPInterfaceController?
  private let builder: CarTemplateBuilder
  private let commands = MPRemoteCommandCenter.shared()
  private var observer: NSObjectProtocol?
  private var nextTarget: Any?
  private var previousTarget: Any?
  private var buttonsKey: String?
  private var upNextTemplate: CPListTemplate?
  private var isPushing = false

  init(interfaceController: CPInterfaceController, builder: CarTemplateBuilder) {
    self.interfaceController = interfaceController
    self.builder = builder
    super.init()
    let template = CPNowPlayingTemplate.shared
    template.add(self)
    template.isUpNextButtonEnabled = true
    template.isAlbumArtistButtonEnabled = true
    template.upNextTitle = "Up Next"
    commands.nextTrackCommand.isEnabled = true
    commands.previousTrackCommand.isEnabled = true
    nextTarget = commands.nextTrackCommand.addTarget { _ in
      CarBridge.shared.send(transport: ["kind": "next"])
      return .success
    }
    previousTarget = commands.previousTrackCommand.addTarget { _ in
      CarBridge.shared.send(transport: ["kind": "previous"])
      return .success
    }
    observer = NotificationCenter.default.addObserver(
      forName: CarBridge.nowPlayingDidChange, object: nil, queue: .main
    ) { [weak self] _ in
      self?.updateButtons()
    }
    updateButtons()
  }

  func tearDown() {
    CPNowPlayingTemplate.shared.remove(self)
    if let nextTarget { commands.nextTrackCommand.removeTarget(nextTarget) }
    if let previousTarget { commands.previousTrackCommand.removeTarget(previousTarget) }
    nextTarget = nil
    previousTarget = nil
    commands.nextTrackCommand.isEnabled = false
    commands.previousTrackCommand.isEnabled = false
    if let observer { NotificationCenter.default.removeObserver(observer) }
    observer = nil
    upNextTemplate = nil
  }

  // MARK: Buttons

  private func updateButtons() {
    let np = CarBridge.shared.nowPlaying
    let loved = np?.isLoved == true
    let repeatMode = np?.repeatMode ?? "none"
    switch repeatMode {
    case "track": commands.changeRepeatModeCommand.currentRepeatType = .one
    case "queue": commands.changeRepeatModeCommand.currentRepeatType = .all
    default: commands.changeRepeatModeCommand.currentRepeatType = .off
    }
    // Position ticks are not pushed here; only rebuild when a button changes.
    let key = "\(loved)|\(repeatMode)"
    guard key != buttonsKey else { return }
    buttonsKey = key
    let rate = CPNowPlayingPlaybackRateButton { _ in
      CarBridge.shared.send(transport: ["kind": "cycleRate"])
    }
    let repeatButton = CPNowPlayingRepeatButton { _ in
      CarBridge.shared.send(transport: ["kind": "cycleRepeat"])
    }
    let loveImage = (UIImage(systemName: loved ? "heart.fill" : "heart") ?? UIImage())
      .withRenderingMode(.alwaysTemplate)
    let love = CPNowPlayingImageButton(image: loveImage) { _ in
      CarBridge.shared.send(transport: ["kind": "toggleLove"])
    }
    CPNowPlayingTemplate.shared.updateNowPlayingButtons([rate, repeatButton, love])
  }

  // MARK: Pushes

  /// True when a browse template may be pushed: Now Playing is on top and no
  /// push is already in flight.
  private func canPush() -> Bool {
    guard let ic = interfaceController, !isPushing else { return false }
    return ic.topTemplate === CPNowPlayingTemplate.shared
  }

  // MARK: CPNowPlayingTemplateObserver

  func nowPlayingTemplateUpNextButtonTapped(_ nowPlayingTemplate: CPNowPlayingTemplate) {
    guard let ic = interfaceController, canPush(), let np = CarBridge.shared.nowPlaying else { return }
    if let existing = upNextTemplate, ic.templates.contains(where: { $0 === existing }) { return }
    let count = np.queue.count
    let limit = CPListTemplate.maximumItemCount
    // Longer queues than CarPlay can show are windowed to start at the current item.
    let start = count > limit ? min(max(np.currentIndex, 0), count - limit) : 0
    let end = min(count, start + limit)
    let items = (start..<end).map { index -> CPListItem in
      let entry = np.queue[index]
      let item = CPListItem(text: entry.title, detailText: entry.subtitle, image: nil)
      if let surahId = entry.surahId { builder.setArtwork(item, .surah(surahId)) }
      item.isPlaying = index == np.currentIndex
      item.handler = { [weak self] _, completion in
        CarBridge.shared.send(transport: ["kind": "jumpTo", "index": index])
        self?.popToNowPlaying()
        completion()
      }
      return item
    }
    let rows = items.isEmpty ? [CPListItem(text: "Nothing here yet", detailText: nil)] : items
    let template = builder.listTemplate(title: "Up Next", sections: [CPListSection(items: rows)])
    upNextTemplate = template
    isPushing = true
    ic.pushTemplate(template, animated: true) { [weak self] _, _ in
      self?.isPushing = false
    }
  }

  func nowPlayingTemplateAlbumArtistButtonTapped(_ nowPlayingTemplate: CPNowPlayingTemplate) {
    guard canPush(), let reciterId = CarBridge.shared.nowPlaying?.reciterId else { return }
    isPushing = true
    // Reuses the Reciters tab flow: rewayah picker for multi-rewayah reciters,
    // surah list otherwise. Playing a surah pops back to Now Playing.
    builder.pushReciter(reciterId) { [weak self] in
      self?.isPushing = false
    }
  }

  private func popToNowPlaying() {
    guard let ic = interfaceController else { return }
    let nowPlaying = CPNowPlayingTemplate.shared
    guard ic.templates.contains(where: { $0 === nowPlaying }), ic.topTemplate !== nowPlaying else { return }
    ic.pop(to: nowPlaying, animated: true, completion: nil)
  }
}
