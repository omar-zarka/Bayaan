// targets/widgets/ContentWidgets.swift
import SwiftUI
import WidgetKit

/// Phase 3 widgets, nested because a WidgetBundleBuilder takes at most 10 children (P3-R16).
struct ContentWidgets: WidgetBundle {
  var body: some Widget {
    RecentlyPlayedWidget()
    LibraryShelfWidget()
    BedtimeWidget()
    ReciterSpotlightWidget()
    AdhkarWidget()
    HijriDateWidget()
    OccasionWidget()
    BayaanNowWidget()
  }
}
