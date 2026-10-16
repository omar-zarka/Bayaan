import {useEffect, useRef} from 'react';
import {useNavigation} from 'expo-router';

/**
 * For a root route that only handles a link (bayaan://player, an unknown
 * path): step off the root stack and show the screen underneath, then call
 * `onLeft` (pass a stable function). Redirecting to a tab route instead would
 * stack a second copy of the tabs with nothing to go back to.
 *
 * Uses the route's own navigation, not the container: on a cold launch the
 * container's state has not filled in the root stack yet, so its canGoBack()
 * reads false even with the tabs underneath.
 */
export function useLeaveLinkRoute(onLeft?: () => void): void {
  const navigation = useNavigation();
  const left = useRef(false);

  useEffect(() => {
    if (left.current) return;
    left.current = true;
    // The tabs sit under every root route (initialRouteName), so this is the
    // normal path. The replace only covers a stack that somehow lacks them.
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.dispatch({type: 'REPLACE', payload: {name: '(tabs)'}});
    onLeft?.();
  }, [navigation, onLeft]);
}
