/**
 * Unit tests for the pure functions in scripts/verify-version-sync.js.
 *
 * `main()` and CLI argv parsing aren't tested here — they're thin glue
 * over the functions covered below. The functions are the load-bearing
 * surface (file discovery, parsing, patching of release-critical native
 * files), so they get explicit coverage per PR #251 review.
 *
 * All tests use temp-dir fixtures (no I/O outside `os.tmpdir()`).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  findInfoPlistPath,
  readVersionFromInfoPlist,
  readVersionFromAndroidGradle,
  patchInfoPlist,
  patchAndroidGradle,
} = require('../verify-version-sync');

/**
 * Make a fresh temp directory for each test. Caller writes a fake project
 * tree under it, then passes the path as `repoRoot` to the function under
 * test. afterEach() cleans up.
 */
let tmpRoot;
beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-version-sync-'));
});
afterEach(() => {
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, {recursive: true, force: true});
  }
});

function writeFile(rel, contents) {
  const abs = path.join(tmpRoot, rel);
  fs.mkdirSync(path.dirname(abs), {recursive: true});
  fs.writeFileSync(abs, contents, 'utf8');
  return abs;
}

// Realistic Info.plist fixture — tab-indented, mirroring expo-prebuild output.
// Includes multiple <string>X</string> entries so the patch regex's anchoring
// to <key>CFBundle...</key> can be verified.
const SAMPLE_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleDevelopmentRegion</key>
\t<string>en</string>
\t<key>CFBundleDisplayName</key>
\t<string>Bayaan</string>
\t<key>CFBundleShortVersionString</key>
\t<string>2.2.0</string>
\t<key>CFBundleSignature</key>
\t<string>????</string>
\t<key>CFBundleVersion</key>
\t<string>698</string>
\t<key>NSCameraUsageDescription</key>
\t<string>2.2.0</string>
</dict>
</plist>
`;

const SAMPLE_GRADLE = `apply plugin: "com.android.application"

android {
    namespace 'com.bayaan.app'
    defaultConfig {
        applicationId 'com.bayaan.app'
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 698
        versionName "2.2.0"
    }
}
`;

// =====================================================================
// findInfoPlistPath
// =====================================================================
describe('findInfoPlistPath', () => {
  it('returns null when ios/ does not exist', () => {
    expect(findInfoPlistPath(tmpRoot)).toBeNull();
  });

  it('returns null when ios/ exists but no app target has Info.plist', () => {
    fs.mkdirSync(path.join(tmpRoot, 'ios'));
    expect(findInfoPlistPath(tmpRoot)).toBeNull();
  });

  it('finds the single app-target Info.plist', () => {
    writeFile('ios/Bayaan/Info.plist', SAMPLE_PLIST);
    expect(findInfoPlistPath(tmpRoot)).toBe(
      path.join(tmpRoot, 'ios/Bayaan/Info.plist'),
    );
  });

  it('skips test target plists (BayaanTests/, BayaanUITests/)', () => {
    // The bug PR #251 review highlighted: readdirSync filesystem-order
    // could pick BayaanTests/Info.plist before Bayaan/Info.plist, silently
    // patching the test bundle's version. Filtering by suffix prevents it.
    writeFile('ios/BayaanTests/Info.plist', SAMPLE_PLIST);
    writeFile('ios/BayaanUITests/Info.plist', SAMPLE_PLIST);
    writeFile('ios/Bayaan/Info.plist', SAMPLE_PLIST);
    expect(findInfoPlistPath(tmpRoot)).toBe(
      path.join(tmpRoot, 'ios/Bayaan/Info.plist'),
    );
  });

  it('skips Pods/, build/, .xcodeproj, .xcworkspace', () => {
    writeFile('ios/Pods/Info.plist', SAMPLE_PLIST);
    writeFile('ios/build/Info.plist', SAMPLE_PLIST);
    writeFile('ios/Bayaan.xcodeproj/Info.plist', SAMPLE_PLIST);
    writeFile('ios/Bayaan.xcworkspace/Info.plist', SAMPLE_PLIST);
    writeFile('ios/Bayaan/Info.plist', SAMPLE_PLIST);
    expect(findInfoPlistPath(tmpRoot)).toBe(
      path.join(tmpRoot, 'ios/Bayaan/Info.plist'),
    );
  });

  it('skips share extension targets (*Extension, *Widget)', () => {
    writeFile('ios/ShareExtension/Info.plist', SAMPLE_PLIST);
    writeFile('ios/MyAppWidget/Info.plist', SAMPLE_PLIST);
    writeFile('ios/Bayaan/Info.plist', SAMPLE_PLIST);
    expect(findInfoPlistPath(tmpRoot)).toBe(
      path.join(tmpRoot, 'ios/Bayaan/Info.plist'),
    );
  });

  it('throws (not picks arbitrarily) when multiple app candidates remain', () => {
    // Two non-test, non-extension plists — ambiguous. Better to fail loud.
    writeFile('ios/Bayaan/Info.plist', SAMPLE_PLIST);
    writeFile('ios/Qariah/Info.plist', SAMPLE_PLIST);
    expect(() => findInfoPlistPath(tmpRoot)).toThrow(/Ambiguous app target/);
  });
});

// =====================================================================
// readVersionFromInfoPlist
// =====================================================================
describe('readVersionFromInfoPlist', () => {
  it('parses CFBundleShortVersionString and CFBundleVersion', () => {
    writeFile('ios/Bayaan/Info.plist', SAMPLE_PLIST);
    const got = readVersionFromInfoPlist(tmpRoot);
    expect(got.semanticVersion).toBe('2.2.0');
    expect(got.buildNumber).toBe('698');
    expect(got.path).toBe(path.join(tmpRoot, 'ios/Bayaan/Info.plist'));
  });

  it('throws if Info.plist is missing', () => {
    expect(() => readVersionFromInfoPlist(tmpRoot)).toThrow(/Could not find/);
  });

  it('throws if Info.plist lacks CFBundleShortVersionString', () => {
    writeFile(
      'ios/Bayaan/Info.plist',
      SAMPLE_PLIST.replace(
        '<key>CFBundleShortVersionString</key>\n\t<string>2.2.0</string>',
        '',
      ),
    );
    expect(() => readVersionFromInfoPlist(tmpRoot)).toThrow(/Could not parse/);
  });
});

// =====================================================================
// readVersionFromAndroidGradle
// =====================================================================
describe('readVersionFromAndroidGradle', () => {
  it('parses versionName and versionCode', () => {
    writeFile('android/app/build.gradle', SAMPLE_GRADLE);
    const got = readVersionFromAndroidGradle(tmpRoot);
    expect(got.semanticVersion).toBe('2.2.0');
    expect(got.buildNumber).toBe('698');
    expect(got.path).toBe(path.join(tmpRoot, 'android/app/build.gradle'));
  });

  it('throws if build.gradle is missing', () => {
    expect(() => readVersionFromAndroidGradle(tmpRoot)).toThrow(
      /Could not find/,
    );
  });

  it('throws if build.gradle lacks versionCode', () => {
    writeFile(
      'android/app/build.gradle',
      SAMPLE_GRADLE.replace('versionCode 698\n', ''),
    );
    expect(() => readVersionFromAndroidGradle(tmpRoot)).toThrow(
      /Could not parse/,
    );
  });
});

// =====================================================================
// patchInfoPlist
// =====================================================================
describe('patchInfoPlist', () => {
  it('updates CFBundleShortVersionString and CFBundleVersion only', () => {
    const p = writeFile('ios/Bayaan/Info.plist', SAMPLE_PLIST);
    patchInfoPlist(
      p,
      {semanticVersion: '2.2.0', buildNumber: '698'},
      {semanticVersion: '3.1.0', buildNumber: '788'},
    );
    const after = fs.readFileSync(p, 'utf8');
    expect(after).toContain(
      '<key>CFBundleShortVersionString</key>\n\t<string>3.1.0</string>',
    );
    expect(after).toContain(
      '<key>CFBundleVersion</key>\n\t<string>788</string>',
    );
    // Critical: must NOT touch unrelated <string> entries that happen to
    // contain the same value (NSCameraUsageDescription is "2.2.0" in the
    // fixture). This is the collision the unsafe-sed comment was about.
    expect(after).toContain(
      '<key>NSCameraUsageDescription</key>\n\t<string>2.2.0</string>',
    );
  });

  it('is a no-op when current === target', () => {
    const p = writeFile('ios/Bayaan/Info.plist', SAMPLE_PLIST);
    patchInfoPlist(
      p,
      {semanticVersion: '2.2.0', buildNumber: '698'},
      {semanticVersion: '2.2.0', buildNumber: '698'},
    );
    expect(fs.readFileSync(p, 'utf8')).toBe(SAMPLE_PLIST);
  });

  it('updates only the changed field when one of two differs', () => {
    const p = writeFile('ios/Bayaan/Info.plist', SAMPLE_PLIST);
    patchInfoPlist(
      p,
      {semanticVersion: '2.2.0', buildNumber: '698'},
      {semanticVersion: '2.2.0', buildNumber: '699'}, // only buildNumber differs
    );
    const after = fs.readFileSync(p, 'utf8');
    expect(after).toContain('<string>2.2.0</string>'); // semantic unchanged
    expect(after).toContain(
      '<key>CFBundleVersion</key>\n\t<string>699</string>',
    );
    expect(after).not.toContain('<string>698</string>');
  });
});

// =====================================================================
// patchAndroidGradle
// =====================================================================
describe('patchAndroidGradle', () => {
  it('updates versionName and versionCode only', () => {
    const p = writeFile('android/app/build.gradle', SAMPLE_GRADLE);
    patchAndroidGradle(
      p,
      {semanticVersion: '2.2.0', buildNumber: '698'},
      {semanticVersion: '3.1.0', buildNumber: '788'},
    );
    const after = fs.readFileSync(p, 'utf8');
    expect(after).toContain('versionName "3.1.0"');
    expect(after).toContain('versionCode 788');
    // Sanity: didn't disturb minSdkVersion / targetSdkVersion etc.
    expect(after).toContain('minSdkVersion 24');
    expect(after).toContain('targetSdkVersion 34');
  });

  it('is a no-op when current === target', () => {
    const p = writeFile('android/app/build.gradle', SAMPLE_GRADLE);
    patchAndroidGradle(
      p,
      {semanticVersion: '2.2.0', buildNumber: '698'},
      {semanticVersion: '2.2.0', buildNumber: '698'},
    );
    expect(fs.readFileSync(p, 'utf8')).toBe(SAMPLE_GRADLE);
  });

  it('updates only the changed field when one of two differs', () => {
    const p = writeFile('android/app/build.gradle', SAMPLE_GRADLE);
    patchAndroidGradle(
      p,
      {semanticVersion: '2.2.0', buildNumber: '698'},
      {semanticVersion: '2.3.0', buildNumber: '698'}, // only semantic differs
    );
    const after = fs.readFileSync(p, 'utf8');
    expect(after).toContain('versionName "2.3.0"');
    expect(after).toContain('versionCode 698');
    expect(after).not.toContain('versionName "2.2.0"');
  });
});

// =====================================================================
// Round-trip — patch, then re-parse should return the patched values
// =====================================================================
describe('round-trip', () => {
  it('Info.plist: patch then re-read yields the new versions', () => {
    writeFile('ios/Bayaan/Info.plist', SAMPLE_PLIST);
    const before = readVersionFromInfoPlist(tmpRoot);
    patchInfoPlist(before.path, before, {
      semanticVersion: '4.0.0',
      buildNumber: '1000',
    });
    const after = readVersionFromInfoPlist(tmpRoot);
    expect(after.semanticVersion).toBe('4.0.0');
    expect(after.buildNumber).toBe('1000');
  });

  it('Android gradle: patch then re-read yields the new versions', () => {
    writeFile('android/app/build.gradle', SAMPLE_GRADLE);
    const before = readVersionFromAndroidGradle(tmpRoot);
    patchAndroidGradle(before.path, before, {
      semanticVersion: '4.0.0',
      buildNumber: '1000',
    });
    const after = readVersionFromAndroidGradle(tmpRoot);
    expect(after.semanticVersion).toBe('4.0.0');
    expect(after.buildNumber).toBe('1000');
  });
});
