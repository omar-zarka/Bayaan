// bayaan://adhkar-playing (lock screen, Live Activity): the playing dhikr's
// reader, or the Adhkar screen when nothing is playing or saved. A cold launch
// mounts this before navigation is ready and before the saved session is
// restored, so it waits for both (the restore for at most RESTORE_WAIT_MS).
import {useEffect, useRef} from 'react';
import {
  useNavigationContainerRef,
  useRootNavigationState,
  useRouter,
} from 'expo-router';
import {
  ADHKAR_SCREEN,
  adhkarStackAction,
  openPlayingDhikr,
} from '@/services/adhkar/playback/openPlayingDhikr';
import {waitForSessionRestore} from '@/services/adhkar/playback/sessionPersistence';

const RESTORE_WAIT_MS = 3000;

export default function AdhkarPlayingRoute(): null {
  const navigation = useNavigationContainerRef();
  const rootState = useRootNavigationState();
  const router = useRouter();
  const started = useRef(false);
  const unmounted = useRef(false);

  useEffect(
    () => () => {
      unmounted.current = true;
    },
    [],
  );

  useEffect(() => {
    if (started.current || rootState?.key == null || !navigation.isReady()) {
      return;
    }
    started.current = true;
    waitForSessionRestore(RESTORE_WAIT_MS).then(() => {
      if (unmounted.current) return;
      // Leave this route on the container itself, so the navigation below
      // runs against the tabs. Replacing this route with a tab route instead
      // would stack a second copy of the tabs with nothing to go back to.
      if (navigation.canGoBack()) navigation.goBack();
      else router.replace('/(tabs)/(a.home)');
      if (!openPlayingDhikr(navigation, null)) {
        navigation.dispatch(adhkarStackAction([ADHKAR_SCREEN]));
      }
    });
  }, [navigation, rootState?.key, router]);
  return null;
}
