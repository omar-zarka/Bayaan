// app/player.tsx
import React, {useEffect} from 'react';
import {Redirect} from 'expo-router';
import {usePlayerStore} from '@/services/player/store/playerStore';

// bayaan://player (widgets): land on home with the full player open.
export default function PlayerDeepLink(): React.ReactElement {
  useEffect(() => {
    usePlayerStore.getState().setSheetMode('full');
  }, []);
  return <Redirect href="/(tabs)/(a.home)" />;
}
