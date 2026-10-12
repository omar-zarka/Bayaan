import React from 'react';
import {ViewStyle} from 'react-native';
import {Surah} from '@/data/surahData';
import {SurahHeroSection} from '@/components/hero/SurahsHero';
import {useTranslation} from 'react-i18next';

interface SurahOfTheDayProps {
  surah: Surah;
  onLongPress?: (surah: Surah) => void;
  style?: ViewStyle | ViewStyle[];
}

/**
 * A component that displays the Surah of the Day card
 * with zoom transition to mushaf.
 */
export function SurahOfTheDay({surah, onLongPress, style}: SurahOfTheDayProps) {
  const {t} = useTranslation('home');
  return (
    <SurahHeroSection
      surah={surah}
      onLongPress={onLongPress}
      title={t('hero.surahOfTheDay')}
      isCompact={true}
      style={style}
    />
  );
}
