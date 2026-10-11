// targets/widgets/WidgetsBundle.swift
import SwiftUI
import WidgetKit

@main
struct BayaanWidgetsBundle: WidgetBundle {
  var body: some Widget {
    ContinueListeningWidget()
    QuickSurahWidget()
    PinnedReciterWidget()
    AyahOfTheDayWidget()
  }
}
