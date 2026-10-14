// bayaan://adhkar-playing (lock screen, Live Activity): the playing dhikr's
// reader, or the Adhkar screen when nothing is playing or saved. A cold launch
// mounts this before the saved session is restored, so it waits for the
// restore first (at most RESTORE_WAIT_MS).
import {useEffect} from 'react';
import {useRouter} from 'expo-router';
import {openPlayingDhikr} from '@/services/adhkar/playback/openPlayingDhikr';
import {waitForSessionRestore} from '@/services/adhkar/playback/sessionPersistence';

const RESTORE_WAIT_MS = 3000;

export default function AdhkarPlayingRoute(): null {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    waitForSessionRestore(RESTORE_WAIT_MS).then(() => {
      if (cancelled) return;
      if (!openPlayingDhikr(router, 'replace', null)) {
        router.replace('/(tabs)/(a.home)/adhkar');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}
