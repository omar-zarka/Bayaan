// services/widgets/widgetStaticData.ts
// Pure builders for the static JSON bundled into both widget targets.
// Imported by scripts/generate-widget-data.ts, so no '@/' imports here.
import {surahArtworkFileName} from './artworkNames';

export interface StaticSurah {
  id: number;
  name: string;
  translatedName: string;
  glyph: string; // surah_names.ttf ("icomoon") code point
  artworkFile: string;
}

export interface StaticAyah {
  key: string;
  surahId: number;
  ayah: number;
  surahName: string;
  arabic: string; // Digital Khatt words joined by spaces, ending with the ayah marker
  translation: string; // Saheeh International, footnotes removed
}

export interface SurahSource {
  id: number;
  name: string;
  translated_name_english: string;
}

export interface AyahSources {
  words: (surahId: number, ayah: number) => string[];
  translation: (key: string) => string | undefined;
  surahName: (surahId: number) => string | undefined;
}

// Short enough for the small widget at a readable size.
export const MAX_AYAH_WORDS = 20;

export function cleanTranslation(raw: string): string {
  return raw
    .replace(/<sup[^>]*>.*?<\/sup>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

export function parseVerseKey(
  key: string,
): {surahId: number; ayah: number} | null {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(key);
  if (!match) return null;
  const surahId = Number(match[1]);
  const ayah = Number(match[2]);
  if (surahId < 1 || surahId > 114 || ayah < 1) return null;
  return {surahId, ayah};
}

export function buildStaticSurahs(
  surahs: SurahSource[],
  glyphs: Record<number, string>,
): StaticSurah[] {
  return surahs.map(s => ({
    id: s.id,
    name: s.name,
    translatedName: s.translated_name_english,
    glyph: glyphs[s.id] ?? '',
    artworkFile: surahArtworkFileName(s.id),
  }));
}

export function buildStaticAyat(
  keys: string[],
  src: AyahSources,
): StaticAyah[] {
  const seen = new Set<string>();
  return keys.map(key => {
    if (seen.has(key)) throw new Error(`duplicate verse key ${key}`);
    seen.add(key);
    const parsed = parseVerseKey(key);
    if (!parsed) throw new Error(`bad verse key ${key}`);
    const words = src.words(parsed.surahId, parsed.ayah);
    if (words.length === 0) {
      throw new Error(`no Digital Khatt text for ${key}`);
    }
    // The last word is the end-of-ayah marker.
    const wordCount = words.length - 1;
    if (wordCount > MAX_AYAH_WORDS) {
      throw new Error(`${key} has ${wordCount} words, max ${MAX_AYAH_WORDS}`);
    }
    const translation = cleanTranslation(src.translation(key) ?? '');
    if (!translation) throw new Error(`no translation for ${key}`);
    const surahName = src.surahName(parsed.surahId);
    if (!surahName) throw new Error(`no surah name for ${key}`);
    return {
      key,
      surahId: parsed.surahId,
      ayah: parsed.ayah,
      surahName,
      arabic: words.join(' '),
      translation,
    };
  });
}
