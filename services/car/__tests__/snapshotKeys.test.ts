import {recentTracksKey} from '../snapshotKeys';
import type {RecentlyPlayedTrack} from '@/services/player/store/recentlyPlayedStore';

function entry(
  reciterId: string,
  surahId: number,
  progress: number,
  isUserUpload?: boolean,
): RecentlyPlayedTrack {
  return {
    reciter: {
      id: reciterId,
      name: reciterId,
      date: null,
      image_url: null,
      rewayat: [],
    },
    surah: {
      id: surahId,
      name: 's',
      revelation_place: 'Makkah',
      revelation_order: 1,
      bismillah_pre: false,
      name_arabic: 's',
      verses_count: 1,
      pages: '1',
      translated_name_english: 's',
    },
    rewayatId: 'w',
    progress,
    duration: 100,
    timestamp: 1,
    isUserUpload,
  };
}

describe('recentTracksKey', () => {
  it('ignores progress ticks within the same tenth', () => {
    expect(recentTracksKey([entry('a', 1, 0.41)])).toBe(
      recentTracksKey([entry('a', 1, 0.49)]),
    );
  });
  it('changes when progress crosses a tenth, so bars stay current', () => {
    expect(recentTracksKey([entry('a', 1, 0.1)])).not.toBe(
      recentTracksKey([entry('a', 1, 0.9)]),
    );
    expect(recentTracksKey([entry('a', 1, 0.39)])).not.toBe(
      recentTracksKey([entry('a', 1, 0.4)]),
    );
  });
  it('treats out of range progress as its bound', () => {
    expect(recentTracksKey([entry('a', 1, Number.NaN)])).toBe(
      recentTracksKey([entry('a', 1, 0)]),
    );
    expect(recentTracksKey([entry('a', 1, 3)])).toBe(
      recentTracksKey([entry('a', 1, 1)]),
    );
  });
  it('changes with order, membership and upload flag', () => {
    const base = recentTracksKey([entry('a', 1, 0), entry('b', 2, 0)]);
    expect(recentTracksKey([entry('b', 2, 0), entry('a', 1, 0)])).not.toBe(
      base,
    );
    expect(recentTracksKey([entry('a', 1, 0)])).not.toBe(base);
    expect(
      recentTracksKey([entry('a', 1, 0, true), entry('b', 2, 0)]),
    ).not.toBe(base);
  });
});
