import {
  isWidgetCommand,
  parseQueuedCommands,
  selectFreshCommands,
  QueuedWidgetCommand,
} from '../commands';

const NOW = 1_791_460_800_000;

describe('isWidgetCommand', () => {
  it('accepts each command shape', () => {
    expect(isWidgetCommand({type: 'togglePlayback'})).toBe(true);
    expect(
      isWidgetCommand({
        type: 'playTrack',
        surahId: 18,
        reciterId: null,
        rewayatId: null,
        ayah: 10,
      }),
    ).toBe(true);
    expect(isWidgetCommand({type: 'playReciter', reciterId: 'r1'})).toBe(true);
  });

  it('rejects unknown types and bad fields', () => {
    expect(isWidgetCommand({type: 'deleteEverything'})).toBe(false);
    expect(
      isWidgetCommand({
        type: 'playTrack',
        surahId: 0,
        reciterId: null,
        rewayatId: null,
        ayah: null,
      }),
    ).toBe(false);
    expect(
      isWidgetCommand({
        type: 'playTrack',
        surahId: 115,
        reciterId: null,
        rewayatId: null,
        ayah: null,
      }),
    ).toBe(false);
    expect(isWidgetCommand({type: 'playReciter', reciterId: ''})).toBe(false);
    expect(isWidgetCommand(null)).toBe(false);
  });
});

describe('parseQueuedCommands', () => {
  it('returns [] for invalid JSON', () => {
    expect(parseQueuedCommands('not json')).toEqual([]);
    expect(parseQueuedCommands('{}')).toEqual([]);
  });

  it('drops malformed entries but keeps valid ones', () => {
    const json = JSON.stringify([
      {command: {type: 'togglePlayback'}, enqueuedAt: NOW},
      {command: {type: 'nope'}, enqueuedAt: NOW},
      {command: {type: 'togglePlayback'}},
    ]);
    expect(parseQueuedCommands(json)).toHaveLength(1);
  });
});

describe('selectFreshCommands', () => {
  it('drops commands older than 60s and orders oldest first', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'playReciter', reciterId: 'b'}, enqueuedAt: NOW - 1_000},
      {command: {type: 'togglePlayback'}, enqueuedAt: NOW - 61_000},
      {command: {type: 'playReciter', reciterId: 'a'}, enqueuedAt: NOW - 5_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([
      {type: 'playReciter', reciterId: 'b'},
    ]);
  });

  it('collapses consecutive togglePlayback pairs so a double tap is a no-op', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'togglePlayback'}, enqueuedAt: NOW - 3_000},
      {command: {type: 'togglePlayback'}, enqueuedAt: NOW - 2_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([]);
  });

  it('when a play command exists, only the last play command survives', () => {
    const queued: QueuedWidgetCommand[] = [
      {command: {type: 'playReciter', reciterId: 'a'}, enqueuedAt: NOW - 3_000},
      {command: {type: 'togglePlayback'}, enqueuedAt: NOW - 2_000},
      {command: {type: 'playReciter', reciterId: 'b'}, enqueuedAt: NOW - 1_000},
    ];
    expect(selectFreshCommands(queued, NOW)).toEqual([
      {type: 'playReciter', reciterId: 'b'},
    ]);
  });
});
