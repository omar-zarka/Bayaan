import {SURAHS} from '@/data/surahData';
import {currentLanguage, type AppLanguage} from './language';

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Converts ASCII digits to Arabic-Indic digits when the language is Arabic. */
export function localizeDigits(
  value: string | number,
  language: AppLanguage = currentLanguage,
): string {
  const text = String(value);
  if (language !== 'ar') {
    return text;
  }
  return text.replace(/[0-9]/g, digit => ARABIC_INDIC_DIGITS[Number(digit)]);
}

/** Formats an integer with grouping separators and localized digits. */
export function formatNumber(
  value: number,
  language: AppLanguage = currentLanguage,
): string {
  const grouped = Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, language === 'ar' ? '٬' : ',');
  return localizeDigits(grouped, language);
}

interface NamedSurah {
  name: string;
  name_arabic: string;
}

/** Surah name for display: Arabic name in Arabic mode, transliteration otherwise. */
export function getSurahDisplayName(
  surah: NamedSurah,
  language: AppLanguage = currentLanguage,
): string {
  return language === 'ar' ? surah.name_arabic : surah.name;
}

interface TranslatedSurah {
  translated_name_english: string;
}

/**
 * English meaning of a surah name (e.g. "The Opener"). Returns null in Arabic
 * mode, where the Arabic name already carries the meaning.
 */
export function getSurahMeaning(
  surah: TranslatedSurah,
  language: AppLanguage = currentLanguage,
): string | null {
  return language === 'ar' ? null : surah.translated_name_english;
}

interface TitledTrack {
  title: string;
  surahId?: string;
  isUserUpload?: boolean;
}

/**
 * Track title for display. Surah tracks are titled with the English surah
 * name when queued, so Arabic mode resolves the Arabic name from `surahId`.
 * User uploads keep their own titles.
 */
export function getTrackDisplayTitle(
  track: TitledTrack,
  language: AppLanguage = currentLanguage,
): string {
  if (language !== 'ar' || track.isUserUpload || !track.surahId) {
    return track.title;
  }
  const surah = SURAHS[Number(track.surahId) - 1];
  return surah ? surah.name_arabic : track.title;
}

interface NamedReciter {
  name: string;
  name_arabic?: string | null;
}

/** Reciter name for display; uses the Arabic name when the API provides one. */
export function getReciterDisplayName(
  reciter: NamedReciter,
  language: AppLanguage = currentLanguage,
): string {
  if (language === 'ar' && reciter.name_arabic) {
    return reciter.name_arabic;
  }
  return reciter.name;
}
