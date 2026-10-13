// @ai-generated
// Checks the language registry against CLDR (Node's full ICU data) and keeps
// every other list of languages in step with it.
import {readFileSync} from 'fs';
import {join} from 'path';
import {
  LANGUAGES,
  SUPPORTED_LANGUAGES,
  type Script,
  type UiFont,
} from '../languages';
import {resources} from '../resources';

/** Scripts each bundled UI font covers. */
const FONT_SCRIPTS: Record<UiFont, Script[]> = {
  manrope: ['Latn'],
  plexSansArabic: ['Arab', 'Latn'],
};

/** Scripts whose letters join, where letter spacing breaks words apart. */
const CURSIVE_SCRIPTS: Script[] = ['Arab'];

function cldrDirection(code: string): string | undefined {
  const locale: unknown = new Intl.Locale(code);
  if (
    typeof locale === 'object' &&
    locale !== null &&
    'getTextInfo' in locale &&
    typeof locale.getTextInfo === 'function'
  ) {
    const info: unknown = locale.getTextInfo();
    if (typeof info === 'object' && info !== null && 'direction' in info) {
      return String(info.direction);
    }
  }
  return undefined;
}

describe.each(SUPPORTED_LANGUAGES)('language "%s"', code => {
  const config = LANGUAGES[code];

  it('is keyed by its own code', () => {
    expect(config.code).toBe(code);
  });

  it('has the CLDR text direction', () => {
    expect(config.direction).toBe(cldrDirection(code));
  });

  it('has the CLDR script', () => {
    expect(config.script).toBe(new Intl.Locale(code).maximize().script);
  });

  it('is named in its own language and script', () => {
    const displayNames = new Intl.DisplayNames([code], {type: 'language'});
    expect(config.endonym).toBe(displayNames.of(code));
  });

  it('uses a UI font that covers its script', () => {
    expect(FONT_SCRIPTS[config.uiFont]).toContain(config.script);
  });

  it('turns letter spacing off for cursive scripts', () => {
    expect(config.allowsLetterSpacing).toBe(
      !CURSIVE_SCRIPTS.includes(config.script),
    );
  });

  it('has locale files', () => {
    expect(Object.keys(resources)).toContain(code);
  });
});

it('lists the same languages in resources.ts as in the registry', () => {
  expect(Object.keys(resources).sort()).toEqual(
    [...SUPPORTED_LANGUAGES].sort(),
  );
});

it('declares every language to iOS in app.config.js', () => {
  // Read as text: evaluating app.config.js runs the version script.
  const appConfig = readFileSync(
    join(__dirname, '../../app.config.js'),
    'utf8',
  );
  const match = /supportedLocales:\s*{\s*ios:\s*\[([^\]]*)\]/.exec(appConfig);
  const declared = (match?.[1] ?? '')
    .split(',')
    .map(entry => entry.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
  expect(declared.sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
});
