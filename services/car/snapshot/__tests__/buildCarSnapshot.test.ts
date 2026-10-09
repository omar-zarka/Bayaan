import {
  buildCarSnapshot,
  CarSnapshotInput,
  availableSurahIds,
} from '../buildCarSnapshot';
import {Reciter, Rewayat} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {SystemPlaylist} from '@/data/systemPlaylists';

function rewayat(
  id: string,
  reciterId: string,
  list: (number | null)[],
): Rewayat {
  return {
    id,
    reciter_id: reciterId,
    name: "Hafs A'n Assem",
    style: 'murattal',
    server: 'https://cdn.example.com',
    surah_total: list.length,
    surah_list: list,
    source_type: 'r2',
    created_at: '2026-01-01',
  };
}

function reciter(id: string, name: string, list: (number | null)[]): Reciter {
  return {
    id,
    name,
    date: null,
    image_url: null,
    rewayat: [rewayat(`${id}-hafs`, id, list)],
  };
}

function surah(id: number): Surah {
  return {
    id,
    name: `Surah ${id}`,
    revelation_place: 'Makkah',
    revelation_order: id,
    bismillah_pre: true,
    name_arabic: `س${id}`,
    verses_count: 10,
    pages: '1',
    translated_name_english: `T${id}`,
  };
}

const surahs = Array.from({length: 114}, (_, i) => surah(i + 1));
const mishary = reciter(
  'r1',
  'Mishary',
  surahs.map(s => s.id),
);
const sudais = reciter('r2', 'Sudais', [1, 2, null, 18]);

function recent(r: Reciter, s: number, progress: number): RecentlyPlayedTrack {
  return {
    reciter: r,
    surah: surah(s),
    rewayatId: r.rewayat[0].id,
    progress,
    duration: 600,
    timestamp: 1,
  };
}

function input(overrides: Partial<CarSnapshotInput> = {}): CarSnapshotInput {
  return {
    now: new Date(2026, 9, 10, 14, 0), // Saturday afternoon: no time rules
    reciters: [mishary, sudais],
    surahs,
    favoriteReciterIds: [],
    defaultReciterId: 'r1',
    recentTracks: [],
    lovedTracks: [],
    downloads: [],
    userPlaylists: [],
    playlistItems: {},
    systemPlaylists: [],
    surahToJuz: {1: 1, 2: 1, 18: 15},
    resolveReciterArtwork: (r: Reciter) => ({
      kind: 'monogram',
      label: r.name.slice(0, 1),
      hex: '#333333',
    }),
    ...overrides,
  };
}

describe('availableSurahIds', () => {
  it('drops nulls and sorts', () => {
    expect(availableSurahIds(sudais.rewayat[0])).toEqual([1, 2, 18]);
  });
  it('returns all 114 when the list is empty', () => {
    expect(availableSurahIds(rewayat('x', 'y', [])).length).toBe(114);
  });
});

function systemPlaylist(
  id: string,
  items: SystemPlaylist['items'],
): SystemPlaylist {
  return {
    id,
    title: `Playlist ${id}`,
    description: '',
    backgroundColor: '#123456',
    type: 'surah-only',
    items,
    heightMultiplier: 1,
    column: 'left',
    order: 1,
  };
}

describe('buildCarSnapshot', () => {
  it('handles empty stores without throwing and keeps Home non-empty when system playlists exist', () => {
    const snap = buildCarSnapshot(
      input({
        systemPlaylists: [
          {
            id: 'juz-amma',
            title: 'Juz Amma',
            description: '',
            backgroundColor: '#123456',
            type: 'surah-only',
            items: [{surahId: 78}],
            heightMultiplier: 1,
            column: 'left',
            order: 1,
          },
        ],
      }),
    );
    expect(snap.version).toBe(1);
    expect(snap.home.quickStart).toEqual([]);
    expect(snap.home.sections.map(s => s.id)).toEqual(['your-playlists']);
    expect(snap.library.map(i => i.id)).toEqual([
      'lib:loved',
      'lib:playlists',
      'lib:downloads',
      'lib:favorite-reciters',
    ]);
  });

  it('uses the most recent reciter as top reciter, else the default', () => {
    expect(buildCarSnapshot(input()).topReciterId).toBe('r1');
    expect(
      buildCarSnapshot(input({recentTracks: [recent(sudais, 2, 0.5)]}))
        .topReciterId,
    ).toBe('r2');
  });

  it('builds Jump back in with fractional progress and a resume start position', () => {
    const snap = buildCarSnapshot(
      input({recentTracks: [recent(sudais, 2, 0.5)]}),
    );
    const section = snap.home.sections.find(s => s.id === 'jump-back-in');
    expect(section?.items[0].progress).toBe(0.5);
    expect(section?.items[0].action).toEqual({
      kind: 'play',
      request: {
        kind: 'surah',
        reciterId: 'r2',
        rewayatId: 'r2-hafs',
        surahId: 2,
        startAt: 300,
      },
    });
  });

  it('skips user uploads in recents', () => {
    const upload: RecentlyPlayedTrack = {
      ...recent(sudais, 2, 0.5),
      isUserUpload: true,
    };
    const snap = buildCarSnapshot(input({recentTracks: [upload]}));
    expect(
      snap.home.sections.find(s => s.id === 'jump-back-in'),
    ).toBeUndefined();
    expect(
      snap.home.quickStart.find(i => i.id === 'quick:resume'),
    ).toBeUndefined();
  });

  it('puts Resume and Shuffle Loved in quick start when available', () => {
    const snap = buildCarSnapshot(
      input({
        recentTracks: [recent(mishary, 1, 0.1)],
        lovedTracks: [
          {reciterId: 'r1', surahId: '1', rewayatId: 'r1-hafs', timestamp: 1},
        ],
      }),
    );
    expect(snap.home.quickStart.map(i => i.id).slice(0, 2)).toEqual([
      'quick:resume',
      'quick:shuffle-loved',
    ]);
  });

  it('orders favorites first in reciters and marks them', () => {
    const snap = buildCarSnapshot(input({favoriteReciterIds: ['r2']}));
    expect(snap.reciters.map(r => r.id)).toEqual(['r2', 'r1']);
    expect(snap.reciters[0].isFavorite).toBe(true);
    expect(snap.reciters[0].rewayat[0].surahIds).toEqual([1, 2, 18]);
  });

  it('lists only completed downloads and records their keys', () => {
    const snap = buildCarSnapshot(
      input({
        downloads: [
          {
            reciterId: 'r1',
            surahId: '1',
            rewayatId: 'r1-hafs',
            filePath: 'a',
            fileSize: 1,
            downloadDate: 1,
            status: 'completed',
          },
          {
            reciterId: 'r1',
            surahId: '2',
            rewayatId: 'r1-hafs',
            filePath: 'b',
            fileSize: 1,
            downloadDate: 1,
            status: 'downloading',
          },
        ],
      }),
    );
    expect(snap.lists.downloads.items.length).toBe(1);
    expect(snap.downloadedKeys).toEqual(['r1:r1-hafs:1']);
  });

  it('skips loved items whose reciter is unknown', () => {
    const snap = buildCarSnapshot(
      input({
        lovedTracks: [
          {reciterId: 'gone', surahId: '1', rewayatId: 'x', timestamp: 1},
        ],
      }),
    );
    expect(snap.lists.loved.items).toEqual([]);
  });

  it('groups surahs by starting juz', () => {
    const snap = buildCarSnapshot(input());
    expect(snap.juz.find(j => j.number === 1)?.surahIds).toEqual([1, 2]);
  });

  it('offers Up next only from 95 percent progress', () => {
    const almost = buildCarSnapshot(
      input({recentTracks: [recent(sudais, 1, 0.949)]}),
    );
    const done = buildCarSnapshot(
      input({recentTracks: [recent(sudais, 1, 0.95)]}),
    );
    expect(almost.home.quickStart.map(i => i.id)).toEqual(['quick:resume']);
    expect(done.home.quickStart.map(i => i.id)).toEqual([
      'quick:resume',
      'now:upnext',
    ]);
  });

  it('excludes system playlist items the top reciter lacks', () => {
    const snap = buildCarSnapshot(
      input({
        recentTracks: [recent(sudais, 1, 0.1)],
        systemPlaylists: [systemPlaylist('p1', [{surahId: 3}, {surahId: 18}])],
      }),
    );
    expect(snap.lists['system:p1'].items.map(i => i.id)).toEqual(['sys:p1:18']);
  });

  it('leaves out playlists that resolve to no items', () => {
    const snap = buildCarSnapshot(
      input({
        systemPlaylists: [
          systemPlaylist('p1', [{surahId: 3, reciterId: 'gone'}]),
        ],
      }),
    );
    expect(snap.lists['system:p1']).toBeUndefined();
    expect(snap.lists.playlists.items).toEqual([]);
    expect(snap.home.sections.map(s => s.id)).toEqual([]);
  });
});
