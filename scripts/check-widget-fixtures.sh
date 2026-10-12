#!/usr/bin/env bash
# Decodes the widget snapshot fixtures with the Swift Codable models used by
# the iOS widget extension, so the TS schema and Swift decoders stay in sync.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat "$root/targets/widgets/_shared/WidgetSnapshot.swift" > "$tmp/decode-test.swift"
cat >> "$tmp/decode-test.swift" <<'SWIFT'
let dir = CommandLine.arguments[1]
for name in ["snapshot.full.json", "snapshot.empty.json"] {
  let data = try! Data(contentsOf: URL(fileURLWithPath: "\(dir)/\(name)"))
  precondition(WidgetSnapshot.decode(data) != nil, "failed to decode \(name)")
}
var bumped = try! String(contentsOfFile: "\(dir)/snapshot.full.json", encoding: .utf8)
bumped = bumped.replacingOccurrences(of: "\"version\": 1", with: "\"version\": 2")
precondition(WidgetSnapshot.decode(bumped.data(using: .utf8)!) == nil, "accepted future version")
print("swift fixture decode: OK")
SWIFT

swift "$tmp/decode-test.swift" "$root/modules/bayaan-widgets/src/__fixtures__"
