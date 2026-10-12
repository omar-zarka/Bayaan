// app/quran/[surah].tsx
import React from 'react';
import {Redirect, useLocalSearchParams} from 'expo-router';
import {digitalKhattDataService} from '@/services/mushaf/DigitalKhattDataService';
import {quranLinkParams} from '@/utils/quranLink';

// Canonical /quran/{surah}?ayah=N URL (widgets, App Links). Hands off to the reader.
export default function QuranSurahLink(): React.ReactElement {
  const {surah, ayah} = useLocalSearchParams<{surah: string; ayah?: string}>();
  const params = quranLinkParams(surah, ayah, verseKey =>
    digitalKhattDataService.initialized
      ? digitalKhattDataService.getPageForVerse(verseKey)
      : undefined,
  );
  return <Redirect href={{pathname: '/mushaf', params}} />;
}
