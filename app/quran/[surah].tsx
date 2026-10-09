// app/quran/[surah].tsx
import React from 'react';
import {Redirect, useLocalSearchParams} from 'expo-router';

// Canonical /quran/{surah}?ayah=N URL (widgets, App Links). Hands off to the reader.
export default function QuranSurahLink(): React.ReactElement {
  const {surah, ayah} = useLocalSearchParams<{surah: string; ayah?: string}>();
  return (
    <Redirect
      href={{pathname: '/mushaf', params: ayah ? {surah, ayah} : {surah}}}
    />
  );
}
