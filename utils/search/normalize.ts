// @ai-generated

/**
 * Display-safe normalization shared with the Mushaf command parser. Keeps
 * ':' and hamza so "2:255" and "جزء" still parse. Do not add folding here;
 * matching-only folding belongs in toSearchKey.
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Matching key: normalizeSearchText plus Latin accent stripping, hamza
 * carrier folding, apostrophe removal and punctuation-to-space. Only ever
 * compared against other keys; never shown to the user.
 */
export function toSearchKey(text: string): string {
  return normalizeSearchText(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .replace(/[​‌‍﻿]/g, '')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/['’‘`´ʼʻ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function tokenize(key: string): string[] {
  return key ? key.split(' ') : [];
}

/** Romanized Arabic articles and name particles ignored by skeleton matching. */
export const ARTICLES: ReadonlySet<string> = new Set([
  'al',
  'el',
  'an',
  'ar',
  'as',
  'ash',
  'at',
  'ad',
  'az',
  'ul',
  'ibn',
  'bin',
  'ben',
]);

/**
 * Consonant skeleton of a romanized Arabic word, so transliteration variants
 * collide: hussary/husary/hosary -> "hsr", abdulbasit/abdelbaset -> "abdbst".
 * Steps: drop a glued "al"/"el" article, fold "abd + al/ul/el (+ sun letter)"
 * to "abd", keep the first letter, drop later vowels (and y), q -> k,
 * ph -> f, then collapse doubled letters. Non-Latin tokens pass through.
 */
export function latinSkeleton(token: string): string {
  if (!/^[a-z]+$/.test(token)) return token;
  let word = token;
  if (word.length > 4 && /^(al|el)/.test(word)) word = word.slice(2);
  word = word.replace(/^abd[uea]?[lrsnzdt]?(?=[a-z]{3}|$)/, 'abd');
  const first = word[0] === 'q' ? 'k' : word[0];
  const rest = word
    .slice(1)
    .replace(/ph/g, 'f')
    .replace(/q/g, 'k')
    .replace(/[aeiouy]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}
