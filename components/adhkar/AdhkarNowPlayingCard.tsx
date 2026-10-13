// The adhkar session's entry point outside the adhkar screens: a tile at the
// head of Home's Continue Listening and a row on the Adhkar screen.
import React, {useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import Color from 'color';
import {useTranslation} from 'react-i18next';
import {moderateScale} from 'react-native-size-matters';
import {useTheme} from '@/hooks/useTheme';
import {PauseIcon, PlayIcon} from '@/components/Icons';
import {PlayingBars} from '@/components/adhkar/PlayingBars';
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {openPlayingDhikr} from '@/services/adhkar/playback/openPlayingDhikr';
import {dropStaleSession} from '@/services/adhkar/playback/sessionPersistence';

// Same width as RecentReciterCard. Its height is content-driven (square image
// of the inner width, name, playback zone). VirtualizedList wraps the list
// header in a View that is stretched to the row height; the wrapper View in
// RecitersView has flex: 1 and the tile has flex: 1, so the tile fills that
// height. The minHeight fallback only applies when the tile is the sole item:
// it is the card's image block (inner width 106 plus 6 padding and 1 border on
// each side = 120), a lower bound that leaves the text and playback zone out.
export const ADHKAR_TILE_WIDTH = moderateScale(120);
// Equals `sectionContent.gap` in RecitersView, which the list applies around
// the header too, so the header needs no margin of its own.
export const ADHKAR_TILE_GAP = moderateScale(8);

export function useHasAdhkarSession(): boolean {
  return useAdhkarSessionStore(s => s.session !== null);
}

export function AdhkarNowPlayingCard({
  variant,
}: {
  variant: 'tile' | 'row';
}): React.JSX.Element | null {
  const {theme} = useTheme();
  const {t} = useTranslation('home');
  const router = useRouter();
  const session = useAdhkarSessionStore(s => s.session);
  const dispatch = useAdhkarSessionStore(s => s.dispatch);

  useEffect(() => {
    dropStaleSession(Date.now());
  }, []);

  if (!session) return null;

  const isTile = variant === 'tile';
  const playing = session.status === 'playing';
  const active = playing || session.status === 'loading';
  const muted = Color(theme.colors.text).alpha(0.6).toString();
  const position = t('adhkar.position', {
    current: session.index + 1,
    total: session.items.length,
  });

  const controls = (
    <View style={styles.controls}>
      <Pressable
        testID="adhkar-now-playing-toggle"
        accessibilityRole="button"
        accessibilityLabel={playing ? t('adhkar.pause') : t('adhkar.play')}
        hitSlop={8}
        onPress={() => dispatch({type: 'toggle'})}
        style={[
          styles.toggle,
          {backgroundColor: Color(theme.colors.text).alpha(0.1).toString()},
        ]}>
        {playing ? (
          <PauseIcon color={theme.colors.text} size={moderateScale(16)} />
        ) : (
          <PlayIcon color={theme.colors.text} size={moderateScale(16)} />
        )}
      </Pressable>
      <Pressable
        testID="adhkar-now-playing-close"
        accessibilityRole="button"
        accessibilityLabel={t('adhkar.stopSession')}
        hitSlop={8}
        onPress={() => dispatch({type: 'stop'})}
        style={styles.close}>
        <Feather name="x" size={moderateScale(16)} color={muted} />
      </Pressable>
    </View>
  );

  const bars = (
    <PlayingBars
      animating={active}
      color={theme.colors.text}
      size={moderateScale(isTile ? 14 : 18)}
    />
  );
  const title = (
    <Text
      numberOfLines={1}
      style={[
        styles.title,
        {color: theme.colors.text, fontFamily: theme.fonts.semiBold},
      ]}>
      {session.listTitle}
    </Text>
  );
  const positionText = (
    <Text
      style={[styles.position, {color: muted, fontFamily: theme.fonts.medium}]}>
      {position}
    </Text>
  );

  if (isTile) {
    return (
      <View
        style={[
          styles.tile,
          {
            backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
          },
        ]}>
        <Pressable
          testID="adhkar-now-playing-open"
          accessibilityRole="button"
          accessibilityLabel={t('adhkar.openPlaying')}
          onPress={() => openPlayingDhikr(router)}
          style={styles.tileBody}>
          <View style={styles.tileTop}>
            {bars}
            {title}
          </View>
          {positionText}
        </Pressable>
        {controls}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.row,
        {backgroundColor: Color(theme.colors.text).alpha(0.06).toString()},
      ]}>
      <Pressable
        testID="adhkar-now-playing-open"
        accessibilityRole="button"
        accessibilityLabel={t('adhkar.openPlaying')}
        onPress={() => openPlayingDhikr(router)}
        style={styles.rowBody}>
        {bars}
        <View style={styles.rowText}>
          {title}
          {positionText}
        </View>
      </Pressable>
      {controls}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: ADHKAR_TILE_WIDTH,
    flex: 1,
    minHeight: ADHKAR_TILE_WIDTH,
    borderRadius: moderateScale(14),
    padding: moderateScale(6),
    justifyContent: 'space-between',
  },
  tileBody: {gap: moderateScale(4)},
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
  },
  row: {
    height: moderateScale(56),
    borderRadius: moderateScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    gap: moderateScale(8),
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
  },
  rowText: {flex: 1},
  title: {flexShrink: 1, fontSize: moderateScale(14)},
  position: {fontSize: moderateScale(12)},
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
  },
  toggle: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: moderateScale(24),
    height: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
