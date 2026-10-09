import CarPlay
import UIKit

/// Main-thread only. Builds the four root tabs from `CarBridge.shared.snapshot`
/// and the pushed browse templates on demand.
final class CarTemplateBuilder {
  private weak var interfaceController: CPInterfaceController?
  private let style: () -> UIUserInterfaceStyle
  private let homeTemplate = CPListTemplate(title: "Home", sections: [])
  private let libraryTemplate = CPListTemplate(title: "Library", sections: [])
  private let recitersTemplate = CPListTemplate(title: "Reciters", sections: [])
  private let surahsTemplate = CPListTemplate(title: "Surahs", sections: [])
  private var refreshScheduled = false

  private static let emptyCopy = "Open Bayaan on your phone to get started"
  private static let nothingYet = "Nothing here yet"

  init(interfaceController: CPInterfaceController, style: @escaping () -> UIUserInterfaceStyle) {
    self.interfaceController = interfaceController
    self.style = style
    homeTemplate.tabTitle = "Home"
    homeTemplate.tabImage = UIImage(systemName: "house.fill")
    libraryTemplate.tabTitle = "Library"
    libraryTemplate.tabImage = UIImage(systemName: "books.vertical.fill")
    recitersTemplate.tabTitle = "Reciters"
    recitersTemplate.tabImage = UIImage(systemName: "person.2.fill")
    surahsTemplate.tabTitle = "Surahs"
    surahsTemplate.tabImage = UIImage(systemName: "list.number")
  }

  func tabTemplates() -> [CPTemplate] {
    refresh()
    return [homeTemplate, libraryTemplate, recitersTemplate, surahsTemplate]
  }

  func refresh() {
    guard let snapshot = CarBridge.shared.snapshot else {
      let empty = [CPListSection(items: [CPListItem(text: Self.emptyCopy, detailText: nil)])]
      [homeTemplate, libraryTemplate, recitersTemplate, surahsTemplate].forEach { $0.updateSections(empty) }
      return
    }
    homeTemplate.updateSections(clamp(homeSections(snapshot)))
    libraryTemplate.updateSections(clamp(librarySections(snapshot)))
    recitersTemplate.updateSections(clamp(reciterSections(snapshot)))
    surahsTemplate.updateSections(clamp(surahSections(snapshot)))
  }

  // MARK: Limits

  /// Enforces CarPlay's section and total item limits. An image row counts as one item.
  private func clamp(_ sections: [CPListSection]) -> [CPListSection] {
    var remaining = CPListTemplate.maximumItemCount
    var result: [CPListSection] = []
    for section in sections.prefix(CPListTemplate.maximumSectionCount) {
      guard remaining > 0 else { break }
      if section.items.count <= remaining {
        result.append(section)
        remaining -= section.items.count
        continue
      }
      result.append(CPListSection(
        items: Array(section.items.prefix(remaining)), header: section.header, sectionIndexTitle: section.sectionIndexTitle))
      remaining = 0
    }
    return result
  }

  private func listTemplate(title: String, sections: [CPListSection]) -> CPListTemplate {
    CPListTemplate(title: title, sections: clamp(sections))
  }

  private func artwork(_ art: CarArtwork) -> UIImage {
    CarArtworkCache.shared.image(for: art, style: style()) { [weak self] _ in self?.refreshSoon() }
  }

  // MARK: Home

  private func homeSections(_ s: CarSnapshot) -> [CPListSection] {
    var sections: [CPListSection] = []
    if !s.home.quickStart.isEmpty {
      sections.append(CPListSection(items: [imageRow(title: "Quick start", items: s.home.quickStart)]))
    }
    for section in s.home.sections where !section.items.isEmpty {
      switch section.style {
      case "circles", "cards":
        sections.append(CPListSection(items: [imageRow(title: section.title, items: section.items)]))
      default:
        sections.append(CPListSection(items: section.items.map(listItem), header: section.title, sectionIndexTitle: nil))
      }
    }
    if sections.isEmpty {
      sections.append(CPListSection(items: [CPListItem(text: Self.nothingYet, detailText: nil)]))
    }
    return sections
  }

  private func imageRow(title: String, items: [CarItem]) -> CPListImageRowItem {
    let limited = Array(items.prefix(CPMaximumNumberOfGridImages))
    let row = CPListImageRowItem(text: title, images: limited.map { artwork($0.artwork) })
    row.listImageRowHandler = { [weak self] _, index, completion in
      if limited.indices.contains(index) { self?.perform(limited[index]) }
      completion()
    }
    row.handler = { _, completion in completion() }
    return row
  }

  // MARK: Library

  private func librarySections(_ s: CarSnapshot) -> [CPListSection] {
    if s.library.isEmpty {
      return [CPListSection(items: [CPListItem(text: Self.nothingYet, detailText: nil)])]
    }
    return [CPListSection(items: s.library.map(listItem))]
  }

  // MARK: Generic items

  private func listItem(_ item: CarItem) -> CPListItem {
    let row = CPListItem(text: item.title, detailText: item.subtitle, image: artwork(item.artwork))
    if let progress = item.progress { row.playbackProgress = CGFloat(min(max(progress, 0), 1)) }
    if case .play = item.action {} else { row.accessoryType = .disclosureIndicator }
    row.handler = { [weak self] _, completion in
      self?.perform(item)
      completion()
    }
    return row
  }

  private func perform(_ item: CarItem) {
    switch item.action {
    case .play(let raw): play(raw.value)
    case .browseList(let id): pushList(id)
    case .browseReciter(let id): pushReciter(id)
    case .browseSurahReciters(let id): pushSurahReciters(id)
    }
  }

  private func play(_ request: [String: Any]) {
    CarBridge.shared.send(play: request)
    guard let ic = interfaceController else { return }
    if ic.topTemplate !== CPNowPlayingTemplate.shared {
      ic.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
    }
  }

  private func pushList(_ id: String) {
    guard let list = CarBridge.shared.snapshot?.lists[id] else { return }
    let items = list.items.isEmpty ? [CPListItem(text: Self.nothingYet, detailText: nil)] : list.items.map(listItem)
    interfaceController?.pushTemplate(
      listTemplate(title: list.title, sections: [CPListSection(items: items)]), animated: true, completion: nil)
  }

  // MARK: Reciters

  private func reciterSections(_ s: CarSnapshot) -> [CPListSection] {
    let favorites = s.reciters.filter { $0.isFavorite }
    let others = s.reciters.filter { !$0.isFavorite }
    var sections: [CPListSection] = []
    if !favorites.isEmpty {
      sections.append(CPListSection(items: favorites.map(reciterItem), header: "Favorites", sectionIndexTitle: nil))
    }
    if !others.isEmpty {
      sections.append(CPListSection(items: others.map(reciterItem), header: "All reciters", sectionIndexTitle: nil))
    }
    return sections
  }

  private func reciterItem(_ r: CarReciter) -> CPListItem {
    let item = CPListItem(
      text: r.name, detailText: r.rewayat.count > 1 ? "\(r.rewayat.count) rewayat" : nil, image: artwork(r.artwork))
    item.accessoryType = .disclosureIndicator
    item.handler = { [weak self] _, completion in
      self?.pushReciter(r.id)
      completion()
    }
    return item
  }

  private func pushReciter(_ id: String) {
    guard let reciter = CarBridge.shared.snapshot?.reciters.first(where: { $0.id == id }) else { return }
    if reciter.rewayat.count == 1, let only = reciter.rewayat.first {
      pushRewayah(reciter, only)
      return
    }
    let items = reciter.rewayat.map { w -> CPListItem in
      let item = CPListItem(text: w.name, detailText: "\(w.surahIds.count) surahs")
      item.accessoryType = .disclosureIndicator
      item.handler = { [weak self] _, completion in
        self?.pushRewayah(reciter, w)
        completion()
      }
      return item
    }
    let shown = items.isEmpty ? [CPListItem(text: Self.nothingYet, detailText: nil)] : items
    interfaceController?.pushTemplate(
      listTemplate(title: reciter.name, sections: [CPListSection(items: shown)]), animated: true, completion: nil)
  }

  private func pushRewayah(_ reciter: CarReciter, _ rewayah: CarRewayah) {
    guard let s = CarBridge.shared.snapshot else { return }
    let downloaded = Set(s.downloadedKeys)
    let byId = Dictionary(s.surahs.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    let items = rewayah.surahIds.compactMap { sid -> CPListItem? in
      guard let surah = byId[sid] else { return nil }
      let isDownloaded = downloaded.contains("\(reciter.id):\(rewayah.id):\(sid)")
      let item = CPListItem(
        text: "\(sid). \(surah.name)",
        detailText: isDownloaded ? "\(surah.translation) · Downloaded" : surah.translation,
        image: artwork(.surah(sid)))
      item.handler = { [weak self] _, completion in
        self?.play(["kind": "surah", "reciterId": reciter.id, "rewayatId": rewayah.id, "surahId": sid])
        completion()
      }
      return item
    }
    let shown = items.isEmpty ? [CPListItem(text: Self.nothingYet, detailText: nil)] : items
    interfaceController?.pushTemplate(
      listTemplate(title: reciter.name, sections: [CPListSection(items: shown)]), animated: true, completion: nil)
  }

  // MARK: Surahs

  /// One section per juz (each surah under the juz it starts in), so the list
  /// doubles as the Juz view.
  private func surahSections(_ s: CarSnapshot) -> [CPListSection] {
    let byId = Dictionary(s.surahs.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    return s.juz.compactMap { juz -> CPListSection? in
      let rows = juz.surahIds.compactMap { byId[$0] }.map(surahRow)
      guard !rows.isEmpty else { return nil }
      return CPListSection(items: rows, header: "Juz \(juz.number)", sectionIndexTitle: "\(juz.number)")
    }
  }

  private func surahRow(_ surah: CarSurah) -> CPListItem {
    let item = CPListItem(text: "\(surah.id). \(surah.name)", detailText: surah.translation, image: artwork(.surah(surah.id)))
    item.accessoryType = .disclosureIndicator
    item.handler = { [weak self] _, completion in
      self?.pushSurahReciters(surah.id)
      completion()
    }
    return item
  }

  private func pushSurahReciters(_ surahId: Int) {
    guard let s = CarBridge.shared.snapshot, let surah = s.surahs.first(where: { $0.id == surahId }) else { return }
    var items: [CPListItem] = []
    if let topId = s.topReciterId,
      let top = s.reciters.first(where: { $0.id == topId }),
      let rewayah = top.rewayat.first(where: { $0.surahIds.contains(surahId) })
    {
      let row = CPListItem(
        text: "Play with \(top.name)", detailText: rewayah.name, image: UIImage(systemName: "play.circle.fill"))
      row.handler = { [weak self] _, completion in
        self?.play(["kind": "surah", "reciterId": top.id, "rewayatId": rewayah.id, "surahId": surahId])
        completion()
      }
      items.append(row)
    }
    let choices = s.reciters.compactMap { r -> CPListItem? in
      guard let rewayah = r.rewayat.first(where: { $0.surahIds.contains(surahId) }) else { return nil }
      let item = CPListItem(
        text: r.name, detailText: r.rewayat.count > 1 ? rewayah.name : nil, image: artwork(r.artwork))
      item.handler = { [weak self] _, completion in
        self?.play(["kind": "surah", "reciterId": r.id, "rewayatId": rewayah.id, "surahId": surahId])
        completion()
      }
      return item
    }
    var sections: [CPListSection] = []
    if !items.isEmpty { sections.append(CPListSection(items: items)) }
    if !choices.isEmpty { sections.append(CPListSection(items: choices, header: "Choose reciter", sectionIndexTitle: nil)) }
    if sections.isEmpty { sections.append(CPListSection(items: [CPListItem(text: Self.nothingYet, detailText: nil)])) }
    interfaceController?.pushTemplate(listTemplate(title: surah.name, sections: sections), animated: true, completion: nil)
  }

  // MARK: Image refresh coalescing

  private func refreshSoon() {
    guard !refreshScheduled else { return }
    refreshScheduled = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
      guard let self else { return }
      self.refreshScheduled = false
      self.refresh()
    }
  }
}
