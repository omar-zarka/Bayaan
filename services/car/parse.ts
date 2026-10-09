import {CarPlayRequest, CarTransport} from '@/services/car/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function safeJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function parseCarPlayRequest(json: string): CarPlayRequest | null {
  const v = safeJson(json);
  if (!isRecord(v)) return null;
  switch (v.kind) {
    case 'surah': {
      const reciterId = str(v.reciterId);
      const rewayatId = str(v.rewayatId);
      const surahId = num(v.surahId);
      if (!reciterId || !rewayatId || surahId === undefined) return null;
      return {
        kind: 'surah',
        reciterId,
        rewayatId,
        surahId,
        startAt: num(v.startAt),
      };
    }
    case 'playlist': {
      const playlistId = str(v.playlistId);
      if (!playlistId) return null;
      return {
        kind: 'playlist',
        playlistId,
        system: v.system === true,
        startIndex: num(v.startIndex),
      };
    }
    case 'loved':
      return {
        kind: 'loved',
        shuffle: v.shuffle === true,
        startIndex: num(v.startIndex),
      };
    case 'downloads':
      return {kind: 'downloads', startIndex: num(v.startIndex)};
    case 'resume':
      return {kind: 'resume'};
    default:
      return null;
  }
}

export function parseCarTransport(json: string): CarTransport | null {
  const v = safeJson(json);
  if (!isRecord(v)) return null;
  switch (v.kind) {
    case 'next':
    case 'previous':
    case 'play':
    case 'pause':
    case 'cycleRate':
    case 'cycleRepeat':
    case 'toggleLove':
      return {kind: v.kind};
    case 'seek': {
      const position = num(v.position);
      return position === undefined ? null : {kind: 'seek', position};
    }
    case 'rate': {
      const value = num(v.value);
      return value === undefined ? null : {kind: 'rate', value};
    }
    case 'jumpTo': {
      const index = num(v.index);
      return index === undefined ? null : {kind: 'jumpTo', index};
    }
    default:
      return null;
  }
}
