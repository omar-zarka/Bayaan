#!/usr/bin/env node
/**
 * Pre-archive sanity check: assert that the version+build values in
 * `app.config.ts` (via generate-version.js), the iOS `Info.plist`, and
 * `android/app/build.gradle` all agree.
 *
 * Why: version drift between source-of-truth (`app.config.ts`) and the
 * committed native files happens silently — `expo prebuild` regenerates
 * native dirs from the config, but if you bump the config and forget to
 * re-prebuild (or commit the prebuild output to a separate branch), the
 * archive will ship with stale version metadata. Apple rejects uploads
 * whose `CFBundleShortVersionString` is below a previously-shipped value,
 * and Play Store rejects builds with stale `versionCode`. Catching this
 * at archive time costs an extra build cycle.
 *
 * Run as the FIRST step in the iOS archive helper. Exits non-zero if any
 * of the 3 sources disagree, with a clear report and either suggested
 * sed commands (default) or auto-applied fixes (`--fix`).
 *
 * Usage:
 *   node scripts/verify-version-sync.js          # check-only; exit 1 on drift
 *   node scripts/verify-version-sync.js --fix    # auto-patch native files to match source
 *
 * Exit codes:
 *   0 — all 3 in sync (after --fix, this means the patch succeeded)
 *   1 — mismatch (without --fix; with --fix, only if patch failed)
 *   2 — parse error in one of the inputs
 *
 * Fork-agnostic: scans `ios/*\/Info.plist` rather than hardcoding the app name.
 *
 * Standing rule: sync the WORKING TREE (sed-patch Info.plist + build.gradle),
 * archive, THEN commit. Committing the sync first bumps the git-rev-list
 * commit count by 1, leaving native files 1 behind the new source-of-truth
 * at archive time. The `--fix` flag here makes the working-tree patch
 * idempotent and one-shot.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const args = process.argv.slice(2);
const FIX = args.includes('--fix');

function readVersionFromGenerator() {
  const {execFileSync} = require('child_process');
  // `--json-only` makes generate-version.js write only the JSON document,
  // no header. Avoids regex-extracting `{...}` from interleaved log output,
  // which would silently parse the wrong object if the generator ever logs
  // a JSON-shaped line before the result. See PR #251 review.
  const out = execFileSync(
    'node',
    [path.join(__dirname, 'generate-version.js'), '--json-only'],
    {encoding: 'utf8'},
  );
  const json = JSON.parse(out);
  return {
    semanticVersion: json.semanticVersion,
    buildNumber: String(json.buildNumber),
  };
}

function findInfoPlistPath() {
  const iosDir = path.join(REPO, 'ios');
  if (!fs.existsSync(iosDir)) return null;
  // Scan top-level ios/<AppName>/Info.plist (matches what `expo prebuild`
  // emits regardless of the chosen app name).
  for (const entry of fs.readdirSync(iosDir, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(iosDir, entry.name, 'Info.plist');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function readVersionFromInfoPlist() {
  const p = findInfoPlistPath();
  if (!p) {
    throw new Error(
      'Could not find ios/<App>/Info.plist — has `expo prebuild` run yet?',
    );
  }
  const text = fs.readFileSync(p, 'utf8');
  const semantic =
    /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(
      text,
    );
  const build =
    /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/.exec(text);
  if (!semantic || !build) {
    throw new Error(`Could not parse version from ${p}`);
  }
  return {semanticVersion: semantic[1], buildNumber: build[1], path: p};
}

function readVersionFromAndroidGradle() {
  const p = path.join(REPO, 'android/app/build.gradle');
  if (!fs.existsSync(p)) {
    throw new Error(
      `Could not find ${p} — has \`expo prebuild\` run yet?`,
    );
  }
  const text = fs.readFileSync(p, 'utf8');
  const versionName = /versionName\s+"([^"]+)"/.exec(text);
  const versionCode = /versionCode\s+(\d+)/.exec(text);
  if (!versionName || !versionCode) {
    throw new Error(`Could not parse version from ${p}`);
  }
  return {
    semanticVersion: versionName[1],
    buildNumber: versionCode[1],
    path: p,
  };
}

function patchInfoPlist(p, current, target) {
  let text = fs.readFileSync(p, 'utf8');
  if (current.semanticVersion !== target.semanticVersion) {
    text = text.replace(
      /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]+<\/string>/,
      `<key>CFBundleShortVersionString</key>\n\t<string>${target.semanticVersion}</string>`,
    );
  }
  if (current.buildNumber !== target.buildNumber) {
    text = text.replace(
      /<key>CFBundleVersion<\/key>\s*<string>[^<]+<\/string>/,
      `<key>CFBundleVersion</key>\n\t<string>${target.buildNumber}</string>`,
    );
  }
  fs.writeFileSync(p, text, 'utf8');
}

function patchAndroidGradle(p, current, target) {
  let text = fs.readFileSync(p, 'utf8');
  if (current.semanticVersion !== target.semanticVersion) {
    text = text.replace(
      /versionName\s+"[^"]+"/,
      `versionName "${target.semanticVersion}"`,
    );
  }
  if (current.buildNumber !== target.buildNumber) {
    text = text.replace(
      /versionCode\s+\d+/,
      `versionCode ${target.buildNumber}`,
    );
  }
  fs.writeFileSync(p, text, 'utf8');
}

function main() {
  let truth, ios, android;
  try {
    truth = readVersionFromGenerator();
  } catch (e) {
    console.error('FATAL: generate-version.js failed:', e.message);
    process.exit(2);
  }
  try {
    ios = readVersionFromInfoPlist();
  } catch (e) {
    console.error('FATAL:', e.message);
    process.exit(2);
  }
  try {
    android = readVersionFromAndroidGradle();
  } catch (e) {
    console.error('FATAL:', e.message);
    process.exit(2);
  }

  const truthPair = `${truth.semanticVersion}/${truth.buildNumber}`;
  const iosPair = `${ios.semanticVersion}/${ios.buildNumber}`;
  const androidPair = `${android.semanticVersion}/${android.buildNumber}`;
  const allMatch = truthPair === iosPair && truthPair === androidPair;

  console.log('Version sync check:');
  console.log(
    `  Source of truth (app.config.ts via generate-version.js): ${truthPair}`,
  );
  console.log(`  iOS ${ios.path}: ${iosPair}`);
  console.log(`  Android ${android.path}: ${androidPair}`);

  if (allMatch) {
    console.log('\n✓ All three sources agree.');
    process.exit(0);
  }

  if (FIX) {
    console.log('\n--fix: patching working tree to match source-of-truth…');
    if (iosPair !== truthPair) {
      patchInfoPlist(ios.path, ios, truth);
      console.log(`  ✓ ${ios.path} → ${truthPair}`);
    }
    if (androidPair !== truthPair) {
      patchAndroidGradle(android.path, android, truth);
      console.log(`  ✓ ${android.path} → ${truthPair}`);
    }
    // Re-verify so we report the post-fix state authoritatively.
    const iosAfter = readVersionFromInfoPlist();
    const androidAfter = readVersionFromAndroidGradle();
    const iosAfterPair = `${iosAfter.semanticVersion}/${iosAfter.buildNumber}`;
    const androidAfterPair = `${androidAfter.semanticVersion}/${androidAfter.buildNumber}`;
    if (iosAfterPair === truthPair && androidAfterPair === truthPair) {
      console.log('\n✓ Working tree now in sync.');
      console.log(
        'Standing rule: archive BEFORE committing the version sync. ' +
          'Committing first bumps the build count and re-introduces drift.',
      );
      process.exit(0);
    }
    console.error('\n✗ Patch failed — manual fix needed.');
    console.error(`  iOS now: ${iosAfterPair}`);
    console.error(`  Android now: ${androidAfterPair}`);
    process.exit(1);
  }

  console.error('\n✗ MISMATCH detected. The 3 version sources disagree.');
  console.error('\nFix:');
  if (iosPair !== truthPair) {
    console.error(
      `  ${ios.path} needs CFBundleShortVersionString=${truth.semanticVersion}, CFBundleVersion=${truth.buildNumber}`,
    );
    console.error(
      `    sed -i '' 's|<string>${ios.semanticVersion}</string>|<string>${truth.semanticVersion}</string>|' ${ios.path}`,
    );
    console.error(
      `    sed -i '' 's|<string>${ios.buildNumber}</string>|<string>${truth.buildNumber}</string>|' ${ios.path}`,
    );
  }
  if (androidPair !== truthPair) {
    console.error(
      `  ${android.path} needs versionName "${truth.semanticVersion}", versionCode ${truth.buildNumber}`,
    );
    console.error(
      `    sed -i '' 's|versionName "${android.semanticVersion}"|versionName "${truth.semanticVersion}"|' ${android.path}`,
    );
    console.error(
      `    sed -i '' 's|versionCode ${android.buildNumber}|versionCode ${truth.buildNumber}|' ${android.path}`,
    );
  }
  console.error(
    '\nOr re-run with `--fix` to auto-patch the working tree:',
  );
  console.error('  node scripts/verify-version-sync.js --fix');
  console.error(
    '\nThen archive (do NOT commit yet — committing first bumps the build count and re-introduces drift).',
  );
  process.exit(1);
}

main();
