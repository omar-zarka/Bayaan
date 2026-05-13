/**
 * MushafPlayerOptionsSheet - Comprehensive playback settings
 *
 * Single sheet, multiple routes:
 *   - `main` — Playback Settings (rows for verse range / reciter, chip groups
 *     for speed and repeats, Play CTA).
 *   - `pick-start-verse` / `pick-end-verse` — Two-step (surah → ayah) verse
 *     picker. Picking commits to the parent's draft state and routes back.
 *   - `pick-reciter` — Reciter list. Tapping commits and routes back.
 *
 * Each route owns its own single ScrollView so we never nest vertical
 * scrollables inside the sheet's gesture-bound scroll surface — pickers
 * slide in/out via the library's `routes` API instead of expanding inline.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {View, Text, Pressable, StyleSheet} from 'react-native';
import {ScaledSheet, moderateScale as ms} from 'react-native-size-matters';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import ActionSheet, {
  SheetProps,
  SheetManager,
  ScrollView,
  type Route,
  type RouteScreenProps,
  type Router,
} from 'react-native-actions-sheet';
import {
  useMushafPlayerStore,
  AvailableReciter,
} from '@/store/mushafPlayerStore';
import {SURAHS} from '@/data/surahData';
import {mushafVerseMapService} from '@/services/mushaf/MushafVerseMapService';
import Color from 'color';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const VERSE_REPEAT_OPTIONS = [
  {label: '1 time', value: 1},
  {label: '2 times', value: 2},
  {label: '3 times', value: 3},
  {label: 'Loop', value: 0},
];

const RANGE_REPEAT_OPTIONS = [
  {label: '1 time', value: 1},
  {label: '2 times', value: 2},
  {label: '3 times', value: 3},
  {label: 'Loop', value: 0},
];

// ---------------------------------------------------------------------------
// Verse-key helpers
// ---------------------------------------------------------------------------

function parseVerseKey(key: string): {surah: number; ayah: number} {
  const [s, a] = key.split(':').map(Number);
  return {surah: s, ayah: a};
}

function formatVerseKey(verseKey: string): string {
  const {surah, ayah} = parseVerseKey(verseKey);
  if (surah < 1 || surah > 114) return verseKey;
  return `${SURAHS[surah - 1].name} ${surah}:${ayah}`;
}

// Returns negative if a < b, zero if equal, positive if a > b. Used to keep
// the range from going backwards: a new start that's past the current end
// drags end forward, and a new end that's before the current start drags
// start back.
function compareVerseKeys(a: string, b: string): number {
  const ap = parseVerseKey(a);
  const bp = parseVerseKey(b);
  return ap.surah !== bp.surah ? ap.surah - bp.surah : ap.ayah - bp.ayah;
}

// ---------------------------------------------------------------------------
// Sheet-scoped state (shared across routes)
// ---------------------------------------------------------------------------

interface SheetState {
  startVerseKey: string;
  endVerseKey: string;
  selectedRewayatId: string | null;
  selectedReciterName: string | null;
  verseRepeat: number;
  rangeRepeat: number;
  setStartVerseKey: (key: string) => void;
  setEndVerseKey: (key: string) => void;
  setReciter: (rewayatId: string, name: string) => void;
  setVerseRepeat: (count: number) => void;
  setRangeRepeat: (count: number) => void;
  canPlay: boolean;
  handlePlayAudio: () => void;
}

const SheetStateContext = createContext<SheetState | null>(null);

function useSheetState(): SheetState {
  const ctx = useContext(SheetStateContext);
  if (!ctx) {
    throw new Error(
      'useSheetState must be used inside MushafPlayerOptionsSheet',
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Header (back chevron + title) shared by picker routes
// ---------------------------------------------------------------------------

const RouteHeader: React.FC<{title: string; onBack: () => void}> = ({
  title,
  onBack,
}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.routeHeader}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={styles.routeHeaderBackButton}>
        <Ionicons name="chevron-back" size={ms(20)} color={theme.colors.text} />
      </Pressable>
      <Text style={styles.routeHeaderTitle}>{title}</Text>
      <View style={styles.routeHeaderSpacer} />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Row button (used on main route for the verse / reciter nav rows)
// ---------------------------------------------------------------------------

const RowButton: React.FC<{
  label?: string;
  value: string;
  onPress: () => void;
}> = ({label, value, onPress}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  return (
    <Pressable
      style={({pressed}) => [
        styles.dropdownRow,
        pressed && styles.dropdownRowPressed,
      ]}
      onPress={onPress}>
      {label ? <Text style={styles.dropdownLabel}>{label}</Text> : null}
      <Text
        style={[styles.dropdownValue, !label && {textAlign: 'left'}]}
        numberOfLines={1}>
        {value}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={ms(16)}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );
};

// ---------------------------------------------------------------------------
// Main route — Playback Settings
// ---------------------------------------------------------------------------

const MainRoute: React.FC<RouteScreenProps> = ({router}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const state = useSheetState();
  // Reactive store binding — no local copy, so persisted rate is reflected
  // as soon as zustand/persist rehydrates from AsyncStorage.
  const rate = useMushafPlayerStore(s => s.rate);

  const handleRateChange = useCallback((newRate: number) => {
    useMushafPlayerStore.getState().setRate(newRate);
  }, []);

  return (
    <View style={styles.routeContainer}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}>
        <Text style={styles.title}>Playback Settings</Text>

        {/* Select Range */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Range</Text>
          <RowButton
            label="Starting Verse"
            value={formatVerseKey(state.startVerseKey)}
            onPress={() => router.navigate('pick-start-verse')}
          />
          <RowButton
            label="Ending Verse"
            value={formatVerseKey(state.endVerseKey)}
            onPress={() => router.navigate('pick-end-verse')}
          />
        </View>

        {/* Reciter */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Reciter</Text>
          <RowButton
            value={state.selectedReciterName ?? 'Select Reciter'}
            onPress={() => router.navigate('pick-reciter')}
          />
        </View>

        {/* Play speed */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Play speed</Text>
          <View style={styles.chipRowFlex}>
            {SPEEDS.map(speed => {
              const isActive = rate === speed;
              return (
                <Pressable
                  key={speed}
                  style={[styles.chipFlex, isActive && styles.chipActive]}
                  onPress={() => handleRateChange(speed)}>
                  <Text
                    style={[
                      styles.chipText,
                      isActive && styles.chipTextActive,
                    ]}>
                    {speed}x
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Verse repeat */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Play each verse</Text>
          <View style={styles.chipRowFlex}>
            {VERSE_REPEAT_OPTIONS.map(opt => {
              const isActive = state.verseRepeat === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.chipFlex, isActive && styles.chipActive]}
                  onPress={() => state.setVerseRepeat(opt.value)}>
                  <Text
                    style={[
                      styles.chipText,
                      isActive && styles.chipTextActive,
                    ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Range repeat */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Play the range</Text>
          <View style={styles.chipRowFlex}>
            {RANGE_REPEAT_OPTIONS.map(opt => {
              const isActive = state.rangeRepeat === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.chipFlex, isActive && styles.chipActive]}
                  onPress={() => state.setRangeRepeat(opt.value)}>
                  <Text
                    style={[
                      styles.chipText,
                      isActive && styles.chipTextActive,
                    ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Play CTA */}
      <View
        style={[styles.stickyFooter, {paddingBottom: insets.bottom + ms(4)}]}>
        <Pressable
          style={[
            styles.playButton,
            !state.canPlay && styles.playButtonDisabled,
          ]}
          onPress={state.handlePlayAudio}
          disabled={!state.canPlay}>
          <Ionicons
            name="play"
            size={ms(16)}
            color={
              state.canPlay
                ? theme.colors.text
                : Color(theme.colors.text).alpha(0.25).toString()
            }
          />
          <Text
            style={[
              styles.playButtonText,
              !state.canPlay && styles.playButtonTextDisabled,
            ]}>
            Play
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Verse picker (used by both pick-start-verse and pick-end-verse routes)
// ---------------------------------------------------------------------------

const VersePickerRoute: React.FC<{
  router: Router;
  endpoint: 'start' | 'end';
}> = ({router, endpoint}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const state = useSheetState();

  const currentKey =
    endpoint === 'start' ? state.startVerseKey : state.endVerseKey;
  const commit =
    endpoint === 'start' ? state.setStartVerseKey : state.setEndVerseKey;
  const title = endpoint === 'start' ? 'Starting Verse' : 'Ending Verse';

  // Two-step state: pick surah → pick ayah. Initialized from the current
  // selection so the picker opens to the matching surah's ayah grid by
  // default (matches the previous accordion behaviour).
  const initial = parseVerseKey(currentKey);
  const inRange = initial.surah >= 1 && initial.surah <= 114;
  const [step, setStep] = useState<'surahList' | 'ayahGrid'>(
    inRange ? 'ayahGrid' : 'surahList',
  );
  const [pickedSurah, setPickedSurah] = useState<number | null>(
    inRange ? initial.surah : null,
  );

  // Reset two-step state to track the current selection whenever this
  // route is re-entered (e.g. user goes back to main, opens it again).
  // Without this, the picker would still be on whatever step it was last
  // left in for the wrong endpoint.
  useEffect(() => {
    const parsed = parseVerseKey(currentKey);
    const valid = parsed.surah >= 1 && parsed.surah <= 114;
    setPickedSurah(valid ? parsed.surah : null);
    setStep(valid ? 'ayahGrid' : 'surahList');
  }, [currentKey]);

  const handleSurahPick = useCallback((surahId: number) => {
    setPickedSurah(surahId);
    setStep('ayahGrid');
  }, []);

  const handleAyahPick = useCallback(
    (ayah: number) => {
      if (!pickedSurah) return;
      commit(`${pickedSurah}:${ayah}`);
      router.goBack();
    },
    [pickedSurah, commit, router],
  );

  const handleBack = useCallback(() => {
    if (step === 'ayahGrid') {
      setStep('surahList');
      return;
    }
    router.goBack();
  }, [step, router]);

  return (
    <View style={styles.routeContainer}>
      <RouteHeader
        title={
          step === 'ayahGrid' && pickedSurah
            ? SURAHS[pickedSurah - 1].name
            : title
        }
        onBack={handleBack}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}>
        {step === 'surahList' ? (
          <View>
            {SURAHS.map(item => (
              <Pressable
                key={item.id}
                style={({pressed}) => [
                  styles.pickerRow,
                  pressed && styles.pickerRowPressed,
                ]}
                onPress={() => handleSurahPick(item.id)}>
                <Text style={styles.pickerRowNumber}>{item.id}</Text>
                <Text style={styles.pickerRowText}>{item.name}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={ms(14)}
                  color={theme.colors.textSecondary}
                />
              </Pressable>
            ))}
          </View>
        ) : pickedSurah ? (
          <View style={styles.ayahGrid}>
            {Array.from(
              {length: SURAHS[pickedSurah - 1]?.verses_count ?? 1},
              (_, i) => i + 1,
            ).map(a => (
              <Pressable
                key={a}
                style={({pressed}) => [
                  styles.ayahChip,
                  pressed && styles.ayahChipPressed,
                ]}
                onPress={() => handleAyahPick(a)}>
                <Text style={styles.ayahChipText}>{a}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const PickStartVerseRoute: React.FC<RouteScreenProps> = ({router}) => (
  <VersePickerRoute router={router} endpoint="start" />
);

const PickEndVerseRoute: React.FC<RouteScreenProps> = ({router}) => (
  <VersePickerRoute router={router} endpoint="end" />
);

// ---------------------------------------------------------------------------
// Reciter picker route
// ---------------------------------------------------------------------------

const PickReciterRoute: React.FC<RouteScreenProps> = ({router}) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const state = useSheetState();
  const availableReciters = useMushafPlayerStore(s => s.availableReciters);

  const handleSelect = useCallback(
    (reciter: AvailableReciter) => {
      state.setReciter(reciter.rewayatId, reciter.reciterName);
      router.goBack();
    },
    [state, router],
  );

  return (
    <View style={styles.routeContainer}>
      <RouteHeader title="Reciter" onBack={() => router.goBack()} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}>
        <View>
          {availableReciters.map(item => {
            const isSelected = item.rewayatId === state.selectedRewayatId;
            return (
              <Pressable
                key={item.rewayatId}
                style={({pressed}) => [
                  styles.reciterRow,
                  isSelected && styles.reciterRowSelected,
                  pressed && styles.pickerRowPressed,
                ]}
                onPress={() => handleSelect(item)}>
                <View style={styles.reciterInfo}>
                  <Text style={styles.reciterName} numberOfLines={1}>
                    {item.reciterName}
                  </Text>
                  <Text style={styles.reciterStyle} numberOfLines={1}>
                    {item.style}
                  </Text>
                </View>
                {isSelected && (
                  <Feather
                    name="check"
                    size={ms(16)}
                    color={theme.colors.text}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Route table (declared at module scope so identities are stable across renders)
// ---------------------------------------------------------------------------

const ROUTES: Route[] = [
  {name: 'main', component: MainRoute},
  {name: 'pick-start-verse', component: PickStartVerseRoute},
  {name: 'pick-end-verse', component: PickEndVerseRoute},
  {name: 'pick-reciter', component: PickReciterRoute},
];

// ---------------------------------------------------------------------------
// Sheet entry point
// ---------------------------------------------------------------------------

export const MushafPlayerOptionsSheet = (
  props: SheetProps<'mushaf-player-options'>,
) => {
  const {theme} = useTheme();
  const styles = createStyles(theme);
  const currentPage = props.payload?.currentPage ?? 1;

  // Persisted store fields read once for initialising local drafts. The
  // persisted `rate` is read reactively inside the main route so it
  // reflects post-rehydration values automatically.
  const storeRewayatId = useMushafPlayerStore(s => s.rewayatId);
  const storeReciterName = useMushafPlayerStore(s => s.reciterName);
  const storeVerseRepeat = useMushafPlayerStore(s => s.verseRepeatCount);
  const storeRangeRepeat = useMushafPlayerStore(s => s.rangeRepeatCount);
  const storeRangeStart = useMushafPlayerStore(s => s.rangeStart);
  const storeRangeEnd = useMushafPlayerStore(s => s.rangeEnd);
  const availableReciters = useMushafPlayerStore(s => s.availableReciters);

  const pageVerseKeys = useMemo(
    () => mushafVerseMapService.getOrderedVerseKeysForPage(currentPage),
    [currentPage],
  );
  const defaultStart = storeRangeStart
    ? `${storeRangeStart.surah}:${storeRangeStart.ayah}`
    : (pageVerseKeys[0] ?? '1:1');
  const defaultEnd = storeRangeEnd
    ? `${storeRangeEnd.surah}:${storeRangeEnd.ayah}`
    : (pageVerseKeys[pageVerseKeys.length - 1] ?? '1:7');

  const [startVerseKey, setStartVerseKeyRaw] = useState(defaultStart);
  const [endVerseKey, setEndVerseKeyRaw] = useState(defaultEnd);
  const [selectedRewayatId, setSelectedRewayatId] = useState<string | null>(
    storeRewayatId,
  );
  const [selectedReciterName, setSelectedReciterName] = useState<string | null>(
    storeReciterName,
  );
  const [verseRepeat, setVerseRepeat] = useState(storeVerseRepeat);
  const [rangeRepeat, setRangeRepeat] = useState(storeRangeRepeat);

  // Range-ordering enforcement: a new start past the current end drags end
  // forward; a new end before the current start drags start back. Prevents
  // backwards ranges that the playback logic in mushafPlayerStore.startPlayback
  // doesn't handle.
  const setStartVerseKey = useCallback(
    (key: string) => {
      setStartVerseKeyRaw(key);
      if (compareVerseKeys(key, endVerseKey) > 0) {
        setEndVerseKeyRaw(key);
      }
    },
    [endVerseKey],
  );

  const setEndVerseKey = useCallback(
    (key: string) => {
      setEndVerseKeyRaw(key);
      if (compareVerseKeys(key, startVerseKey) < 0) {
        setStartVerseKeyRaw(key);
      }
    },
    [startVerseKey],
  );

  const setReciter = useCallback((rewayatId: string, name: string) => {
    setSelectedRewayatId(rewayatId);
    setSelectedReciterName(name);
  }, []);

  // Pre-populate from a pending start verse if one was queued before opening.
  useEffect(() => {
    const pending = useMushafPlayerStore.getState().pendingStartVerseKey;
    if (pending) {
      setStartVerseKeyRaw(pending);
    }
  }, []);

  // Compute reciters on mount if not already done.
  useEffect(() => {
    if (availableReciters.length === 0) {
      useMushafPlayerStore.getState().computeAvailableReciters();
    }
  }, [availableReciters.length]);

  const canPlay = !!selectedRewayatId;

  const handlePlayAudio = useCallback(() => {
    if (!selectedRewayatId || !selectedReciterName) return;

    const store = useMushafPlayerStore.getState();
    store.stop();
    store.setReciter(selectedRewayatId, selectedReciterName);

    const start = parseVerseKey(startVerseKey);
    const end = parseVerseKey(endVerseKey);
    store.setRange(
      {surah: start.surah, ayah: start.ayah},
      {surah: end.surah, ayah: end.ayah},
    );

    // rate is bound directly to the store via the speed chips, so it's
    // already current; only the repeat counts need explicit commits.
    store.setVerseRepeatCount(verseRepeat);
    store.setRangeRepeatCount(rangeRepeat);

    store.startPlayback(currentPage, startVerseKey);
    SheetManager.hide('mushaf-player-options');
  }, [
    selectedRewayatId,
    selectedReciterName,
    startVerseKey,
    endVerseKey,
    verseRepeat,
    rangeRepeat,
    currentPage,
  ]);

  const value = useMemo<SheetState>(
    () => ({
      startVerseKey,
      endVerseKey,
      selectedRewayatId,
      selectedReciterName,
      verseRepeat,
      rangeRepeat,
      setStartVerseKey,
      setEndVerseKey,
      setReciter,
      setVerseRepeat,
      setRangeRepeat,
      canPlay,
      handlePlayAudio,
    }),
    [
      startVerseKey,
      endVerseKey,
      selectedRewayatId,
      selectedReciterName,
      verseRepeat,
      rangeRepeat,
      setStartVerseKey,
      setEndVerseKey,
      setReciter,
      canPlay,
      handlePlayAudio,
    ],
  );

  return (
    <SheetStateContext.Provider value={value}>
      <ActionSheet
        id={props.sheetId}
        containerStyle={styles.sheetContainer}
        indicatorStyle={styles.indicator}
        gestureEnabled
        enableRouterBackNavigation
        routes={ROUTES}
        initialRoute="main"
      />
    </SheetStateContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    sheetContainer: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: ms(20),
      borderTopRightRadius: ms(20),
      paddingTop: ms(8),
      maxHeight: '85%',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    indicator: {
      backgroundColor: Color(theme.colors.text).alpha(0.3).toString(),
      width: ms(40),
      height: 2.5,
    },

    routeContainer: {
      flex: 1,
      minHeight: ms(420),
    },
    scrollView: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingHorizontal: ms(20),
      paddingTop: ms(12),
    },

    // Picker header
    routeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: ms(8),
      paddingVertical: ms(8),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    routeHeaderBackButton: {
      padding: ms(6),
    },
    routeHeaderTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: ms(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    routeHeaderSpacer: {
      width: ms(32),
    },

    // Title (main route)
    title: {
      fontSize: ms(20),
      fontFamily: 'Manrope-Bold',
      color: theme.colors.text,
      marginBottom: ms(20),
    },

    // Sections
    section: {
      marginBottom: ms(20),
    },
    sectionLabel: {
      fontSize: ms(13),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.textSecondary,
      marginBottom: ms(10),
    },

    // Row buttons (main route)
    dropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: ms(14),
      paddingHorizontal: ms(16),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      borderRadius: ms(12),
      marginBottom: ms(8),
    },
    dropdownRowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    dropdownLabel: {
      fontSize: ms(14),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      marginRight: ms(8),
    },
    dropdownValue: {
      flex: 1,
      fontSize: ms(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
      textAlign: 'right',
      marginRight: ms(8),
    },

    // Picker rows
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: ms(12),
      paddingHorizontal: ms(4),
    },
    pickerRowPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
    },
    pickerRowNumber: {
      width: ms(32),
      fontSize: ms(13),
      fontFamily: 'Manrope-Medium',
      color: theme.colors.textSecondary,
    },
    pickerRowText: {
      flex: 1,
      fontSize: ms(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },

    // Ayah grid
    ayahGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingTop: ms(4),
      paddingBottom: ms(12),
      gap: ms(8),
    },
    ayahChip: {
      width: ms(44),
      height: ms(44),
      borderRadius: ms(10),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      justifyContent: 'center',
      alignItems: 'center',
    },
    ayahChipPressed: {
      backgroundColor: Color(theme.colors.text).alpha(0.12).toString(),
    },
    ayahChipText: {
      fontSize: ms(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },

    // Reciter rows
    reciterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: ms(12),
      paddingHorizontal: ms(12),
      borderRadius: ms(8),
    },
    reciterRowSelected: {
      backgroundColor: Color(theme.colors.text).alpha(0.08).toString(),
    },
    reciterInfo: {
      flex: 1,
      gap: ms(2),
    },
    reciterName: {
      fontSize: ms(14),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    reciterStyle: {
      fontSize: ms(12),
      fontFamily: 'Manrope-Regular',
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },

    // Chips
    chipRowFlex: {
      flexDirection: 'row',
      gap: ms(8),
    },
    chipFlex: {
      flex: 1,
      paddingVertical: ms(8),
      borderRadius: ms(20),
      backgroundColor: Color(theme.colors.text).alpha(0.06).toString(),
      alignItems: 'center',
    },
    chipActive: {
      backgroundColor: Color(theme.colors.text).alpha(0.15).toString(),
    },
    chipText: {
      fontSize: ms(13),
      fontFamily: 'Manrope-SemiBold',
      color: Color(theme.colors.text).alpha(0.5).toString(),
    },
    chipTextActive: {
      color: theme.colors.text,
    },

    // Sticky footer
    stickyFooter: {
      paddingHorizontal: ms(20),
      paddingTop: ms(12),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Color(theme.colors.text).alpha(0.1).toString(),
    },
    playButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      height: ms(42),
      paddingHorizontal: ms(40),
      borderRadius: ms(14),
      backgroundColor: Color(theme.colors.text).alpha(0.1).toString(),
      gap: ms(8),
    },
    playButtonDisabled: {
      backgroundColor: Color(theme.colors.text).alpha(0.05).toString(),
    },
    playButtonText: {
      fontSize: ms(15),
      fontFamily: 'Manrope-SemiBold',
      color: theme.colors.text,
    },
    playButtonTextDisabled: {
      color: Color(theme.colors.text).alpha(0.25).toString(),
    },
  });
