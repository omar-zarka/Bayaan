// plugins/withBayaanWidgets.js
// Fork seams for the native widgets (RFC-021). Everything here derives from
// app.config.js, so a fork changes its config, not the widget sources:
//   - URL scheme: `BayaanURLScheme` in the app Info.plist, the
//     `BAYAAN_URL_SCHEME` build setting the widget Info.plist expands, and
//     the `bayaan_widgets_url_scheme` Android string.
//   - App name: Android widget-picker labels that carry the brand ("Bayaan
//     Now"). Runtime copy reads the app label / CFBundleDisplayName instead.
// The committed ios/ and android/ trees carry this plugin's default output.
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withDangerousMod,
  withFinalizedMod,
  withInfoPlist,
  createRunOncePlugin,
} = require('expo/config-plugins');

const WIDGET_TARGET = 'BayaanWidgetsExtension';
const DEFAULT_SCHEME = 'bayaan';
const DEFAULT_NAME = 'Bayaan';
const SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const ANDROID_VALUES_PATH = ['app', 'src', 'main', 'res', 'values'];
const ANDROID_VALUES_FILE = 'bayaan_widgets.xml';

/** The first `scheme` from app.config.js, or 'bayaan' when absent or invalid. */
function resolveScheme(config) {
  const raw = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
  if (typeof raw === 'string' && SCHEME_PATTERN.test(raw)) return raw;
  if (raw !== undefined) {
    console.warn(
      `[withBayaanWidgets] scheme "${String(
        raw,
      )}" is not a valid URL scheme; widgets use "${DEFAULT_SCHEME}"`,
    );
  }
  return DEFAULT_SCHEME;
}

function resolveName(config) {
  const name = typeof config.name === 'string' ? config.name.trim() : '';
  return name || DEFAULT_NAME;
}

function resolveWidgetConfig(config) {
  return {scheme: resolveScheme(config), name: resolveName(config)};
}

// ─── Xcode project (text edit, so the file's formatting is kept) ────────────

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSettingValue(value) {
  if (/^[A-Za-z0-9_$./]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const SETTING_LINE = /^\t\t\t\t("?[A-Za-z0-9_[\]=*]+"?) = (.*);$/;

function settingName(line) {
  const match = SETTING_LINE.exec(line);
  return match ? match[1].replace(/"/g, '') : null;
}

/**
 * Applies `edit` to the buildSettings lines of every build configuration of
 * the named native target. `edit` receives and returns an array of lines.
 */
function editTargetBuildSettings(pbxproj, targetName, edit) {
  const listPattern = new RegExp(
    `\\t\\t[0-9A-Za-z]+ /\\* Build configuration list for PBXNativeTarget "${escapeRegExp(
      targetName,
    )}" \\*/ = \\{[\\s\\S]*?buildConfigurations = \\(([\\s\\S]*?)\\);`,
  );
  const list = listPattern.exec(pbxproj);
  if (!list) {
    throw new Error(
      `[withBayaanWidgets] No build configuration list for target "${targetName}" in project.pbxproj`,
    );
  }
  const ids = [...list[1].matchAll(/([0-9A-Za-z]+) \/\*/g)].map(m => m[1]);
  let out = pbxproj;
  for (const id of ids) {
    const start = out.search(
      new RegExp(
        `\\t\\t${id} /\\* [^*]+ \\*/ = \\{\\n\\t\\t\\tisa = XCBuildConfiguration;`,
      ),
    );
    if (start < 0) continue;
    const open = out.indexOf('buildSettings = {\n', start);
    const close = out.indexOf('\n\t\t\t};', open);
    if (open < 0 || close < 0) continue;
    const bodyStart = open + 'buildSettings = {\n'.length;
    const lines = out.slice(bodyStart, close).split('\n');
    const next = edit(lines);
    out = out.slice(0, bodyStart) + next.join('\n') + out.slice(close);
  }
  return out;
}

/** Sets (or, with value null, removes) a single-line build setting. */
function setBuildSetting(lines, name, value) {
  const index = lines.findIndex(line => settingName(line) === name);
  if (value === null) {
    return index < 0 ? lines : lines.filter((_, i) => i !== index);
  }
  const line = `\t\t\t\t${name} = ${formatSettingValue(value)};`;
  if (index >= 0) {
    const copy = [...lines];
    copy[index] = line;
    return copy;
  }
  // Keep Xcode's alphabetical order.
  const insertAt = lines.findIndex(existing => {
    const existingName = settingName(existing);
    return existingName !== null && existingName > name;
  });
  const copy = [...lines];
  copy.splice(insertAt < 0 ? copy.length : insertAt, 0, line);
  return copy;
}

function applyWidgetBuildSettings(pbxproj, widgetConfig) {
  return editTargetBuildSettings(pbxproj, WIDGET_TARGET, lines =>
    setBuildSetting(lines, 'BAYAAN_URL_SCHEME', widgetConfig.scheme),
  );
}

// ─── Android resources ──────────────────────────────────────────────────────

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

/** The app-module overrides for the bayaan-widgets library's defaults. */
function renderAndroidValues(widgetConfig) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<!-- Generated by plugins/withBayaanWidgets.js from app.config.js (RFC-021). Do not edit. -->',
    '<resources>',
    `  <string name="bayaan_widgets_url_scheme" translatable="false">${escapeXml(
      widgetConfig.scheme,
    )}</string>`,
    `  <string name="bayaan_widget_now_label">${escapeXml(
      `${widgetConfig.name} Now`,
    )}</string>`,
    '</resources>',
    '',
  ].join('\n');
}

// ─── Plugin ─────────────────────────────────────────────────────────────────

function withBayaanWidgets(config) {
  const widgetConfig = resolveWidgetConfig(config);

  config = withInfoPlist(config, cfg => {
    cfg.modResults.BayaanURLScheme = widgetConfig.scheme;
    return cfg;
  });

  // Finalized: @bacons/apple-targets rebuilds the widget target's build
  // configurations in its own Xcode mod, so this edit has to run after it.
  config = withFinalizedMod(config, [
    'ios',
    async cfg => {
      const file = IOSConfig.Paths.getPBXProjectPath(
        cfg.modRequest.projectRoot,
      );
      const before = fs.readFileSync(file, 'utf8');
      const after = applyWidgetBuildSettings(before, widgetConfig);
      if (after !== before) fs.writeFileSync(file, after);
      return cfg;
    },
  ]);

  config = withDangerousMod(config, [
    'android',
    async cfg => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        ...ANDROID_VALUES_PATH,
      );
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(
        path.join(dir, ANDROID_VALUES_FILE),
        renderAndroidValues(widgetConfig),
      );
      return cfg;
    },
  ]);

  return config;
}

module.exports = createRunOncePlugin(
  withBayaanWidgets,
  'withBayaanWidgets',
  '1.0.0',
);
module.exports.resolveWidgetConfig = resolveWidgetConfig;
module.exports.applyWidgetBuildSettings = applyWidgetBuildSettings;
module.exports.renderAndroidValues = renderAndroidValues;
