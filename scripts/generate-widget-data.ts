// scripts/generate-widget-data.ts
// Writes the static data bundled into both widget targets:
//   surahs.json  names, surah glyph code points, card file names
//   ayat.json    Ayah of the Day list with Digital Khatt text and Saheeh translation
// Run after editing data/widgets/ayah-of-the-day.json: npm run generate:widget-data
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {SURAHS} from '../data/surahData';
import {surahGlyphMap} from '../utils/surahGlyphMap';
import {
  buildStaticAyat,
  buildStaticSurahs,
  buildSurahCatalogSwift,
} from '../services/widgets/widgetStaticData';

const root = path.resolve(__dirname, '..');
const OUTPUT_DIRS = [
  'targets/widgets',
  'modules/bayaan-widgets/android/src/main/assets/widgets',
];

function readJson(rel: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function textOf(row: unknown): string {
  return typeof row === 'object' &&
    row !== null &&
    'text' in row &&
    typeof row.text === 'string'
    ? row.text
    : '';
}

function saheehText(data: unknown, key: string): string | undefined {
  if (typeof data !== 'object' || data === null || !(key in data)) {
    return undefined;
  }
  const entry: unknown = Reflect.get(data, key);
  return typeof entry === 'object' &&
    entry !== null &&
    't' in entry &&
    typeof entry.t === 'string'
    ? entry.t
    : undefined;
}

function main(): void {
  const keys = readJson('data/widgets/ayah-of-the-day.json');
  if (!isStringArray(keys)) {
    throw new Error('ayah-of-the-day.json must be an array of verse keys');
  }
  const saheeh = readJson(
    'data/SaheehInternational.translation-with-footnote-tags.json',
  );
  const db = new Database(
    path.join(root, 'data/mushaf/digitalkhatt/digital-khatt-v2.db'),
    {readonly: true},
  );
  const wordsStmt = db.prepare(
    'SELECT text FROM words WHERE surah = ? AND ayah = ? ORDER BY word',
  );

  const ayat = buildStaticAyat(keys, {
    words: (surahId, ayah) =>
      wordsStmt.all(surahId, ayah).map(textOf).filter(Boolean),
    translation: key => saheehText(saheeh, key),
    surahName: surahId => SURAHS[surahId - 1]?.name,
  });
  const surahs = buildStaticSurahs(SURAHS, surahGlyphMap);
  db.close();

  for (const dir of OUTPUT_DIRS) {
    const abs = path.join(root, dir);
    fs.mkdirSync(abs, {recursive: true});
    fs.writeFileSync(path.join(abs, 'ayat.json'), `${JSON.stringify(ayat)}\n`);
    fs.writeFileSync(
      path.join(abs, 'surahs.json'),
      `${JSON.stringify(surahs)}\n`,
    );
  }
  fs.writeFileSync(
    path.join(root, 'targets/widgets/_shared/SurahCatalog.swift'),
    buildSurahCatalogSwift(surahs),
  );
  console.log(
    `[generate-widget-data] ${ayat.length} ayat, ${surahs.length} surahs`,
  );
}

main();
