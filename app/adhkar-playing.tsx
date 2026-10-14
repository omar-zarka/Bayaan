// bayaan://adhkar-playing (lock screen, Live Activity): the playing dhikr's
// reader, or the Adhkar screen when nothing is playing or saved.
import {useEffect} from 'react';
import {useRouter} from 'expo-router';
import {openPlayingDhikr} from '@/services/adhkar/playback/openPlayingDhikr';

export default function AdhkarPlayingRoute(): null {
  const router = useRouter();
  useEffect(() => {
    if (!openPlayingDhikr(router, 'replace', null)) {
      router.replace('/(tabs)/(a.home)/adhkar');
    }
  }, [router]);
  return null;
}
