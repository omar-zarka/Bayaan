// targets/widgets/_shared/AppIdentity.swift
import Foundation

/// Deep links into the app. The scheme is the `BayaanURLScheme` Info.plist key,
/// which plugins/withBayaanWidgets.js sets from app.config.js `scheme` in both
/// the app and the widget extension (RFC-021).
enum AppLinks {
  /// Used only when the Info.plist key is missing, unexpanded or invalid.
  static let fallbackScheme = "bayaan"

  static var scheme: String {
    guard let raw = Bundle.main.object(forInfoDictionaryKey: "BayaanURLScheme") as? String else {
      return fallbackScheme
    }
    let value = raw.trimmingCharacters(in: .whitespaces)
    return isValidScheme(value) ? value : fallbackScheme
  }

  /// `path` has no leading slash: "player", "quran/18?ayah=10", or "" for the app root.
  static func url(_ path: String) -> URL? {
    URL(string: "\(scheme)://\(path)")
  }

  private static func isValidScheme(_ value: String) -> Bool {
    guard let first = value.unicodeScalars.first, CharacterSet.letters.contains(first) else { return false }
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "+-."))
    return value.unicodeScalars.allSatisfy { $0.isASCII && allowed.contains($0) }
  }
}
