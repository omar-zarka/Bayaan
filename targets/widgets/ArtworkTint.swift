// targets/widgets/ArtworkTint.swift
import CoreImage
import SwiftUI
import UIKit

enum ArtworkTint {
  private static var cache: [String: Color] = [:]
  private static let context = CIContext(options: [.workingColorSpace: NSNull()])

  /// Average artwork color, darkened so white text stays legible.
  static func color(for file: String?) -> Color? {
    guard let file else { return nil }
    if let hit = cache[file] { return hit }
    guard let image = SnapshotStore.artwork(file), let ci = CIImage(image: image),
          let filter = CIFilter(name: "CIAreaAverage", parameters: [
            kCIInputImageKey: ci, kCIInputExtentKey: CIVector(cgRect: ci.extent),
          ]),
          let output = filter.outputImage else { return nil }
    var px = [UInt8](repeating: 0, count: 4)
    context.render(output, toBitmap: &px, rowBytes: 4,
                   bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
                   format: .RGBA8, colorSpace: nil)
    var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    UIColor(red: CGFloat(px[0]) / 255, green: CGFloat(px[1]) / 255,
            blue: CGFloat(px[2]) / 255, alpha: 1).getHue(&h, saturation: &s, brightness: &b, alpha: &a)
    let color = Color(hue: h, saturation: min(s * 1.1, 0.8), brightness: min(b, 0.38))
    cache[file] = color
    return color
  }
}
