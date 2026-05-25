import branding from '@/config/branding';
import {RECITERS, type Rewayat} from '@/data/reciterData';
import {timestampDatabaseService} from './TimestampDatabaseService';
import type {AyahTimestamp} from '@/types/timestamps';

// RFC-015 — fork-supplied timestamp CDN base. Absent from `branding.js`
// → fallback to Bayaan's production CDN (byte-equivalent to the
// pre-RFC-015 hardcoded value). Forks set `branding.timestampCdnBase`
// to their own mirror's base. No trailing slash; the URL is composed
// below as `${R2_BASE}/${rewayatId}/${paddedSurah}.json`.
const R2_BASE =
  branding.timestampCdnBase ?? 'https://cdn.thebayaan.com/timestamps';

class TimestampFetchService {
  /**
   * Returns true if a rewayat has any timestamp coverage on R2.
   * Reads the static `has_timestamps` flag set by the mirror script.
   */
  hasSource(rewayatId: string): boolean {
    const rw = this.findRewayat(rewayatId);
    return Boolean(rw?.has_timestamps);
  }

  /**
   * Returns true if R2 has timestamps for this specific surah.
   * Falls back to `has_timestamps` when `timestamps_surah_list` is absent.
   */
  hasSurah(rewayatId: string, surahNumber: number): boolean {
    const rw = this.findRewayat(rewayatId);
    if (!rw?.has_timestamps) return false;
    if (!rw.timestamps_surah_list || rw.timestamps_surah_list.length === 0) {
      return true;
    }
    return rw.timestamps_surah_list.includes(surahNumber);
  }

  async fetchAndCache(
    rewayatId: string,
    surahNumber: number,
  ): Promise<AyahTimestamp[] | null> {
    if (!this.hasSurah(rewayatId, surahNumber)) return null;

    const padded = String(surahNumber).padStart(3, '0');
    const url = `${R2_BASE}/${rewayatId}/${padded}.json`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(
          `[TimestampFetch] R2 ${res.status} for ${rewayatId} surah ${surahNumber}`,
        );
        return null;
      }
      const data = (await res.json()) as AyahTimestamp[];
      if (!Array.isArray(data) || data.length === 0) return null;

      await timestampDatabaseService.writeTimestamps(
        rewayatId,
        surahNumber,
        data,
        'r2',
      );

      return data;
    } catch (error) {
      console.warn(
        `[TimestampFetch] Failed to fetch ${rewayatId} surah ${surahNumber}:`,
        error,
      );
      return null;
    }
  }

  private findRewayat(rewayatId: string): Rewayat | undefined {
    for (const reciter of RECITERS) {
      const rw = reciter.rewayat.find(r => r.id === rewayatId);
      if (rw) return rw;
    }
    return undefined;
  }
}

export const timestampFetchService = new TimestampFetchService();
