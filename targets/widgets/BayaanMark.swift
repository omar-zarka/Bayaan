// targets/widgets/BayaanMark.swift
import SwiftUI

/// The Bayaan starburst, drawn as strokes so it stays sharp at any size.
/// Coordinates match bayaan_mark.xml on Android (600 x 500 viewport).
struct BayaanMark: Shape {
  private static let center = CGPoint(x: 299, y: 293)
  private static let rays: [CGPoint] = [
    CGPoint(x: 299, y: 8), CGPoint(x: 299, y: 495), CGPoint(x: 12, y: 293), CGPoint(x: 586, y: 293),
    CGPoint(x: 190, y: 30), CGPoint(x: 409, y: 30), CGPoint(x: 96, y: 92), CGPoint(x: 498, y: 92),
    CGPoint(x: 37, y: 180), CGPoint(x: 564, y: 180), CGPoint(x: 159, y: 437), CGPoint(x: 442, y: 433),
  ]

  func path(in rect: CGRect) -> Path {
    let scale = min(rect.width / 600, rect.height / 500)
    let origin = CGPoint(x: rect.midX - 300 * scale, y: rect.midY - 250 * scale)
    func map(_ p: CGPoint) -> CGPoint { CGPoint(x: origin.x + p.x * scale, y: origin.y + p.y * scale) }
    var path = Path()
    for ray in Self.rays {
      path.move(to: map(Self.center))
      path.addLine(to: map(ray))
    }
    return path.strokedPath(StrokeStyle(lineWidth: 36 * scale, lineCap: .butt))
  }
}

/// Corner logo shown on every Continue Listening size.
struct BayaanLogo: View {
  var size: CGFloat = 16
  var body: some View {
    BayaanMark()
      .fill(.white.opacity(0.9))
      .frame(width: size * 1.2, height: size)
      .accessibilityHidden(true)
  }
}
