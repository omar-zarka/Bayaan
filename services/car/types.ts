export type CarArtwork =
  | {kind: 'surah'; surahId: number}
  | {kind: 'url'; url: string}
  | {kind: 'asset'; uri: string}
  | {kind: 'monogram'; label: string; hex: string}
  | {kind: 'color'; label: string; hex: string};

export type CarPlayRequest =
  | {
      kind: 'surah';
      reciterId: string;
      rewayatId: string;
      surahId: number;
      startAt?: number;
    }
  | {kind: 'playlist'; playlistId: string; system: boolean; startIndex?: number}
  | {kind: 'loved'; shuffle?: boolean; startIndex?: number}
  | {kind: 'downloads'; startIndex?: number}
  | {kind: 'resume'};

export type CarBrowseTarget =
  | {kind: 'list'; listId: string}
  | {kind: 'reciter'; reciterId: string}
  | {kind: 'surahReciters'; surahId: number};

export type CarItemAction =
  | {kind: 'play'; request: CarPlayRequest}
  | {kind: 'browse'; target: CarBrowseTarget};

export interface CarItem {
  id: string;
  title: string;
  subtitle?: string;
  artwork: CarArtwork;
  progress?: number;
  isDownloaded?: boolean;
  action: CarItemAction;
}

export type CarSectionStyle = 'rows' | 'cards' | 'circles';

export interface CarSection {
  id: string;
  title: string;
  style: CarSectionStyle;
  items: CarItem[];
}

export interface CarList {
  id: string;
  title: string;
  items: CarItem[];
}

export interface CarRewayah {
  id: string;
  name: string;
  style: string;
  surahIds: number[];
}

export interface CarReciter {
  id: string;
  name: string;
  artwork: CarArtwork;
  isFavorite: boolean;
  rewayat: CarRewayah[];
}

export interface CarSurah {
  id: number;
  name: string;
  nameArabic: string;
  translation: string;
  versesCount: number;
}

export interface CarSnapshot {
  version: 1;
  generatedAt: string;
  topReciterId: string | null;
  home: {quickStart: CarItem[]; sections: CarSection[]};
  library: CarItem[];
  lists: Record<string, CarList>;
  reciters: CarReciter[];
  surahs: CarSurah[];
  juz: {number: number; surahIds: number[]}[];
  downloadedKeys: string[];
}

export type CarTransport =
  | {kind: 'next'}
  | {kind: 'previous'}
  | {kind: 'play'}
  | {kind: 'pause'}
  | {kind: 'seek'; position: number}
  | {kind: 'rate'; value: number}
  | {kind: 'cycleRate'}
  | {kind: 'cycleRepeat'}
  | {kind: 'toggleLove'}
  | {kind: 'jumpTo'; index: number};

export interface CarNowPlaying {
  title: string;
  subtitle: string;
  reciterId: string | null;
  surahId: number | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  rate: number;
  repeatMode: 'none' | 'queue' | 'track';
  isLoved: boolean;
  artwork: CarArtwork | null;
  queue: {title: string; subtitle: string; surahId: number | null}[];
  currentIndex: number;
}

export function downloadKey(
  reciterId: string,
  rewayatId: string,
  surahId: number,
): string {
  return `${reciterId}:${rewayatId}:${surahId}`;
}
