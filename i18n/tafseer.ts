// @ai-generated
import {currentLanguage, type AppLanguage} from './language';
import ar from './locales/ar/home.json';
import en from './locales/en/home.json';

interface NamedTafseer {
  identifier?: string;
  id?: string;
  name: string;
  englishName: string;
}

export function getTafseerLanguageDisplayName(
  editionLanguage: string,
  language: AppLanguage = currentLanguage,
): string {
  const codes: Record<string, string> = {
    arabic: 'ar',
    english: 'en',
    bengali: 'bn',
    urdu: 'ur',
    russian: 'ru',
    kurdish: 'ku',
  };
  const normalized = editionLanguage.trim().toLowerCase();
  const names: Record<string, string> =
    language === 'ar' ? ar.languages : en.languages;
  return names[codes[normalized] ?? normalized] ?? editionLanguage;
}

/** Localize catalogue titles without changing the language of their text. */
export function getTafseerDisplayName(
  edition: NamedTafseer,
  language: AppLanguage = currentLanguage,
): string {
  const names: Record<string, string> =
    language === 'ar' ? ar.tafseerNames : en.tafseerNames;
  return (
    names[edition.identifier ?? edition.id ?? ''] ??
    (language === 'ar' ? edition.name : edition.englishName)
  );
}

export function isPreferredTafseerLanguage(
  editionLanguage: string,
  language: AppLanguage = currentLanguage,
): boolean {
  const normalized = editionLanguage.trim().toLowerCase();
  return (
    normalized === language ||
    normalized === (language === 'ar' ? 'arabic' : 'english')
  );
}

/** Sort a copy at call sites so persisted selections and metadata stay intact. */
export function compareTafaseer(
  a: NamedTafseer & {language: string},
  b: NamedTafseer & {language: string},
): number {
  return (
    Number(isPreferredTafseerLanguage(b.language)) -
      Number(isPreferredTafseerLanguage(a.language)) ||
    getTafseerDisplayName(a).localeCompare(
      getTafseerDisplayName(b),
      currentLanguage,
    )
  );
}
