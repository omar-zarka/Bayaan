import {Platform} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useResponsive} from '@/hooks/useResponsive'; // @ai
import {
  FLOATING_PLAYER_HEIGHT,
  TAB_BAR_HEIGHT,
  FLOATING_PLAYER_BOTTOM_MARGIN,
  FLOATING_TAB_BAR_BOTTOM_MARGIN,
} from '@/utils/constants';

// iOS NativeTabs: standard UITabBar content height (excludes safe area)
const IOS_TAB_BAR_HEIGHT = 49;
// iOS BottomAccessory (MiniPlayer): paddingTop(8) + artwork(36) + paddingBottom(20)
const IOS_MINI_PLAYER_HEIGHT = 64;

// @ai-start
/**
 * Bottom padding that scrolling content needs to clear the bottom chrome.
 *
 * - Tablet: the sidebar shell has no bottom tab bar and docks the mini
 *   player in the sidebar, so only the home-indicator safe area remains.
 * - iOS phone: NativeTabs tab bar + BottomAccessory (MiniPlayer) + safe area.
 * - Android phone: floating tab bar + floating player + margins + safe area.
 */
export function computeBottomInset({
  platform,
  isTablet,
  safeAreaBottom,
  hasTrack,
}: {
  platform: string;
  isTablet: boolean;
  safeAreaBottom: number;
  hasTrack: boolean;
}): number {
  if (isTablet) return safeAreaBottom;

  if (platform === 'ios') {
    let bottom = IOS_TAB_BAR_HEIGHT + safeAreaBottom;
    if (hasTrack) {
      bottom += IOS_MINI_PLAYER_HEIGHT;
    }
    return bottom;
  }

  let bottom = TAB_BAR_HEIGHT + FLOATING_TAB_BAR_BOTTOM_MARGIN + safeAreaBottom;

  if (hasTrack) {
    bottom += FLOATING_PLAYER_HEIGHT + FLOATING_PLAYER_BOTTOM_MARGIN;
  }

  return bottom;
}
// @ai-end

/**
 * Returns the total bottom padding needed for tab screen content
 * to clear the tab bar and mini player. See computeBottomInset.
 */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  const {isTablet} = useResponsive(); // @ai
  const hasTrack = usePlayerStore(state => {
    const tracks = state.queue.tracks;
    const index = state.queue.currentIndex;
    return tracks.length > 0 && tracks[index] != null;
  });

  return computeBottomInset({
    platform: Platform.OS,
    isTablet,
    safeAreaBottom: insets.bottom,
    hasTrack,
  }); // @ai
}
