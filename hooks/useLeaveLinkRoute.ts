import {useEffect, useRef} from 'react';
import {
  useNavigationContainerRef,
  useRootNavigationState,
  useRouter,
} from 'expo-router';

/**
 * For a root route that only handles a link (bayaan://player, an unknown
 * path): step off the root stack and show the screen underneath, then call
 * `onLeft` (pass a stable function). Redirecting to a tab route instead would
 * stack a second copy of the tabs with nothing to go back to.
 *
 * Waits until navigation is ready: a cold launch mounts the route first, and
 * canGoBack() reads false until then.
 */
export function useLeaveLinkRoute(onLeft?: () => void): void {
  const navigation = useNavigationContainerRef();
  const rootState = useRootNavigationState();
  const router = useRouter();
  const left = useRef(false);

  useEffect(() => {
    if (left.current || rootState?.key == null || !navigation.isReady()) {
      return;
    }
    left.current = true;
    // The tabs sit under every root route (initialRouteName), so this is the
    // normal path. The replace only covers a stack that somehow lacks them.
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace('/(tabs)/(a.home)');
    onLeft?.();
  }, [navigation, rootState?.key, router, onLeft]);
}
