// targets/widgets/Support/Entities.swift
import AppIntents
import Foundation

struct SurahEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Surah")
  static var defaultQuery = SurahEntityQuery()

  let id: Int
  let name: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(id). \(name)")
  }

  init(_ surah: StaticSurah) {
    id = surah.id
    name = surah.name
  }
}

struct SurahEntityQuery: EntityStringQuery {
  func entities(for identifiers: [Int]) async throws -> [SurahEntity] {
    identifiers.compactMap { StaticData.surah($0).map(SurahEntity.init) }
  }

  func suggestedEntities() async throws -> [SurahEntity] {
    StaticData.surahs.map(SurahEntity.init)
  }

  func entities(matching string: String) async throws -> [SurahEntity] {
    let q = string.lowercased().trimmingCharacters(in: .whitespaces)
    return StaticData.surahs.filter {
      $0.name.lowercased().contains(q) || $0.translatedName.lowercased().contains(q) || String($0.id) == q
    }.map(SurahEntity.init)
  }
}

struct ReciterEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Reciter")
  static var defaultQuery = ReciterEntityQuery()

  let id: String
  let name: String

  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

struct ReciterEntityQuery: EntityStringQuery {
  private var reciters: [WidgetCatalogReciter] { CatalogStore.load()?.reciters ?? [] }

  // Unknown ids stay resolvable so the widget can say the reciter is unavailable.
  func entities(for identifiers: [String]) async throws -> [ReciterEntity] {
    let all = reciters
    return identifiers.map { id in
      all.first { $0.id == id }.map { ReciterEntity(id: $0.id, name: $0.name) }
        ?? ReciterEntity(id: id, name: "Unavailable reciter")
    }
  }

  func suggestedEntities() async throws -> [ReciterEntity] {
    reciters.map { ReciterEntity(id: $0.id, name: $0.name) }
  }

  func entities(matching string: String) async throws -> [ReciterEntity] {
    let q = string.lowercased()
    return reciters.filter { $0.name.lowercased().contains(q) }
      .map { ReciterEntity(id: $0.id, name: $0.name) }
  }
}

struct DhikrEntity: AppEntity {
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Dhikr")
  static var defaultQuery = DhikrEntityQuery()

  let id: String
  let arabic: String
  let translation: String?

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(translation ?? arabic)", subtitle: "\(arabic)")
  }

  init(_ dhikr: WidgetCatalogDhikr) {
    id = dhikr.id
    arabic = dhikr.arabic
    translation = dhikr.translation
  }
}

struct DhikrEntityQuery: EntityStringQuery {
  private var adhkar: [WidgetCatalogDhikr] { CatalogStore.load()?.adhkar ?? [] }

  func entities(for identifiers: [String]) async throws -> [DhikrEntity] {
    let all = adhkar
    return identifiers.compactMap { id in all.first { $0.id == id }.map(DhikrEntity.init) }
  }

  func suggestedEntities() async throws -> [DhikrEntity] { adhkar.map(DhikrEntity.init) }

  func entities(matching string: String) async throws -> [DhikrEntity] {
    let q = string.lowercased()
    return adhkar.filter {
      $0.arabic.contains(string) || ($0.translation?.lowercased().contains(q) ?? false)
    }.map(DhikrEntity.init)
  }
}
