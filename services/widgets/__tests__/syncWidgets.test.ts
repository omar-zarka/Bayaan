import type {QueuedWidgetCommand, WidgetCommand} from 'bayaan-widgets';

const mockTakeQueuedCommands = jest.fn<QueuedWidgetCommand[], []>();
const mockHandleWidgetCommand = jest.fn<Promise<void>, [WidgetCommand]>();

jest.mock('bayaan-widgets', () => ({
  changedWidgetKinds: jest.fn(() => []),
  isWidgetsAvailable: jest.fn(() => true),
  reloadWidgets: jest.fn(),
  writeSnapshot: jest.fn(),
  cacheArtwork: jest.fn(),
  hasArtwork: jest.fn(() => false),
  addWidgetCommandListener: jest.fn(() => ({remove: jest.fn()})),
  takeQueuedCommands: () => mockTakeQueuedCommands(),
  selectFreshCommands: (queued: QueuedWidgetCommand[]) =>
    queued.map(q => q.command),
}));
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {},
}));
jest.mock('@/services/player/store/recentlyPlayedStore', () => ({
  useRecentlyPlayedStore: {},
}));
jest.mock('@/store/reciterStore', () => ({useReciterStore: {}}));
jest.mock('@/store/themeStore', () => ({useThemeStore: {}}));
jest.mock('@/services/dataService', () => ({getReciterByIdSync: jest.fn()}));
jest.mock('@/utils/artworkUtils', () => ({getReciterArtwork: jest.fn()}));
jest.mock('../buildSnapshot', () => ({
  buildSnapshot: jest.fn(),
  artworkFileName: jest.fn(),
}));
jest.mock('../collectSnapshotInput', () => ({collectSnapshotInput: jest.fn()}));
jest.mock('../handleWidgetCommand', () => ({
  handleWidgetCommand: (command: WidgetCommand) =>
    mockHandleWidgetCommand(command),
}));

type SyncModule = typeof import('../syncWidgets');

function queued(command: WidgetCommand): QueuedWidgetCommand {
  return {command, enqueuedAt: Date.now()};
}

const toggle: WidgetCommand = {type: 'togglePlayback'};
const playReciter: WidgetCommand = {type: 'playReciter', reciterId: 'r1'};

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

function loadModule(): SyncModule {
  let mod: SyncModule | null = null;
  jest.isolateModules(() => {
    mod = require('../syncWidgets');
  });
  if (!mod) throw new Error('module failed to load');
  return mod;
}

describe('drainWidgetCommands', () => {
  beforeEach(() => {
    mockTakeQueuedCommands.mockReset();
    mockTakeQueuedCommands.mockReturnValue([]);
    mockHandleWidgetCommand.mockReset();
    mockHandleWidgetCommand.mockResolvedValue(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('does nothing before the player is ready', async () => {
    const sync = loadModule();
    mockTakeQueuedCommands.mockReturnValue([queued(toggle)]);
    await sync.drainWidgetCommands();
    expect(mockTakeQueuedCommands).not.toHaveBeenCalled();
    expect(mockHandleWidgetCommand).not.toHaveBeenCalled();
  });

  it('drains once markPlayerReadyForWidgets is called', async () => {
    const sync = loadModule();
    mockTakeQueuedCommands.mockReturnValueOnce([queued(toggle)]);
    mockTakeQueuedCommands.mockReturnValue([]);
    sync.markPlayerReadyForWidgets();
    await sync.drainWidgetCommands();
    expect(mockHandleWidgetCommand).toHaveBeenCalledWith(toggle);
  });

  it('continues past a command that throws', async () => {
    const sync = loadModule();
    sync.markPlayerReadyForWidgets();
    await flush();
    mockHandleWidgetCommand.mockReset();
    mockTakeQueuedCommands.mockReset();
    mockTakeQueuedCommands.mockReturnValueOnce([
      queued(toggle),
      queued(playReciter),
    ]);
    mockTakeQueuedCommands.mockReturnValue([]);
    mockHandleWidgetCommand
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);
    await sync.drainWidgetCommands();
    expect(mockHandleWidgetCommand).toHaveBeenCalledTimes(2);
    expect(mockHandleWidgetCommand).toHaveBeenLastCalledWith(playReciter);
    expect(console.error).toHaveBeenCalled();
  });

  it('never runs two drains concurrently and re-drains without dropping commands', async () => {
    const sync = loadModule();
    sync.markPlayerReadyForWidgets();
    await flush();
    mockHandleWidgetCommand.mockReset();
    mockTakeQueuedCommands.mockReset();

    let release: () => void = () => undefined;
    let active = 0;
    let maxActive = 0;
    mockHandleWidgetCommand.mockImplementation(async command => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (command === toggle) {
        await new Promise<void>(resolve => {
          release = resolve;
        });
      }
      active -= 1;
    });
    mockTakeQueuedCommands
      .mockReturnValueOnce([queued(toggle)])
      .mockReturnValueOnce([queued(playReciter)])
      .mockReturnValue([]);

    const first = sync.drainWidgetCommands();
    await Promise.resolve();
    const second = sync.drainWidgetCommands();
    await second;
    expect(mockHandleWidgetCommand).toHaveBeenCalledTimes(1);

    release();
    await first;
    expect(mockHandleWidgetCommand).toHaveBeenCalledTimes(2);
    expect(mockHandleWidgetCommand).toHaveBeenLastCalledWith(playReciter);
    expect(maxActive).toBe(1);
  });
});
