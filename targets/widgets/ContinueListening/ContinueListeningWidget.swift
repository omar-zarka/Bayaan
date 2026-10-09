// targets/widgets/ContinueListening/ContinueListeningWidget.swift
import SwiftUI
import WidgetKit

struct ContinueListeningEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
}

struct ContinueListeningProvider: TimelineProvider {
  func placeholder(in context: Context) -> ContinueListeningEntry {
    ContinueListeningEntry(date: .now, snapshot: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (ContinueListeningEntry) -> Void) {
    completion(ContinueListeningEntry(date: .now, snapshot: SnapshotStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<ContinueListeningEntry>) -> Void) {
    // App pushes reloads on change; no polling.
    completion(Timeline(entries: [ContinueListeningEntry(date: .now, snapshot: SnapshotStore.load())],
                        policy: .never))
  }
}

struct ContinueListeningWidget: Widget {
  let kind = "ContinueListening"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ContinueListeningProvider()) { entry in
      ContinueListeningView(entry: entry)
    }
    .configurationDisplayName("Continue Listening")
    .description("Pick up where you left off.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}
