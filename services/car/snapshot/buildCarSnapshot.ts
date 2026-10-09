import {Reciter, Rewayat} from '@/data/reciterData';
import {Surah} from '@/data/surahData';
import {SystemPlaylist} from '@/data/systemPlaylists';
import {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {LovedTrack} from '@/services/player/store/lovedStore';
import {DownloadedSurah} from '@/services/player/store/downloadStore';
import {UserPlaylist, PlaylistItem} from '@/services/database/DatabaseService';
import {
  CarArtwork,
  CarItem,
  CarList,
  CarReciter,
  CarSection,
  CarSnapshot,
  downloadKey,
} from '@/services/car/types';
import {buildSituationalPicks, SituationalReciter} from './situational';

export interface CarSnapshotInput {
  now: Date;
  reciters: Reciter[];
  surahs: Surah[];
  favoriteReciterIds: string[];
  defaultReciterId: string | null;
  recentTracks: RecentlyPlayedTrack[];
  lovedTracks: LovedTrack[];
  downloads: DownloadedSurah[];
  userPlaylists: UserPlaylist[];
  playlistItems: Record<string, PlaylistItem[]>;
  systemPlaylists: SystemPlaylist[];
  surahToJuz: Record<number, number>;
  resolveReciterArtwork: (reciter: Reciter) => CarArtwork;
}

const ALL_SURAH_IDS = Array.from({length: 114}, (_, i) => i + 1);
const JUMP_BACK_IN_LIMIT = 10;
const QUICK_START_LIMIT = 4;

export function availableSurahIds(rewayat: Rewayat | undefined): number[] {
  if (!rewayat || rewayat.surah_list.length === 0) return ALL_SURAH_IDS;
  return rewayat.surah_list
    .filter((id): id is number => id !== null)
    .sort((a, b) => a - b);
}

function findRewayat(
  reciter: Reciter,
  rewayatId: string | undefined,
): Rewayat | undefined {
  return reciter.rewayat.find(r => r.id === rewayatId) ?? reciter.rewayat[0];
}

function pickTopReciter(input: CarSnapshotInput): SituationalReciter | null {
  const recent = input.recentTracks.find(t => !t.isUserUpload);
  const candidates: {
    reciter: Reciter | undefined;
    rewayatId: string | undefined;
  }[] = [
    {
      reciter: recent
        ? input.reciters.find(r => r.id === recent.reciter.id)
        : undefined,
      rewayatId: recent?.rewayatId,
    },
    {
      reciter: input.reciters.find(r => r.id === input.defaultReciterId),
      rewayatId: undefined,
    },
  ];
  for (const candidate of candidates) {
    if (!candidate.reciter) continue;
    const rewayat = findRewayat(candidate.reciter, candidate.rewayatId);
    if (!rewayat) continue;
    return {
      reciterId: candidate.reciter.id,
      rewayatId: rewayat.id,
      name: candidate.reciter.name,
      surahIds: availableSurahIds(rewayat),
    };
  }
  return null;
}

function surahItem(
  id: string,
  reciter: Reciter,
  rewayatId: string,
  surah: Surah,
  extra: Partial<CarItem>,
  request: CarItem['action'],
): CarItem {
  return {
    id,
    title: surah.name,
    subtitle: reciter.name,
    artwork: {kind: 'surah', surahId: surah.id},
    ...extra,
    action: request,
  };
}

function buildJumpBackIn(input: CarSnapshotInput): CarItem[] {
  return input.recentTracks
    .filter(t => !t.isUserUpload)
    .slice(0, JUMP_BACK_IN_LIMIT)
    .map(t => {
      const rewayatId = t.rewayatId || t.reciter.rewayat[0]?.id || '';
      return surahItem(
        `recent:${t.reciter.id}:${rewayatId}:${t.surah.id}`,
        t.reciter,
        rewayatId,
        t.surah,
        {progress: t.progress},
        {
          kind: 'play',
          request: {
            kind: 'surah',
            reciterId: t.reciter.id,
            rewayatId,
            surahId: t.surah.id,
            startAt: t.progress * t.duration,
          },
        },
      );
    });
}

function buildLovedList(input: CarSnapshotInput): CarList {
  const sorted = [...input.lovedTracks]
    .filter(t => !t.userRecitationId)
    .sort((a, b) => b.timestamp - a.timestamp);
  const items: CarItem[] = [];
  sorted.forEach(t => {
    const reciter = input.reciters.find(r => r.id === t.reciterId);
    const surah = input.surahs.find(s => s.id === Number(t.surahId));
    if (!reciter || !surah) return;
    items.push(
      surahItem(
        `loved:${t.reciterId}:${t.rewayatId}:${t.surahId}`,
        reciter,
        t.rewayatId,
        surah,
        {},
        {
          kind: 'play',
          request: {kind: 'loved', startIndex: items.length},
        },
      ),
    );
  });
  return {id: 'loved', title: 'Loved', items};
}

function buildDownloadsList(input: CarSnapshotInput): CarList {
  const items: CarItem[] = [];
  input.downloads
    .filter(d => d.status === 'completed')
    .forEach(d => {
      const reciter = input.reciters.find(r => r.id === d.reciterId);
      const surah = input.surahs.find(s => s.id === Number(d.surahId));
      if (!reciter || !surah) return;
      items.push(
        surahItem(
          `download:${d.reciterId}:${d.rewayatId}:${d.surahId}`,
          reciter,
          d.rewayatId,
          surah,
          {isDownloaded: true},
          {
            kind: 'play',
            request: {kind: 'downloads', startIndex: items.length},
          },
        ),
      );
    });
  return {id: 'downloads', title: 'Downloads', items};
}

function playlistEntries(input: CarSnapshotInput): CarItem[] {
  const user: CarItem[] = input.userPlaylists.map(p => ({
    id: `playlist:${p.id}`,
    title: p.name,
    subtitle: `${p.itemCount} surahs`,
    artwork: {kind: 'color', label: p.name, hex: p.color},
    action: {
      kind: 'browse',
      target: {kind: 'list', listId: `playlist:${p.id}`},
    },
  }));
  const system: CarItem[] = [...input.systemPlaylists]
    .sort((a, b) => a.order - b.order)
    .map(p => ({
      id: `system:${p.id}`,
      title: p.title,
      subtitle: p.subtitle,
      artwork: {kind: 'color', label: p.title, hex: p.backgroundColor},
      action: {
        kind: 'browse',
        target: {kind: 'list', listId: `system:${p.id}`},
      },
    }));
  return [...user, ...system];
}

function playlistLists(
  input: CarSnapshotInput,
  top: SituationalReciter | null,
): CarList[] {
  const lists: CarList[] = [];
  input.userPlaylists.forEach(p => {
    const items: CarItem[] = [];
    [...(input.playlistItems[p.id] ?? [])]
      .filter(i => !i.userRecitationId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .forEach(i => {
        const reciter = input.reciters.find(r => r.id === i.reciterId);
        const surah = input.surahs.find(s => s.id === Number(i.surahId));
        if (!reciter || !surah) return;
        const rewayatId = i.rewayatId ?? reciter.rewayat[0]?.id ?? '';
        items.push(
          surahItem(
            `pl:${p.id}:${i.id}`,
            reciter,
            rewayatId,
            surah,
            {},
            {
              kind: 'play',
              request: {
                kind: 'playlist',
                playlistId: p.id,
                system: false,
                startIndex: items.length,
              },
            },
          ),
        );
      });
    lists.push({id: `playlist:${p.id}`, title: p.name, items});
  });
  input.systemPlaylists.forEach(p => {
    const items: CarItem[] = [];
    p.items.forEach(i => {
      const reciterId = i.reciterId ?? top?.reciterId;
      const reciter = input.reciters.find(r => r.id === reciterId);
      const surah = input.surahs.find(s => s.id === i.surahId);
      if (!reciter || !surah) return;
      const rewayatId =
        i.rewayatId ?? findRewayat(reciter, top?.rewayatId)?.id ?? '';
      items.push(
        surahItem(
          `sys:${p.id}:${i.surahId}`,
          reciter,
          rewayatId,
          surah,
          {},
          {
            kind: 'play',
            request: {
              kind: 'playlist',
              playlistId: p.id,
              system: true,
              startIndex: items.length,
            },
          },
        ),
      );
    });
    lists.push({id: `system:${p.id}`, title: p.title, items});
  });
  return lists;
}

function reciterEntry(
  reciter: Reciter,
  input: CarSnapshotInput,
  isFavorite: boolean,
): CarReciter {
  return {
    id: reciter.id,
    name: reciter.name,
    artwork: input.resolveReciterArtwork(reciter),
    isFavorite,
    rewayat: reciter.rewayat.map(r => ({
      id: r.id,
      name: r.name,
      style: r.style,
      surahIds: availableSurahIds(r),
    })),
  };
}

function reciterBrowseItem(reciter: CarReciter): CarItem {
  return {
    id: `reciter:${reciter.id}`,
    title: reciter.name,
    artwork: reciter.artwork,
    action: {kind: 'browse', target: {kind: 'reciter', reciterId: reciter.id}},
  };
}

export function buildCarSnapshot(input: CarSnapshotInput): CarSnapshot {
  const top = pickTopReciter(input);
  const favorites = new Set(input.favoriteReciterIds);

  const reciters: CarReciter[] = [
    ...input.reciters
      .filter(r => favorites.has(r.id))
      .map(r => reciterEntry(r, input, true)),
    ...input.reciters
      .filter(r => !favorites.has(r.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(r => reciterEntry(r, input, false)),
  ];
  const favoriteReciters = reciters
    .filter(r => r.isFavorite)
    .map(reciterBrowseItem);

  const lastRecent = input.recentTracks.find(t => !t.isUserUpload);
  const lastRewayat = lastRecent
    ? findRewayat(lastRecent.reciter, lastRecent.rewayatId)
    : undefined;
  const situational = buildSituationalPicks({
    now: input.now,
    topReciter: top,
    lastPlayed:
      lastRecent && lastRewayat
        ? {
            reciterId: lastRecent.reciter.id,
            rewayatId: lastRewayat.id,
            reciterName: lastRecent.reciter.name,
            surahId: lastRecent.surah.id,
            completed: lastRecent.progress >= 0.95,
            surahIds: availableSurahIds(lastRewayat),
          }
        : null,
    systemPlaylists: input.systemPlaylists.map(p => ({
      id: p.id,
      title: p.title,
      color: p.backgroundColor,
    })),
    surahName: (id: number): string =>
      input.surahs.find(s => s.id === id)?.name ?? `Surah ${id}`,
  });

  const jumpBackIn = buildJumpBackIn(input);
  const loved = buildLovedList(input);
  const downloads = buildDownloadsList(input);
  const playlists = playlistEntries(input);

  const quickStart: CarItem[] = [];
  if (jumpBackIn.length > 0) {
    quickStart.push({
      id: 'quick:resume',
      title: 'Resume',
      subtitle: jumpBackIn[0].title,
      artwork: jumpBackIn[0].artwork,
      action: {kind: 'play', request: {kind: 'resume'}},
    });
  }
  if (loved.items.length > 0) {
    quickStart.push({
      id: 'quick:shuffle-loved',
      title: 'Shuffle Loved',
      artwork: {kind: 'color', label: 'Loved', hex: '#BE123C'},
      action: {kind: 'play', request: {kind: 'loved', shuffle: true}},
    });
  }
  situational.forEach(item => {
    if (quickStart.length < QUICK_START_LIMIT) quickStart.push(item);
  });

  const allSections: CarSection[] = [
    {id: 'for-now', title: 'For right now', style: 'cards', items: situational},
    {
      id: 'jump-back-in',
      title: 'Jump back in',
      style: 'rows',
      items: jumpBackIn,
    },
    {
      id: 'your-reciters',
      title: 'Your reciters',
      style: 'circles',
      items: favoriteReciters,
    },
    {
      id: 'your-playlists',
      title: 'Your playlists',
      style: 'rows',
      items: playlists,
    },
  ];
  const sections = allSections.filter(section => section.items.length > 0);

  const lists: Record<string, CarList> = {
    loved,
    downloads,
    playlists: {id: 'playlists', title: 'Playlists', items: playlists},
    'favorite-reciters': {
      id: 'favorite-reciters',
      title: 'Favorite reciters',
      items: favoriteReciters,
    },
  };
  playlistLists(input, top).forEach(list => {
    lists[list.id] = list;
  });

  const library: CarItem[] = [
    {
      id: 'lib:loved',
      title: 'Loved',
      artwork: {kind: 'color', label: 'Loved', hex: '#BE123C'},
      action: {kind: 'browse', target: {kind: 'list', listId: 'loved'}},
    },
    {
      id: 'lib:playlists',
      title: 'Playlists',
      artwork: {kind: 'color', label: 'Playlists', hex: '#0F766E'},
      action: {kind: 'browse', target: {kind: 'list', listId: 'playlists'}},
    },
    {
      id: 'lib:downloads',
      title: 'Downloads',
      artwork: {kind: 'color', label: 'Downloads', hex: '#1D4ED8'},
      action: {kind: 'browse', target: {kind: 'list', listId: 'downloads'}},
    },
    {
      id: 'lib:favorite-reciters',
      title: 'Favorite reciters',
      artwork: {kind: 'color', label: 'Reciters', hex: '#7C3AED'},
      action: {
        kind: 'browse',
        target: {kind: 'list', listId: 'favorite-reciters'},
      },
    },
  ];

  const juzMap = new Map<number, number[]>();
  input.surahs.forEach(s => {
    const juz = input.surahToJuz[s.id];
    if (juz === undefined) return;
    juzMap.set(juz, [...(juzMap.get(juz) ?? []), s.id]);
  });

  return {
    version: 1,
    generatedAt: input.now.toISOString(),
    topReciterId: top?.reciterId ?? null,
    home: {quickStart, sections},
    library,
    lists,
    reciters,
    surahs: input.surahs.map(s => ({
      id: s.id,
      name: s.name,
      nameArabic: s.name_arabic,
      translation: s.translated_name_english,
      versesCount: s.verses_count,
    })),
    juz: [...juzMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, surahIds]) => ({number, surahIds})),
    downloadedKeys: input.downloads
      .filter(d => d.status === 'completed')
      .map(d => downloadKey(d.reciterId, d.rewayatId, Number(d.surahId))),
  };
}
