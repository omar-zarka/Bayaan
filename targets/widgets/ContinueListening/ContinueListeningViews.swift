// targets/widgets/ContinueListening/ContinueListeningViews.swift
import AppIntents
import SwiftUI
import WidgetKit

private let deepLinkPlayer = URL(string: "bayaan://player")!

struct ContinueListeningView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ContinueListeningEntry

  private var current: WidgetTrack? {
    entry.snapshot?.nowPlaying?.track ?? entry.snapshot?.recent.first ?? entry.snapshot?.upNext.first
  }

  var body: some View {
    Group {
      if let track = current {
        switch family {
        case .systemSmall:
          SmallView(track: track, nowPlaying: entry.snapshot?.nowPlaying,
                    generatedAt: entry.snapshot?.generatedAt ?? 0)
        case .systemMedium:
          MediumView(track: track, nowPlaying: entry.snapshot?.nowPlaying,
                     generatedAt: entry.snapshot?.generatedAt ?? 0,
                     side: sideList(limit: 3))
        default:
          LargeView(track: track, nowPlaying: entry.snapshot?.nowPlaying,
                    rows: sideList(limit: 6))
        }
      } else {
        EmptyStateView()
      }
    }
    .containerBackground(for: .widget) {
      (ArtworkTint.color(for: current?.artworkFile) ?? Color("$widgetBackground"))
    }
    .widgetURL(deepLinkPlayer)
  }

  private func sideList(limit: Int) -> [WidgetTrack] {
    guard let s = entry.snapshot else { return [] }
    let source = s.upNext.isEmpty ? s.recent.dropFirst(s.nowPlaying == nil ? 1 : 0).map { $0 } : s.upNext
    return Array(source.prefix(limit))
  }
}

struct Artwork: View {
  let file: String?
  let size: CGFloat

  var body: some View {
    Group {
      if let image = SnapshotStore.artwork(file) {
        // widgetAccentedRenderingMode is iOS 18+; the extension targets iOS 17.
        if #available(iOS 18.0, *) {
          Image(uiImage: image).resizable().widgetAccentedRenderingMode(.fullColor)
        } else {
          Image(uiImage: image).resizable()
        }
      } else {
        RoundedRectangle(cornerRadius: size * 0.16).fill(.white.opacity(0.15))
      }
    }
    .aspectRatio(1, contentMode: .fill)
    .frame(width: size, height: size)
    .clipShape(RoundedRectangle(cornerRadius: size * 0.16, style: .continuous))
  }
}

struct PlayPauseButton: View {
  let isPlaying: Bool
  var body: some View {
    Button(intent: TogglePlaybackIntent()) {
      Image(systemName: isPlaying ? "pause.fill" : "play.fill")
        .font(.system(size: 16, weight: .bold))
        .foregroundStyle(.white)
        .frame(width: 34, height: 34)
        .background(.white.opacity(0.18), in: Circle())
    }
    .buttonStyle(.plain)
  }
}

struct TimeLeft: View {
  let nowPlaying: WidgetNowPlaying?
  let generatedAt: Double

  var body: some View {
    if let np = nowPlaying, np.durationSec > 0 {
      let start = Date(timeIntervalSince1970: generatedAt / 1000)
      let end = start.addingTimeInterval(np.durationSec - np.positionSec)
      if np.isPlaying {
        Text(timerInterval: Date.now...max(end, .now), countsDown: true)
          .monospacedDigit()
      } else {
        Text("\(Int((np.durationSec - np.positionSec) / 60)) min left")
      }
    }
  }
}

struct SmallView: View {
  let track: WidgetTrack
  let nowPlaying: WidgetNowPlaying?
  let generatedAt: Double

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .top) {
        Artwork(file: track.artworkFile, size: 58)
        Spacer()
        PlayPauseButton(isPlaying: nowPlaying?.isPlaying ?? false)
      }
      Spacer(minLength: 0)
      Text(track.surahName).font(.headline).lineLimit(1)
      HStack(spacing: 4) {
        Text(track.reciterName).lineLimit(1)
        TimeLeft(nowPlaying: nowPlaying, generatedAt: generatedAt)
      }
      .font(.caption).opacity(0.75)
    }
    .foregroundStyle(.white)
    .padding(14)
  }
}

struct MediumView: View {
  let track: WidgetTrack
  let nowPlaying: WidgetNowPlaying?
  let generatedAt: Double
  let side: [WidgetTrack]

  var body: some View {
    HStack(spacing: 14) {
      VStack(alignment: .leading, spacing: 6) {
        Artwork(file: track.artworkFile, size: 64)
        Spacer(minLength: 0)
        Text(track.surahName).font(.headline).lineLimit(1)
        Text(track.reciterName).font(.caption).opacity(0.75).lineLimit(1)
        HStack {
          PlayPauseButton(isPlaying: nowPlaying?.isPlaying ?? false)
          TimeLeft(nowPlaying: nowPlaying, generatedAt: generatedAt).font(.caption2).opacity(0.75)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      VStack(alignment: .leading, spacing: 8) {
        ForEach(side, id: \.self) { t in TrackRow(track: t, artSize: 30) }
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .foregroundStyle(.white)
    .padding(14)
  }
}

struct LargeView: View {
  let track: WidgetTrack
  let nowPlaying: WidgetNowPlaying?
  let rows: [WidgetTrack]

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(spacing: 12) {
        Artwork(file: track.artworkFile, size: 76)
        VStack(alignment: .leading, spacing: 4) {
          Text(track.surahName).font(.title3.bold()).lineLimit(1)
          Text(track.reciterName).font(.subheadline).opacity(0.75).lineLimit(1)
        }
        Spacer()
        PlayPauseButton(isPlaying: nowPlaying?.isPlaying ?? false)
      }
      Divider().overlay(.white.opacity(0.2))
      ForEach(rows, id: \.self) { t in TrackRow(track: t, artSize: 36) }
      Spacer(minLength: 0)
    }
    .foregroundStyle(.white)
    .padding(16)
  }
}

struct TrackRow: View {
  let track: WidgetTrack
  let artSize: CGFloat

  var body: some View {
    Button(intent: PlayTrackIntent(surahId: track.surahId, reciterId: track.reciterId,
                                   rewayatId: track.rewayatId)) {
      HStack(spacing: 8) {
        Artwork(file: track.artworkFile, size: artSize)
        VStack(alignment: .leading, spacing: 1) {
          Text(track.surahName).font(.caption.weight(.semibold)).lineLimit(1)
          Text(track.reciterName).font(.caption2).opacity(0.7).lineLimit(1)
        }
      }
    }
    .buttonStyle(.plain)
    .disabled(track.isUserUpload || track.surahId == 0)
  }
}

struct EmptyStateView: View {
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "headphones").font(.title2)
      Text("Start listening").font(.caption.weight(.semibold))
    }
    .foregroundStyle(Color("$accent"))
  }
}

// MARK: - Previews

// Inline copy of modules/bayaan-widgets/src/__fixtures__/snapshot.full.json.
private let previewFullSnapshotJSON = #"""
{
  "version": 1,
  "generatedAt": 1791460800000,
  "theme": "dark",
  "nowPlaying": {
    "track": {
      "surahId": 18,
      "surahName": "Al-Kahf",
      "reciterId": "r-alafasi",
      "reciterName": "Mishary Alafasi",
      "rewayatId": "rw-1",
      "artworkFile": "reciter-r-alafasi.jpg",
      "isUserUpload": false
    },
    "isPlaying": true,
    "positionSec": 120.5,
    "durationSec": 1800
  },
  "upNext": [
    {
      "surahId": 36,
      "surahName": "Ya-Sin",
      "reciterId": "r-alafasi",
      "reciterName": "Mishary Alafasi",
      "rewayatId": "rw-1",
      "artworkFile": "reciter-r-alafasi.jpg",
      "isUserUpload": false
    }
  ],
  "recent": [],
  "defaultReciter": {
    "id": "r-alafasi",
    "name": "Mishary Alafasi",
    "artworkFile": "reciter-r-alafasi.jpg"
  },
  "reciterRecents": {},
  "lastRead": {
    "page": 293,
    "surahId": 18,
    "surahName": "Al-Kahf",
    "juz": 15,
    "openingText": "ٱلْحَمْدُ لِلَّهِ"
  },
  "tasbeeh": {
    "tasbeeh-subhanallah": {"count": 12, "target": 33, "day": "2026-10-08"}
  }
}
"""#

private let previewPlaying = WidgetSnapshot.decode(Data(previewFullSnapshotJSON.utf8))

#Preview("Small", as: .systemSmall) {
  ContinueListeningWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: previewPlaying)
  ContinueListeningEntry(date: .now, snapshot: nil)
}

#Preview("Medium", as: .systemMedium) {
  ContinueListeningWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: previewPlaying)
  ContinueListeningEntry(date: .now, snapshot: nil)
}

#Preview("Large", as: .systemLarge) {
  ContinueListeningWidget()
} timeline: {
  ContinueListeningEntry(date: .now, snapshot: previewPlaying)
  ContinueListeningEntry(date: .now, snapshot: nil)
}
