// @ai-generated
import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Keyboard,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks/useTheme';
import {moderateScale} from '@/utils/scale';
import {flipX, latinLetterSpacing} from '@/utils/rtl';
import {SurahItem} from '@/components/SurahItem';
import {ReciterImage} from '@/components/ReciterImage';
import type {Surah} from '@/data/surahData';
import type {Reciter} from '@/data/reciterData';
import type {CatalogSearchResult} from '@/utils/search/catalog';
import {
  getReciterDisplayName,
  getSurahDisplayName,
  getSurahMeaning,
  localizeDigits,
} from '@/i18n/format';
import type {Theme} from '@/utils/themeUtils';

export type SearchScope = 'all' | 'reciters' | 'surahs';

/** Surahs listed beside the top result in the All scope. */
const ALL_SURAH_COUNT = 4;
/** Reciters in the All scope's shelf before "See all". */
const ALL_RECITER_COUNT = 10;
const TOP_CARD_WIDTH = moderateScale(260);
const RECITER_TILE_WIDTH = moderateScale(112);

type SurahResult = CatalogSearchResult & {type: 'surah'};
type ReciterResult = CatalogSearchResult & {type: 'reciter'};

export interface GroupedResults {
  top: CatalogSearchResult | undefined;
  surahs: SurahResult[];
  reciters: ReciterResult[];
}

/**
 * Splits ranked catalog results for the iPad layout. `top` is the best hit
 * of either kind; the lists keep their rank order and include it too, so the
 * Reciters and Surahs scopes show every match.
 */
export function groupResults(
  results: readonly CatalogSearchResult[],
): GroupedResults {
  return {
    top: results[0],
    surahs: results.filter((r): r is SurahResult => r.type === 'surah'),
    reciters: results.filter((r): r is ReciterResult => r.type === 'reciter'),
  };
}

interface TabletSearchResultsProps {
  results: readonly CatalogSearchResult[];
  /** Opens a result: the reciter's profile, or the surah in the Mushaf. */
  onResultPress: (result: CatalogSearchResult) => void;
  /** Plays a surah the way a long press does (default or chosen reciter). */
  onSurahPlay: (result: CatalogSearchResult) => void;
  bottomPadding: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Search results on iPad (mockup L7): All / Reciters / Surahs scopes, and in
 * All a top result card beside the first surah matches, then a reciters
 * shelf. Surah rows carry a visible play button so audio is never
 * long-press only.
 */
export function TabletSearchResults({
  results,
  onResultPress,
  onSurahPlay,
  bottomPadding,
  style,
}: TabletSearchResultsProps) {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [scope, setScope] = useState<SearchScope>('all');
  const grouped = useMemo(() => groupResults(results), [results]);

  const scopes: {key: SearchScope; label: string; count?: number}[] = [
    {key: 'all', label: t('search.all')},
    {
      key: 'reciters',
      label: t('common:terms.reciters'),
      count: grouped.reciters.length,
    },
    {
      key: 'surahs',
      label: t('common:terms.surahs'),
      count: grouped.surahs.length,
    },
  ];

  const surahRow = (result: SurahResult) => (
    <SurahResultRow
      key={`surah-${result.item.id}`}
      result={result}
      onPress={onResultPress}
      onPlay={onSurahPlay}
      styles={styles}
      theme={theme}
    />
  );

  const reciterTile = (result: ReciterResult) => (
    <ReciterTile
      key={`reciter-${result.item.id}`}
      result={result}
      onPress={onResultPress}
      styles={styles}
    />
  );

  const sectionHeader = (title: string, more?: SearchScope) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {more && (
        <Pressable
          onPress={() => setScope(more)}
          hitSlop={8}
          accessibilityRole="button">
          <Text style={styles.seeAll}>{t('common:actions.seeAll')}</Text>
        </Pressable>
      )}
    </View>
  );

  const topSurahs = grouped.surahs
    .filter(r => r !== grouped.top)
    .slice(0, ALL_SURAH_COUNT);
  const shelfReciters = grouped.reciters
    .filter(r => r !== grouped.top)
    .slice(0, ALL_RECITER_COUNT);

  return (
    <ScrollView
      style={[styles.fill, style]}
      contentContainerStyle={[styles.content, {paddingBottom: bottomPadding}]}
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={() => Keyboard.dismiss()}
      showsVerticalScrollIndicator={false}>
      <View style={styles.scopes} accessibilityRole="tablist">
        {scopes.map(s => {
          const selected = s.key === scope;
          return (
            <Pressable
              key={s.key}
              onPress={() => setScope(s.key)}
              accessibilityRole="tab"
              accessibilityState={{selected}}
              style={[styles.chip, selected && styles.chipSelected]}>
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}>
                {s.label}
              </Text>
              {s.count !== undefined && (
                <Text
                  style={[
                    styles.chipText,
                    styles.chipCount,
                    selected && styles.chipTextSelected,
                  ]}>
                  {localizeDigits(s.count)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {scope === 'all' && grouped.top && (
        <>
          <View style={styles.topRow}>
            <View style={styles.topColumn}>
              {sectionHeader(t('search.topResult'))}
              <TopResultCard
                result={grouped.top}
                onPress={onResultPress}
                onPlay={onSurahPlay}
                styles={styles}
                theme={theme}
              />
            </View>
            {topSurahs.length > 0 && (
              <View style={styles.surahColumn}>
                {sectionHeader(
                  t('common:terms.surahs'),
                  grouped.surahs.length > topSurahs.length
                    ? 'surahs'
                    : undefined,
                )}
                {topSurahs.map(surahRow)}
              </View>
            )}
          </View>
          {shelfReciters.length > 0 && (
            <View style={styles.section}>
              {sectionHeader(
                t('common:terms.reciters'),
                grouped.reciters.length > shelfReciters.length
                  ? 'reciters'
                  : undefined,
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.shelf}>
                {shelfReciters.map(reciterTile)}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {scope === 'surahs' && (
        <View style={styles.section}>{grouped.surahs.map(surahRow)}</View>
      )}

      {scope === 'reciters' && (
        <View style={[styles.section, styles.reciterGrid]}>
          {grouped.reciters.map(reciterTile)}
        </View>
      )}
    </ScrollView>
  );
}

type Styles = ReturnType<typeof createStyles>;

function PlayButton({
  onPress,
  hint,
  size,
  styles,
  theme,
}: {
  onPress: () => void;
  hint: string;
  size: number;
  styles: Styles;
  theme: Theme;
}) {
  const {t} = useTranslation('common');
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t('actions.play')}
      accessibilityHint={hint}
      style={[
        styles.playButton,
        {width: size, height: size, borderRadius: size / 2},
      ]}>
      <Feather
        name="play"
        size={size * 0.42}
        color={theme.colors.background}
        style={styles.playIcon}
      />
    </Pressable>
  );
}

function SurahResultRow({
  result,
  onPress,
  onPlay,
  styles,
  theme,
}: {
  result: SurahResult;
  onPress: (result: CatalogSearchResult) => void;
  onPlay: (result: CatalogSearchResult) => void;
  styles: Styles;
  theme: Theme;
}) {
  return (
    <View style={styles.surahRow}>
      <View style={styles.fill}>
        <SurahItem
          pressAction="read"
          item={result.item as Surah}
          onPress={() => onPress(result)}
          onLongPress={() => onPlay(result)}
        />
      </View>
      <PlayButton
        onPress={() => onPlay(result)}
        hint={getSurahDisplayName(result.item as Surah)}
        size={moderateScale(34)}
        styles={styles}
        theme={theme}
      />
    </View>
  );
}

function ReciterTile({
  result,
  onPress,
  styles,
}: {
  result: ReciterResult;
  onPress: (result: CatalogSearchResult) => void;
  styles: Styles;
}) {
  const reciter = result.item as Reciter;
  return (
    <Pressable
      onPress={() => onPress(result)}
      accessibilityRole="button"
      style={styles.reciterTile}>
      <ReciterImage
        imageUrl={reciter.image_url || undefined}
        reciterName={reciter.name}
        style={styles.reciterTileImage}
        profileIconSize={moderateScale(32)}
      />
      <Text style={styles.reciterTileName} numberOfLines={2}>
        {getReciterDisplayName(reciter)}
      </Text>
    </Pressable>
  );
}

function TopResultCard({
  result,
  onPress,
  onPlay,
  styles,
  theme,
}: {
  result: CatalogSearchResult;
  onPress: (result: CatalogSearchResult) => void;
  onPlay: (result: CatalogSearchResult) => void;
  styles: Styles;
  theme: Theme;
}) {
  const {t} = useTranslation(['home', 'common']);
  if (result.type === 'reciter') {
    const reciter = result.item as Reciter;
    return (
      <Pressable
        onPress={() => onPress(result)}
        accessibilityRole="button"
        style={styles.topCard}>
        <ReciterImage
          imageUrl={reciter.image_url || undefined}
          reciterName={reciter.name}
          style={styles.topImage}
          profileIconSize={moderateScale(40)}
        />
        <Text style={styles.topTitle} numberOfLines={2}>
          {getReciterDisplayName(reciter)}
        </Text>
        <View style={styles.topFooter}>
          <Text style={styles.kindChip}>{t('common:terms.reciter')}</Text>
          <Feather
            name="chevron-right"
            size={moderateScale(22)}
            color={theme.colors.textSecondary}
            style={flipX}
          />
        </View>
      </Pressable>
    );
  }
  const surah = result.item as Surah;
  const meaning = getSurahMeaning(surah);
  return (
    <Pressable
      onPress={() => onPress(result)}
      accessibilityRole="button"
      style={styles.topCard}>
      <Text style={styles.topNumber}>{localizeDigits(surah.id)}</Text>
      <Text style={styles.topTitle} numberOfLines={2}>
        {getSurahDisplayName(surah)}
      </Text>
      <Text style={styles.topMeta} numberOfLines={1}>
        {meaning
          ? `${meaning} · ${t('surahItem.verses', {count: surah.verses_count})}`
          : t('surahItem.verses', {count: surah.verses_count})}
      </Text>
      <View style={styles.topFooter}>
        <Text style={styles.kindChip}>{t('common:terms.surah')}</Text>
        <PlayButton
          onPress={() => onPlay(result)}
          hint={getSurahDisplayName(surah)}
          size={moderateScale(48)}
          styles={styles}
          theme={theme}
        />
      </View>
    </Pressable>
  );
}

const createStyles = (theme: Theme) => {
  const faint = Color(theme.colors.text).alpha(0.06).toString();
  return StyleSheet.create({
    fill: {
      flex: 1,
    },
    content: {
      paddingTop: moderateScale(8),
    },
    scopes: {
      flexDirection: 'row',
      gap: moderateScale(8),
      paddingHorizontal: moderateScale(16),
      paddingBottom: moderateScale(8),
    },
    chip: {
      height: moderateScale(34),
      paddingHorizontal: moderateScale(14),
      borderRadius: moderateScale(17),
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(6),
      backgroundColor: faint,
    },
    chipSelected: {
      backgroundColor: theme.colors.text,
    },
    chipText: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
    },
    chipTextSelected: {
      color: theme.colors.background,
    },
    chipCount: {
      fontFamily: theme.fonts.medium,
      opacity: 0.6,
    },
    section: {
      marginTop: moderateScale(16),
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: moderateScale(16),
      marginBottom: moderateScale(8),
    },
    sectionTitle: {
      fontSize: moderateScale(18),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
      letterSpacing: latinLetterSpacing(-0.2),
    },
    seeAll: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
    },
    topRow: {
      flexDirection: 'row',
      marginTop: moderateScale(12),
      gap: moderateScale(8),
    },
    topColumn: {
      width: TOP_CARD_WIDTH + moderateScale(32),
    },
    surahColumn: {
      flex: 1,
      minWidth: 0,
    },
    topCard: {
      marginHorizontal: moderateScale(16),
      padding: moderateScale(20),
      borderRadius: moderateScale(18),
      backgroundColor: faint,
      gap: moderateScale(6),
    },
    topImage: {
      width: moderateScale(96),
      height: moderateScale(96),
      borderRadius: moderateScale(48),
      marginBottom: moderateScale(8),
    },
    topNumber: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.textSecondary,
    },
    topTitle: {
      fontSize: moderateScale(26),
      lineHeight: moderateScale(32),
      fontFamily: theme.fonts.bold,
      color: theme.colors.text,
    },
    topMeta: {
      fontSize: moderateScale(14),
      fontFamily: theme.fonts.medium,
      color: theme.colors.textSecondary,
    },
    topFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: moderateScale(10),
    },
    kindChip: {
      fontSize: moderateScale(12),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      backgroundColor: faint,
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(4),
      borderRadius: moderateScale(12),
      overflow: 'hidden',
    },
    surahRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingEnd: moderateScale(16),
    },
    playButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.text,
    },
    playIcon: {
      // The triangle always points right, and its visual center sits left
      // of its box.
      marginLeft: moderateScale(2),
    },
    shelf: {
      paddingHorizontal: moderateScale(16),
      gap: moderateScale(16),
    },
    reciterGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: moderateScale(16),
      gap: moderateScale(16),
    },
    reciterTile: {
      width: RECITER_TILE_WIDTH,
      alignItems: 'center',
      gap: moderateScale(8),
    },
    reciterTileImage: {
      width: RECITER_TILE_WIDTH,
      height: RECITER_TILE_WIDTH,
      borderRadius: RECITER_TILE_WIDTH / 2,
    },
    reciterTileName: {
      fontSize: moderateScale(13),
      fontFamily: theme.fonts.semiBold,
      color: theme.colors.text,
      textAlign: 'center',
    },
  });
};
