/**
 * Unit tests for the pure parts of plugins/withBayaanWidgets.js (RFC-021):
 * config resolution, the widget target's Xcode build settings and the
 * generated Android values.
 */

const fs = require('fs');
const path = require('path');
const {
  resolveWidgetConfig,
  applyWidgetBuildSettings,
  renderAndroidValues,
} = require('../withBayaanWidgets');

const ROOT = path.join(__dirname, '..', '..');
const PBXPROJ = fs.readFileSync(
  path.join(ROOT, 'ios', 'Bayaan.xcodeproj', 'project.pbxproj'),
  'utf8',
);

function widgetConfigs(pbxproj) {
  const blocks = [];
  const pattern =
    /\/\* (Debug|Release) \*\/ = \{\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = \{\n([\s\S]*?)\n\t\t\t\};/g;
  for (const match of pbxproj.matchAll(pattern)) {
    if (match[2].includes('INFOPLIST_FILE = ../targets/widgets/Info.plist;')) {
      blocks.push({name: match[1], body: match[2]});
    }
  }
  return blocks;
}

describe('resolveWidgetConfig', () => {
  it('defaults to Bayaan', () => {
    expect(resolveWidgetConfig({name: 'Bayaan', scheme: 'bayaan'})).toEqual(
      expect.objectContaining({scheme: 'bayaan', name: 'Bayaan'}),
    );
  });

  it('takes the first scheme and rejects invalid ones', () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    expect(resolveWidgetConfig({scheme: ['qariah', 'exp+qariah']}).scheme).toBe(
      'qariah',
    );
    expect(resolveWidgetConfig({scheme: '1bad'}).scheme).toBe('bayaan');
    expect(resolveWidgetConfig({}).scheme).toBe('bayaan');
    warn.mockRestore();
  });
});

describe('applyWidgetBuildSettings', () => {
  it('leaves the committed project unchanged for the default config', () => {
    const config = resolveWidgetConfig({name: 'Bayaan', scheme: 'bayaan'});
    expect(applyWidgetBuildSettings(PBXPROJ, config)).toBe(PBXPROJ);
  });

  it('writes a fork scheme into both widget configurations only', () => {
    const config = resolveWidgetConfig({name: 'Qariah', scheme: 'qariah'});
    const out = applyWidgetBuildSettings(PBXPROJ, config);
    const blocks = widgetConfigs(out);
    expect(blocks.map(b => b.name).sort()).toEqual(['Debug', 'Release']);
    for (const block of blocks) {
      expect(block.body).toContain('\t\t\t\tBAYAAN_URL_SCHEME = qariah;');
      expect(block.body).not.toContain('BAYAAN_URL_SCHEME = bayaan;');
    }
    expect(out.match(/BAYAAN_URL_SCHEME/g)).toHaveLength(2);
    expect(applyWidgetBuildSettings(out, config)).toBe(out);
  });

  it('inserts the setting in alphabetical order when missing', () => {
    const stripped = PBXPROJ.replace(/\t\t\t\tBAYAAN_URL_SCHEME = \w+;\n/g, '');
    const out = applyWidgetBuildSettings(
      stripped,
      resolveWidgetConfig({scheme: 'bayaan'}),
    );
    expect(out).toBe(PBXPROJ);
  });

  it('fails loudly when the widget target is missing', () => {
    expect(() =>
      applyWidgetBuildSettings('// empty', resolveWidgetConfig({})),
    ).toThrow('BayaanWidgetsExtension');
  });
});

describe('renderAndroidValues', () => {
  it('matches the committed app resources for the default config', () => {
    const committed = fs.readFileSync(
      path.join(ROOT, 'android/app/src/main/res/values/bayaan_widgets.xml'),
      'utf8',
    );
    expect(
      renderAndroidValues(
        resolveWidgetConfig({name: 'Bayaan', scheme: 'bayaan'}),
      ),
    ).toBe(committed);
  });

  it('writes a fork scheme and name', () => {
    const xml = renderAndroidValues(
      resolveWidgetConfig({name: "Qari'ah & Co", scheme: 'qariah'}),
    );
    expect(xml).toContain(
      '<string name="bayaan_widgets_url_scheme" translatable="false">qariah</string>',
    );
    expect(xml).toContain(
      `<string name="bayaan_widget_now_label">Qari\\'ah &amp; Co Now</string>`,
    );
  });
});
