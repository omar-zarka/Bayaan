// targets/widgets/LiveActivity/AdhkarSessionLiveActivity.swift
import ActivityKit
import SwiftUI
import WidgetKit

private let adhkarPlayingURL = AppLinks.url("adhkar-playing")!

/// Adhkar session Live Activity: Lock Screen (also StandBy) and Dynamic Island.
/// Started and updated by the app (AdhkarSessionActivityBridge). It has no
/// buttons; a tap opens the reader at the playing dhikr.
struct AdhkarSessionLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AdhkarSessionAttributes.self) { context in
      AdhkarLockScreenView(state: context.state)
        .activityBackgroundTint(WidgetPalette.background)
        .activitySystemActionForegroundColor(.white)
        .widgetURL(adhkarPlayingURL)
    } dynamicIsland: { context in
      let state = context.state
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          AdhkarBars(isPlaying: state.isPlaying, height: 22).padding(.leading, 8)
        }
        DynamicIslandExpandedRegion(.center) {
          AdhkarTitles(state: state)
        }
        DynamicIslandExpandedRegion(.trailing) {
          AdhkarPlayStateGlyph(isPlaying: state.isPlaying).padding(.trailing, 8)
        }
        DynamicIslandExpandedRegion(.bottom) {
          AdhkarPreview(text: state.preview, lines: 2).padding(.horizontal, 8)
        }
      } compactLeading: {
        AdhkarBars(isPlaying: state.isPlaying, height: 14)
      } compactTrailing: {
        Text(state.shortPositionLabel)
          .font(.caption2.monospacedDigit())
          .foregroundStyle(.white)
      } minimal: {
        AdhkarBars(isPlaying: state.isPlaying, height: 12)
      }
      .widgetURL(adhkarPlayingURL)
      .keylineTint(.white)
    }
  }
}

struct AdhkarLockScreenView: View {
  let state: AdhkarSessionActivityState

  var body: some View {
    VStack(spacing: 10) {
      HStack(spacing: 12) {
        AdhkarBars(isPlaying: state.isPlaying, height: 22)
        AdhkarTitles(state: state)
        AdhkarPlayStateGlyph(isPlaying: state.isPlaying)
      }
      AdhkarPreview(text: state.preview, lines: 2)
    }
    .padding(14)
    .overlay(alignment: .topTrailing) {
      BayaanLogo(size: 12).padding(8)
    }
  }
}

/// List title and "4 of 23".
struct AdhkarTitles: View {
  let state: AdhkarSessionActivityState

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(state.listTitle)
        .font(.headline)
        .foregroundStyle(.white)
        .lineLimit(1)
      Text(state.positionLabel)
        .font(.subheadline.monospacedDigit())
        .foregroundStyle(.white.opacity(0.75))
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// The current dhikr's opening, right to left, in Scheherazade like the
/// Adhkar widget.
struct AdhkarPreview: View {
  let text: String
  let lines: Int

  var body: some View {
    Text(text)
      .font(WidgetFonts.dhikr(18))
      .foregroundStyle(.white)
      .lineLimit(lines)
      .truncationMode(.tail)
      .multilineTextAlignment(.leading)
      .frame(maxWidth: .infinity, alignment: .leading)
      // Leading is the right edge here.
      .environment(\.layoutDirection, .rightToLeft)
  }
}

/// Shows the state, not an action: the activity has no buttons.
struct AdhkarPlayStateGlyph: View {
  let isPlaying: Bool

  var body: some View {
    Image(systemName: isPlaying ? "play.fill" : "pause.fill")
      .font(.system(size: 15, weight: .semibold))
      .foregroundStyle(.white.opacity(0.75))
      .frame(width: 28, height: 28)
      .accessibilityLabel(isPlaying ? "Playing" : "Paused")
  }
}

/// Three static bars, the app's playing indicator. Dimmed while paused.
struct AdhkarBars: View {
  let isPlaying: Bool
  let height: CGFloat

  private static let fractions: [CGFloat] = [0.55, 1, 0.75]

  var body: some View {
    HStack(alignment: .bottom, spacing: height * 0.14) {
      ForEach(Self.fractions.indices, id: \.self) { i in
        Capsule()
          .fill(.white.opacity(isPlaying ? 1 : 0.45))
          .frame(width: height * 0.2, height: height * Self.fractions[i])
      }
    }
    .frame(height: height, alignment: .bottom)
    .accessibilityHidden(true)
  }
}

private extension AdhkarSessionActivityState {
  static var previewPlaying: AdhkarSessionActivityState {
    AdhkarSessionActivityState(
      listTitle: "Morning Adhkar",
      preview: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ",
      position: 4, total: 23, isPlaying: true)
  }

  static var previewPaused: AdhkarSessionActivityState {
    AdhkarSessionActivityState(
      listTitle: "أذكار المساء",
      preview: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ",
      position: 23, total: 23, isPlaying: false)
  }
}

#Preview("Lock Screen", as: .content, using: AdhkarSessionAttributes()) {
  AdhkarSessionLiveActivity()
} contentStates: {
  AdhkarSessionActivityState.previewPlaying
  AdhkarSessionActivityState.previewPaused
}

#Preview("Expanded", as: .dynamicIsland(.expanded), using: AdhkarSessionAttributes()) {
  AdhkarSessionLiveActivity()
} contentStates: {
  AdhkarSessionActivityState.previewPlaying
}

#Preview("Compact", as: .dynamicIsland(.compact), using: AdhkarSessionAttributes()) {
  AdhkarSessionLiveActivity()
} contentStates: {
  AdhkarSessionActivityState.previewPlaying
  AdhkarSessionActivityState.previewPaused
}

#Preview("Minimal", as: .dynamicIsland(.minimal), using: AdhkarSessionAttributes()) {
  AdhkarSessionLiveActivity()
} contentStates: {
  AdhkarSessionActivityState.previewPlaying
}
