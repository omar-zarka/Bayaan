import Foundation

enum CarArtwork: Decodable {
  case surah(Int)
  case url(String)
  case asset(String)
  case monogram(label: String, hex: String)
  case color(label: String, hex: String)

  private enum Keys: String, CodingKey { case kind, surahId, url, uri, label, hex }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    switch try c.decode(String.self, forKey: .kind) {
    case "surah": self = .surah(try c.decode(Int.self, forKey: .surahId))
    case "url": self = .url(try c.decode(String.self, forKey: .url))
    case "asset": self = .asset(try c.decode(String.self, forKey: .uri))
    case "monogram":
      self = .monogram(label: try c.decode(String.self, forKey: .label), hex: try c.decode(String.self, forKey: .hex))
    default:
      self = .color(label: try c.decode(String.self, forKey: .label), hex: try c.decode(String.self, forKey: .hex))
    }
  }
}

/// Requests stay as raw JSON objects: native never interprets them, it only
/// forwards them to JS.
struct RawJSON: Decodable {
  let value: [String: Any]
  init(from decoder: Decoder) throws {
    let any = try AnyDecodable(from: decoder).value
    value = (any as? [String: Any]) ?? [:]
  }
}

struct AnyDecodable: Decodable {
  let value: Any
  init(from decoder: Decoder) throws {
    let c = try decoder.singleValueContainer()
    if let v = try? c.decode(Bool.self) { value = v }
    else if let v = try? c.decode(Int.self) { value = v }
    else if let v = try? c.decode(Double.self) { value = v }
    else if let v = try? c.decode(String.self) { value = v }
    else if let v = try? c.decode([String: AnyDecodable].self) { value = v.mapValues { $0.value } }
    else if let v = try? c.decode([AnyDecodable].self) { value = v.map { $0.value } }
    else { value = NSNull() }
  }
}

enum CarItemAction: Decodable {
  case play(RawJSON)
  case browseList(String)
  case browseReciter(String)
  case browseSurahReciters(Int)

  private enum Keys: String, CodingKey { case kind, request, target }
  private enum TargetKeys: String, CodingKey { case kind, listId, reciterId, surahId }

  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: Keys.self)
    if try c.decode(String.self, forKey: .kind) == "play" {
      self = .play(try c.decode(RawJSON.self, forKey: .request))
      return
    }
    let t = try c.nestedContainer(keyedBy: TargetKeys.self, forKey: .target)
    switch try t.decode(String.self, forKey: .kind) {
    case "reciter": self = .browseReciter(try t.decode(String.self, forKey: .reciterId))
    case "surahReciters": self = .browseSurahReciters(try t.decode(Int.self, forKey: .surahId))
    default: self = .browseList(try t.decode(String.self, forKey: .listId))
    }
  }
}

struct CarItem: Decodable {
  let id: String
  let title: String
  let subtitle: String?
  let artwork: CarArtwork
  let progress: Double?
  let isDownloaded: Bool?
  let action: CarItemAction
}

struct CarSection: Decodable {
  let id: String
  let title: String
  let style: String
  let items: [CarItem]
}

struct CarList: Decodable {
  let id: String
  let title: String
  let items: [CarItem]
}

struct CarRewayah: Decodable {
  let id: String
  let name: String
  let style: String
  let surahIds: [Int]
}

struct CarReciter: Decodable {
  let id: String
  let name: String
  let artwork: CarArtwork
  let isFavorite: Bool
  let rewayat: [CarRewayah]
}

struct CarSurah: Decodable {
  let id: Int
  let name: String
  let nameArabic: String
  let translation: String
  let versesCount: Int
}

struct CarHome: Decodable {
  let quickStart: [CarItem]
  let sections: [CarSection]
}

struct CarJuz: Decodable {
  let number: Int
  let surahIds: [Int]
}

struct CarSnapshot: Decodable {
  let version: Int
  let generatedAt: String?
  let topReciterId: String?
  let home: CarHome
  let library: [CarItem]
  let lists: [String: CarList]
  let reciters: [CarReciter]
  let surahs: [CarSurah]
  let juz: [CarJuz]
  let downloadedKeys: [String]
}

struct CarQueueEntry: Decodable {
  let title: String
  let subtitle: String
  let surahId: Int?
}

struct CarNowPlaying: Decodable {
  let title: String
  let subtitle: String
  let reciterId: String?
  let surahId: Int?
  let isPlaying: Bool
  let position: Double
  let duration: Double
  let rate: Double
  let repeatMode: String
  let isLoved: Bool
  let artwork: CarArtwork?
  let queue: [CarQueueEntry]
  let currentIndex: Int
}
