// app/player.tsx
import {useEffect} from 'react';
import {useNavigationContainerRef} from 'expo-router';
import {expandPlayerSheet} from '@/services/player/sheetRef';

// Expanding while the navigation transition runs gets cancelled by the
// sheet's onChange, so open it once navigation has settled.
const EXPAND_DELAY_MS = 400;

// bayaan://player (widgets): the full player over the screen underneath.
export default function PlayerDeepLink(): null {
  const navigation = useNavigationContainerRef();
  useEffect(() => {
    // Leave this route. Replacing it with a tab route instead would stack a
    // second copy of the tabs with nothing to go back to.
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.dispatch({type: 'REPLACE', payload: {name: '(tabs)'}});
    // Not cleared on unmount: leaving unmounts this screen right away.
    setTimeout(expandPlayerSheet, EXPAND_DELAY_MS);
  }, [navigation]);
  return null;
}
