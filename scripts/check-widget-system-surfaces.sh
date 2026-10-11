#!/usr/bin/env bash
# Phase 2 Swift checks: files that must stay identical between the module pod
# and the widget extension, the Live Activity fixture decode, and pure logic
# compiled into the app and the extension.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fixtures="$root/modules/bayaan-widgets/src/__fixtures__"

cmp "$root/modules/bayaan-widgets/ios/NowPlayingActivityState.swift" \
    "$root/targets/widgets/LiveActivity/NowPlayingActivityState.swift"
cmp "$root/modules/bayaan-widgets/ios/NowPlayingAttributes.swift" \
    "$root/targets/widgets/LiveActivity/NowPlayingAttributes.swift"

cat "$root/targets/widgets/LiveActivity/NowPlayingActivityState.swift" > "$tmp/surfaces-test.swift"
cat >> "$tmp/surfaces-test.swift" <<'SWIFT'
let dir = CommandLine.arguments[1]
func load(_ path: String) -> Data { try! Data(contentsOf: URL(fileURLWithPath: path)) }

// Live Activity content state (same vectors as liveActivity.test.ts)
let states = try! JSONDecoder().decode([NowPlayingActivityState].self, from: load("\(dir)/liveActivity.states.json"))
precondition(states.count == 2 && states[0].ayah?.number == 10 && states[0].ayah?.count == 110, "state decode")
precondition(states[1].ayah == nil && states[1].artworkFile == nil, "nulls decode")
precondition(states[0].wallStart.timeIntervalSince1970 == 1_791_460_679.5, "wallStart")
precondition(states[0].wallEnd.timeIntervalSince1970 == 1_791_462_479.5, "wallEnd")
precondition(states[1].wallStart.timeIntervalSince1970 == 1_791_460_200, "wallStart rate 1.5")
precondition(states[1].wallEnd.timeIntervalSince1970 == 1_791_461_400, "wallEnd rate 1.5")
precondition(states[1].fraction == 0.5 && states[1].remainingWallSec == 600, "paused fraction")
print("swift system surfaces: OK")
SWIFT

swift "$tmp/surfaces-test.swift" "$fixtures"
