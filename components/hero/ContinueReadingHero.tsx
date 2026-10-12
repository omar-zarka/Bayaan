import React, {useCallback, useMemo, useState} from 'react';
import {View, ViewStyle} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {useFocusEffect} from 'expo-router';
import {Surah} from '@/data/surahData';
import {mushafSessionStore} from '@/services/mushaf/MushafSessionStore';
import {useQfSyncStore} from '@/store/qfSyncStore';
import {getSurahOfTheDay, getSurahForPage} from '@/utils/quranPages';
import {HeroSection} from './HeroSection';
import {SurahHeroSection} from './SurahsHero';

interface ContinueReadingHeroProps {
  onSurahLongPress?: (surah: Surah) => void;
}

const SECTION_HEIGHT = moderateScale(150);

function readLastPageForRevision(
  _scopeRevision: number,
  _dataRevision: number,
): number | null {
  return mushafSessionStore.getLastReadPage();
}

/**
 * Hero section for the Surahs tab.
 * Shows "Continue Reading" with the last-read surah if the user has history,
 * otherwise falls back to Surah of the Day.
 */
export function ContinueReadingHero({
  onSurahLongPress,
}: ContinueReadingHeroProps) {
  const scopeRevision = useQfSyncStore(state => state.scopeRevision);
  const dataRevision = useQfSyncStore(state => state.dataRevision);
  // MMKV reads aren't reactive, so revision changes read the active scope
  // during render and focus changes force a fresh render after leaving Mushaf.
  const [, setFocusRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusRevision(revision => revision + 1);
    }, []),
  );
  const lastReadPage = readLastPageForRevision(scopeRevision, dataRevision);

  const surahOfTheDay = useMemo(() => getSurahOfTheDay(new Date()), []);

  const lastReadSurah = lastReadPage
    ? getSurahForPage(lastReadPage)
    : undefined;

  const displaySurah = lastReadSurah ?? surahOfTheDay;
  const title = lastReadSurah ? 'CONTINUE READING' : 'SURAH OF THE DAY';

  const cardStyle: ViewStyle = useMemo(
    () => ({width: '100%', height: SECTION_HEIGHT}),
    [],
  );

  return (
    <HeroSection
      mainHero={
        <View style={{paddingHorizontal: moderateScale(16)}}>
          <SurahHeroSection
            surah={displaySurah}
            onLongPress={onSurahLongPress}
            title={title}
            style={cardStyle}
            // Only wire the resume page when the user actually has
            // reading history; otherwise the hero falls back to
            // Surah of the Day and should open at page 1.
            resumePage={lastReadPage ?? undefined}
          />
        </View>
      }
      randomHero={false}
    />
  );
}
