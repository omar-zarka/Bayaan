// @ai-generated
jest.mock('@/services/player/store/playerStore', () => ({
  usePlayerStore: jest.fn(),
}));

import {computeBottomInset} from '@/hooks/useBottomInset';
import {
  FLOATING_PLAYER_BOTTOM_MARGIN,
  FLOATING_PLAYER_HEIGHT,
  FLOATING_TAB_BAR_BOTTOM_MARGIN,
  TAB_BAR_HEIGHT,
} from '@/utils/constants';

const safeAreaBottom = 20;

describe('computeBottomInset', () => {
  it('only clears the home indicator on tablets, with or without a track', () => {
    for (const platform of ['ios', 'android']) {
      for (const hasTrack of [false, true]) {
        expect(
          computeBottomInset({
            platform,
            isTablet: true,
            safeAreaBottom,
            hasTrack,
          }),
        ).toBe(safeAreaBottom);
      }
    }
  });

  it('clears the iOS tab bar, plus the mini player while a track is loaded', () => {
    const base = {platform: 'ios', isTablet: false, safeAreaBottom};
    expect(computeBottomInset({...base, hasTrack: false})).toBe(49 + 20);
    expect(computeBottomInset({...base, hasTrack: true})).toBe(49 + 20 + 64);
  });

  it('clears the Android floating tab bar and player', () => {
    const base = {platform: 'android', isTablet: false, safeAreaBottom};
    const tabBar = TAB_BAR_HEIGHT + FLOATING_TAB_BAR_BOTTOM_MARGIN + 20;
    expect(computeBottomInset({...base, hasTrack: false})).toBe(tabBar);
    expect(computeBottomInset({...base, hasTrack: true})).toBe(
      tabBar + FLOATING_PLAYER_HEIGHT + FLOATING_PLAYER_BOTTOM_MARGIN,
    );
  });
});
