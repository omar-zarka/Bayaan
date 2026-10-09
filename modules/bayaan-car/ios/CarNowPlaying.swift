import CarPlay
import MediaPlayer
import UIKit

/// Main-thread only. Owns the CarPlay Now Playing buttons, the Up Next and
/// album-artist (reciter) pushes, and the next/previous remote commands for
/// the lifetime of one CarPlay connection.
///
/// expo-audio never touches `nextTrackCommand`, `previousTrackCommand` or
/// `changePlaybackRateCommand`; it only toggles play, pause, position and skip
/// forward/backward. So our registrations are not undone by its metadata
/// updates, and with the skip commands disabled (JS car mode) CarPlay shows
/// next/previous instead.
///
/// The rate button's label comes from `MPRemoteCommandCenter`: CarPlay reads
/// it through an enabled `changePlaybackRateCommand` with supported rates.
/// Without that command the button reads "0x" and looks inert.
final class CarNowPlayingController: NSObject, CPNowPlayingTemplateObserver {
  private weak var interfaceController: CPInterfaceController?
  private let builder: CarTemplateBuilder
  private let commands = MPRemoteCommandCenter.shared()
  private var observer: NSObjectProtocol?
  private var nextTarget: Any?
  private var previousTarget: Any?
  private var repeatTarget: Any?
  private var rateTarget: Any?
  /// The rates the car cycles through (JS `nextRate`), ascending.
  private static let supportedRates: [NSNumber] = [0.75, 1, 1.25, 1.5]
  private var lovedShown: Bool?
  private var rateShown: Double?
  /// CarPlay audio apps may stack at most five templates (tab bar root included).
  private static let maxTemplateDepth = 5
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
    // The repeat button's state comes from currentRepeatType; the command is
    // enabled with a no-op target so CarPlay treats it as available. The
    // button's own handler sends cycleRepeat to JS.
    commands.changeRepeatModeCommand.isEnabled = true
    repeatTarget = commands.changeRepeatModeCommand.addTarget { _ in .success }
    commands.changePlaybackRateCommand.supportedPlaybackRates = Self.supportedRates
    commands.changePlaybackRateCommand.isEnabled = true
    rateTarget = commands.changePlaybackRateCommand.addTarget { event in
      guard let event = event as? MPChangePlaybackRateCommandEvent else { return .commandFailed }
      CarBridge.shared.send(transport: ["kind": "rate", "value": Double(event.playbackRate)])
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
    if let repeatTarget { commands.changeRepeatModeCommand.removeTarget(repeatTarget) }
    commands.changeRepeatModeCommand.isEnabled = false
    if let rateTarget { commands.changePlaybackRateCommand.removeTarget(rateTarget) }
    commands.changePlaybackRateCommand.isEnabled = false
    rateTarget = nil
    nextTarget = nil
    previousTarget = nil
    repeatTarget = nil
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
    if let np, np.rate > 0, np.rate != rateShown {
      rateShown = np.rate
      var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
      info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = np.rate
      // expo-audio rewrites the live rate on its next tick; set it now so the
      // button label follows the tap without waiting for that tick.
      if np.isPlaying { info[MPNowPlayingInfoPropertyPlaybackRate] = np.rate }
      MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
    // Only a loved change needs new buttons; repeat follows currentRepeatType.
    guard loved != lovedShown else { return }
    lovedShown = loved
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
    guard let ic = interfaceController, canPush(), let reciterId = CarBridge.shared.nowPlaying?.reciterId,
      let reciter = CarBridge.shared.snapshot?.reciters.first(where: { $0.id == reciterId })
    else { return }
    // The reciter's picker or list is already in the stack: go back to it.
    if let existing = ic.templates.first(where: { ($0 as? CPListTemplate)?.title == reciter.name }) {
      ic.pop(to: existing, animated: true, completion: nil)
      return
    }
    // Reuses the Reciters tab flow: rewayah picker for multi-rewayah reciters,
    // surah list otherwise. Playing a surah pops back to Now Playing.
    let needed = reciter.rewayat.count > 1 ? 2 : 1
    isPushing = true
    let push: () -> Void = { [weak self] in
      guard let self else { return }
      self.builder.pushReciter(reciterId) { [weak self] in self?.isPushing = false }
    }
    if ic.templates.count + needed > Self.maxTemplateDepth {
      ic.popToRootTemplate(animated: false) { _, _ in push() }
      return
    }
    push()
  }

  private func popToNowPlaying() {
    guard let ic = interfaceController else { return }
    let nowPlaying = CPNowPlayingTemplate.shared
    guard ic.templates.contains(where: { $0 === nowPlaying }), ic.topTemplate !== nowPlaying else { return }
    ic.pop(to: nowPlaying, animated: true, completion: nil)
  }
}
