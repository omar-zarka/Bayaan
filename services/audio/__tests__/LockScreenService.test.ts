const mockSetActive = jest.fn();
const mockPlayer = {
  setActiveForLockScreen: mockSetActive,
  clearLockScreenControls: jest.fn(),
};

jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: {
    getState: () => ({
      queue: {
        tracks: [{id: 't1', title: 'Al-Fatihah', artist: 'Reciter'}],
        currentIndex: 0,
      },
    }),
    subscribe: jest.fn(),
  },
}));
jest.mock('@/store/mushafPlayerStore', () => ({
  useMushafPlayerStore: {subscribe: jest.fn()},
}));
jest.mock('../ExpoAudioService', () => ({
  expoAudioService: {getPlayer: () => mockPlayer},
}));
jest.mock('../MushafAudioService', () => ({
  mushafAudioService: {getPlayer: () => null},
}));
jest.mock('../AudioCoordinator', () => ({audioCoordinator: {}}));

import {lockScreenService} from '../LockScreenService';

describe('LockScreenService car mode', () => {
  beforeEach(() => mockSetActive.mockClear());

  it('hides the skip buttons while a car is connected and restores them', () => {
    lockScreenService.setCarMode(true);
    expect(mockSetActive).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({title: 'Al-Fatihah'}),
      {showSeekForward: false, showSeekBackward: false},
    );
    lockScreenService.setCarMode(false);
    expect(mockSetActive).toHaveBeenLastCalledWith(true, expect.anything(), {
      showSeekForward: true,
      showSeekBackward: true,
    });
  });

  it('does nothing when the mode is unchanged', () => {
    lockScreenService.setCarMode(false);
    expect(mockSetActive).not.toHaveBeenCalled();
  });
});
