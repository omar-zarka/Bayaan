// @ai-generated
import {SURAHS} from '@/data/surahData';
import arNamesById from '@/data/reciterNamesAr.json';
import fallbackReciters from '@/data/reciters-fallback.json';
import {currentLanguage, type AppLanguage} from './language';
import {getLanguageConfig} from './languages';

function reciterNameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const arNamesByKey = new Map<string, string>();
for (const reciter of fallbackReciters as {id: string; name: string}[]) {
  const arabic = (arNamesById as Record<string, string>)[reciter.id];
  if (arabic) {
    arNamesByKey.set(reciterNameKey(reciter.name), arabic);
  }
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Converts ASCII digits to the language's digits (Arabic-Indic for Arabic). */
export function localizeDigits(
  value: string | number,
  language: AppLanguage = currentLanguage,
): string {
  const text = String(value);
  if (getLanguageConfig(language).digits !== 'arab') {
    return text;
  }
  return text.replace(/[0-9]/g, digit => ARABIC_INDIC_DIGITS[Number(digit)]);
}

function usesArabicContent(language: AppLanguage): boolean {
  return getLanguageConfig(language).bilingualContent === 'ar';
}

function groupSeparator(language: AppLanguage): string {
  return getLanguageConfig(language).digits === 'arab' ? '٬' : ',';
}

/** Decimal separator that matches the language's digits. */
export function decimalSeparator(
  language: AppLanguage = currentLanguage,
): string {
  return getLanguageConfig(language).digits === 'arab' ? '٫' : '.';
}

/** Formats an integer with grouping separators and localized digits. */
export function formatNumber(
  value: number,
  language: AppLanguage = currentLanguage,
): string {
  const grouped = Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator(language));
  return localizeDigits(grouped, language);
}

interface NamedSurah {
  name: string;
  name_arabic: string;
}

/** Surah name for display: the Arabic name or the transliteration. */
export function getSurahDisplayName(
  surah: NamedSurah,
  language: AppLanguage = currentLanguage,
): string {
  return usesArabicContent(language) ? surah.name_arabic : surah.name;
}

interface TranslatedSurah {
  translated_name_english: string;
}

/**
 * English meaning of a surah name (e.g. "The Opener"). Returns null when the
 * Arabic name is shown, since it already carries the meaning.
 */
export function getSurahMeaning(
  surah: TranslatedSurah,
  language: AppLanguage = currentLanguage,
): string | null {
  return usesArabicContent(language) ? null : surah.translated_name_english;
}

interface TitledTrack {
  title: string;
  surahId?: string;
  isUserUpload?: boolean;
}

/**
 * Track title for display. Surah tracks are titled with the English surah
 * name when queued, so the Arabic name is resolved from `surahId` when the
 * language shows Arabic names. User uploads keep their own titles.
 */
export function getTrackDisplayTitle(
  track: TitledTrack,
  language: AppLanguage = currentLanguage,
): string {
  if (!usesArabicContent(language) || track.isUserUpload || !track.surahId) {
    return track.title;
  }
  const surah = SURAHS[Number(track.surahId) - 1];
  return surah ? surah.name_arabic : track.title;
}

interface NamedReciter {
  id?: string;
  name: string;
  name_arabic?: string | null;
}

/**
 * Reciter name for display. Languages that show Arabic names prefer the API's
 * `name_arabic`, then the bundled Arabic name (matched by id, then by English
 * name). Everything else shows the English name. Reciter names are data, not
 * UI strings: they never go in the locale files (see docs/i18n/README.md).
 */
export function getReciterDisplayName(
  reciter: NamedReciter,
  language: AppLanguage = currentLanguage,
): string {
  if (!usesArabicContent(language)) {
    return reciter.name;
  }
  if (reciter.name_arabic) {
    return reciter.name_arabic;
  }
  if (reciter.id) {
    const byId = (arNamesById as Record<string, string>)[reciter.id];
    if (byId) {
      return byId;
    }
  }
  return arNamesByKey.get(reciterNameKey(reciter.name)) ?? reciter.name;
}

/** Artist line on a queued track. Uploads keep their own name. */
export function getTrackArtistDisplay(
  track: {artist: string; reciterId?: string; isUserUpload?: boolean},
  language: AppLanguage = currentLanguage,
): string {
  if (!usesArabicContent(language) || track.isUserUpload || !track.reciterId) {
    return track.artist;
  }
  return getReciterDisplayName(
    {id: track.reciterId, name: track.artist},
    language,
  );
}
