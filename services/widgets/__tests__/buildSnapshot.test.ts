// services/widgets/__tests__/buildSnapshot.test.ts
import {buildSnapshot, artworkFileName, SnapshotInput} from '../buildSnapshot';
import {isWidgetSnapshot} from 'bayaan-widgets';
import type {Track} from '@/types/audio';
import type {Reciter} from '@/data/reciterData';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';
import {SURAHS} from '@/data/surahData';

const reciter: Reciter = {
  id: 'r1',
  name: 'Mishary Alafasi',
  date: null,
  image_url: 'https://example.com/a.jpg',
  rewayat: [],
};

function track(surahId: number, extra: Partial<Track> = {}): Track {
  return {
    id: `r1-${surahId}`,
    url: 'https://example.com/a.mp3',
    title: SURAHS[surahId - 1].name,
    artist: reciter.name,
    reciterId: 'r1',
    reciterName: reciter.name,
    surahId: String(surahId),
    rewayatId: 'rw1',
    ...extra,
  };
}

function input(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    now: 1_791_460_800_000,
    theme: 'system',
    queueTracks: [],
    currentIndex: 0,
    isPlaying: false,
    positionSec: 0,
    durationSec: 0,
    recentTracks: [],
    defaultReciter: reciter,
    lastReadPage: null,
    openingTextForPage: () => 'opening',
    tasbeeh: {},
    artworkFileFor: id => artworkFileName(id),
    surahOfTheDayId: 36,
    ...overrides,
  };
}

describe('buildSnapshot', () => {
  it('produces a valid snapshot on a fresh install', () => {
    const snap = buildSnapshot(input());
    expect(isWidgetSnapshot(snap)).toBe(true);
    expect(snap.nowPlaying).toBeNull();
    expect(snap.lastRead).toBeNull();
    // Empty state hint: surah of the day with default reciter
    expect(snap.recent).toEqual([]);
    expect(snap.upNext[0]?.surahId).toBe(36);
  });

  it('treats the empty placeholder reciter as no default reciter', () => {
    const placeholder: Reciter = {
      id: '',
      name: '',
      date: null,
      image_url: null,
      rewayat: [],
    };
    const snap = buildSnapshot(input({defaultReciter: placeholder}));
    expect(snap.defaultReciter).toBeNull();
    expect(snap.upNext).toEqual([]);
  });

  it('maps the current track, next 3 tracks and playback state', () => {
    const snap = buildSnapshot(
      input({
        queueTracks: [track(18), track(36), track(67), track(55), track(56)],
        currentIndex: 0,
        isPlaying: true,
        positionSec: 120,
        durationSec: 1800,
      }),
    );
    expect(snap.nowPlaying?.track.surahId).toBe(18);
    expect(snap.nowPlaying?.isPlaying).toBe(true);
    expect(snap.upNext.map(t => t.surahId)).toEqual([36, 67, 55]);
    expect(snap.nowPlaying?.track.artworkFile).toBe('reciter-r1.jpg');
  });

  it('handles a user upload without a surah', () => {
    const upload = track(1, {
      surahId: undefined,
      isUserUpload: true,
      title: 'My recitation',
    });
    const snap = buildSnapshot(input({queueTracks: [upload]}));
    expect(snap.nowPlaying?.track.surahId).toBe(0);
    expect(snap.nowPlaying?.track.surahName).toBe('My recitation');
    expect(snap.nowPlaying?.track.isUserUpload).toBe(true);
  });

  it('maps recents (max 6) and per reciter recents (max 3)', () => {
    const recent: RecentlyPlayedTrack[] = [1, 2, 3, 4, 5, 6, 7].map(id => ({
      reciter,
      surah: SURAHS[id - 1],
      rewayatId: 'rw1',
      progress: 0.5,
      duration: 100,
      timestamp: 1000 - id,
    }));
    const snap = buildSnapshot(input({recentTracks: recent}));
    expect(snap.recent).toHaveLength(6);
    expect(snap.reciterRecents.r1.map(t => t.surahId)).toEqual([1, 2, 3]);
  });

  it('builds last read with juz and opening text', () => {
    const snap = buildSnapshot(input({lastReadPage: 295}));
    expect(snap.lastRead).toEqual({
      page: 295,
      surahId: 18,
      surahName: SURAHS[17].name,
      juz: 15,
      openingText: 'opening',
    });
  });
});
