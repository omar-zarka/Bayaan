// services/widgets/artworkNames.ts
// File names in the shared artwork dir. No imports, so build scripts can use it.

// The dark surah cards shared with CarPlay and Android Auto (512 px PNGs).
const SURAH_ARTWORK_BASE = 'https://cdn.thebayaan.com/assets/car/surah/';

export function surahArtworkFileName(surahId: number): string {
  return `surah-${surahId}.jpg`;
}

export function surahArtworkUrl(surahId: number): string {
  return `${SURAH_ARTWORK_BASE}${surahId}.png`;
}
