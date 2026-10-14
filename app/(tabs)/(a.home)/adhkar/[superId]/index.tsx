import React, {
  useMemo,
  useCallback,
  useEffect,
  useState,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  View,
  SectionList,
  FlatList,
  Text,
  ViewToken,
  Pressable,
  StyleSheet,
} from 'react-native';
import {
  useLocalSearchParams,
  useRouter,
  useNavigation,
  useFocusEffect,
  Link,
} from 'expo-router';
import {Ionicons, Feather} from '@expo/vector-icons';
import {ScaledSheet, moderateScale} from 'react-native-size-matters';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {useAdhkar} from '@/hooks/useAdhkar';
import {useTheme} from '@/hooks/useTheme';
import {Theme} from '@/utils/themeUtils';
import {DhikrListItem} from '@/components/adhkar/DhikrListItem';
import {CategorySectionHeader} from '@/components/adhkar/CategorySectionHeader';
import {LoadingIndicator} from '@/components/LoadingIndicator';
import {PlayAllButton} from '@/components/adhkar/PlayAllButton';
import {
  AdhkarJumpPill,
  jumpPillDirection,
  visibleRowIndices,
} from '@/components/adhkar/AdhkarJumpPill';
import {Dhikr, SuperCategory} from '@/types/adhkar';
import {adhkarService} from '@/services/adhkar/AdhkarService';
// @ai-start
import {
  getSuperCategoryDisplayTitle,
  shortenCategoryTitle,
} from '@/utils/adhkarUtils';
// @ai-end
import {useAdhkarSessionStore} from '@/store/adhkarSessionStore';
import {toSessionItems} from '@/services/adhkar/playback/sessionReducer';
import {
  setAdhkarFocus,
  clearAdhkarFocus,
  type AdhkarFocus,
} from '@/services/adhkar/playback/openPlayingDhikr';
import {useHeaderHeight} from 'expo-router/react-navigation';
import {adhkarShareUrl, shareUrl} from '@/utils/shareUtils';
import {analyticsService} from '@/services/analytics/AnalyticsService';
import branding from '@/config/branding';
// @ai-start
import {useTranslation} from 'react-i18next';
import {flipX} from '@/utils/rtl';
// @ai-end

interface DhikrItem {
  dhikr: Dhikr;
  index: number;
  globalIndex: number;
  categoryShortTitle: string;
}

interface Section {
  title: string;
  shortTitle: string;
  categoryId: string;
  data: DhikrItem[];
}

interface CategoryGroup {
  categoryId: string;
  categoryTitle: string;
  adhkar: Dhikr[];
}

// @ai-start
const SuperCategoryListScreen: React.FC = () => {
  const {superId} = useLocalSearchParams<{superId: string}>();
  const router = useRouter();
  const navigation = useNavigation();
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerHeight = useHeaderHeight();

  const {getSuperCategoryById} = useAdhkar();

  // Check if currently playing this category
  const isThisCategoryPlaying = useAdhkarSessionStore(
    s => s.session?.listId === superId && s.session.mode === 'all',
  );

  const currentDhikrId = useAdhkarSessionStore(s =>
    s.session?.listId === superId
      ? (s.session.items[s.session.index]?.dhikrId ?? null)
      : null,
  );
  const sessionPlaying = useAdhkarSessionStore(
    s =>
      s.session?.listId === superId &&
      (s.session.status === 'playing' || s.session.status === 'loading'),
  );

  const revealToken = useAdhkarSessionStore(s => s.revealToken);
  const [visibleIndices, setVisibleIndices] = useState<number[]>([]);
  const sectionListRef = useRef<SectionList<DhikrItem, Section>>(null);
  const flatListRef = useRef<FlatList<DhikrItem>>(null);

  const [superCategory, setSuperCategory] = useState<SuperCategory | null>(
    null,
  );
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSectionTitle, setCurrentSectionTitle] = useState<string | null>(
    null,
  );

  useEffect(() => {
    async function loadData() {
      if (!superId) return;

      setLoading(true);
      try {
        const data = await adhkarService.getAdhkarForSuperCategory(superId);
        if (data) {
          setSuperCategory(data.superCategory);
          setCategoryGroups(data.categoryGroups);
          analyticsService.trackAdhkarSessionStarted({
            category: data.superCategory.title || superId,
          });
        }
      } catch (error) {
        console.error('Failed to load super category data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [superId]);

  const storedSuperCategory = useMemo(() => {
    if (!superId) return undefined;
    return getSuperCategoryById(superId);
  }, [superId, getSuperCategoryById]);

  const titled = superCategory ?? storedSuperCategory;
  const displayTitle = titled
    ? getSuperCategoryDisplayTitle(titled)
    : t('common:status.loading');

  // The session's list title, localized as the header shows it.
  const listTitle = superCategory
    ? getSuperCategoryDisplayTitle(superCategory)
    : undefined;

  // Determine if this is a single-category super category
  const isSingleCategory = categoryGroups.length === 1;

  // Build sections for SectionList (multi-category view)
  const sections: Section[] = useMemo(() => {
    if (isSingleCategory) return [];

    let globalIndex = 0;
    return categoryGroups.map(group => {
      const shortTitle = shortenCategoryTitle(group.categoryTitle);
      const data: DhikrItem[] = group.adhkar.map((dhikr, index) => {
        const item = {
          dhikr,
          index,
          globalIndex,
          categoryShortTitle: shortTitle,
        };
        globalIndex++;
        return item;
      });

      return {
        title: group.categoryTitle,
        shortTitle,
        categoryId: group.categoryId,
        data,
      };
    });
  }, [categoryGroups, isSingleCategory]);

  // Build flat list for single-category view
  const flatAdhkarList: DhikrItem[] = useMemo(() => {
    if (!isSingleCategory || categoryGroups.length === 0) return [];

    const group = categoryGroups[0];
    const shortTitle = shortenCategoryTitle(group.categoryTitle);
    return group.adhkar.map((dhikr, index) => ({
      dhikr,
      index,
      globalIndex: index,
      categoryShortTitle: shortTitle,
    }));
  }, [categoryGroups, isSingleCategory]);

  // Build full adhkar list for Play All (works for both single and multi-category)
  const allAdhkarForPlayAll: Dhikr[] = useMemo(() => {
    if (categoryGroups.length === 0) return [];
    return categoryGroups.flatMap(group => group.adhkar);
  }, [categoryGroups]);

  // Where the session's dhikr sits in this screen's rows (session.index
  // counts the session's own items, which can drift from this list).
  const sessionIndex = useMemo(() => {
    if (currentDhikrId === null) return null;
    const found = allAdhkarForPlayAll.findIndex(d => d.id === currentDhikrId);
    return found < 0 ? null : found;
  }, [currentDhikrId, allAdhkarForPlayAll]);

  const locationOf = useCallback(
    (globalIndex: number): {sectionIndex: number; itemIndex: number} | null => {
      let remaining = globalIndex;
      for (
        let sectionIndex = 0;
        sectionIndex < sections.length;
        sectionIndex++
      ) {
        const size = sections[sectionIndex].data.length;
        if (remaining < size) return {sectionIndex, itemIndex: remaining};
        remaining -= size;
      }
      return null;
    },
    [sections],
  );

  const scrollToPlaying = useCallback(() => {
    if (sessionIndex === null) return;
    if (isSingleCategory) {
      flatListRef.current?.scrollToIndex({
        index: sessionIndex,
        viewPosition: 0.3,
        animated: true,
      });
      return;
    }
    const loc = locationOf(sessionIndex);
    if (!loc) return;
    sectionListRef.current?.scrollToLocation({
      ...loc,
      viewPosition: 0.3,
      animated: true,
    });
  }, [sessionIndex, isSingleCategory, locationOf]);

  // A surface asked to show the playing dhikr.
  const lastReveal = useRef(revealToken);
  useEffect(() => {
    if (revealToken === lastReveal.current) return;
    // Not this list's session: drop the request.
    if (sessionIndex === null) {
      lastReveal.current = revealToken;
      return;
    }
    // Still loading: keep the request pending until the rows exist.
    if (loading) return;
    lastReveal.current = revealToken;
    retriedScroll.current = false;
    scrollToPlaying();
  }, [revealToken, sessionIndex, loading, scrollToPlaying]);

  // Unmeasured rows: scroll toward the playing row, then retry once per press.
  const retriedScroll = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );
  const onScrollToIndexFailed = useCallback(
    (info: {highestMeasuredFrameIndex: number}) => {
      if (retriedScroll.current) return;
      retriedScroll.current = true;
      flatListRef.current?.scrollToIndex({
        index: Math.max(0, info.highestMeasuredFrameIndex),
        animated: false,
      });
      sectionListRef.current?.scrollToLocation({
        sectionIndex: 0,
        itemIndex: 0,
        viewPosition: 0,
        animated: false,
      });
      retryTimer.current = setTimeout(scrollToPlaying, 100);
    },
    [scrollToPlaying],
  );
  const handleJumpPress = useCallback(() => {
    retriedScroll.current = false;
    scrollToPlaying();
  }, [scrollToPlaying]);

  // Rows changed: drop stale viewability until the list reports again.
  useEffect(() => {
    setVisibleIndices([]);
  }, [sections, flatAdhkarList]);

  const handleShare = useCallback(() => {
    if (!superId) return;
    const url = adhkarShareUrl(superId);
    shareUrl(
      url,
      t('adhkar.shareCategory', {
        title: displayTitle,
        appName: branding.appName,
      }),
    );
  }, [superId, displayTitle, t]);

  // Play All handler
  const dispatch = useAdhkarSessionStore(s => s.dispatch);
  const handlePlayAll = useCallback(() => {
    if (!superId || allAdhkarForPlayAll.length === 0) return;
    const source = {
      listId: superId,
      listTitle: listTitle || t('adhkar.dhikr'),
      items: toSessionItems(allAdhkarForPlayAll),
    };
    const wasPlaying = isThisCategoryPlaying;
    dispatch({type: 'pressPlayAll', source});
    if (wasPlaying) return;
    const session = useAdhkarSessionStore.getState().session;
    if (!session || session.listId !== superId) return;
    const firstId = session.items[session.index]?.dhikrId;
    const firstIndex = allAdhkarForPlayAll.findIndex(d => d.id === firstId);
    if (firstIndex < 0) return;
    const first = allAdhkarForPlayAll[firstIndex];
    const firstGroup = categoryGroups.find(group =>
      group.adhkar.some(d => d.id === first.id),
    );
    router.push({
      pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
      params: {
        superId,
        dhikrId: first.id,
        globalIndex: String(firstIndex),
        categoryShortTitle: firstGroup
          ? shortenCategoryTitle(firstGroup.categoryTitle)
          : '',
        superCategoryTitle: listTitle,
        playAll: 'true',
      },
    });
  }, [
    superId,
    allAdhkarForPlayAll,
    listTitle,
    t,
    isThisCategoryPlaying,
    dispatch,
    categoryGroups,
    router,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!superId) return;
      const mine: AdhkarFocus = {kind: 'list', listId: superId};
      setAdhkarFocus(mine);
      return () => clearAdhkarFocus(mine);
    }, [superId]),
  );

  // Set native header options dynamically
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTransparent: true,
      headerStyle: {backgroundColor: 'transparent'},
      headerTintColor: theme.colors.text,
      headerShadowVisible: false,
      title: '',
      headerBackTitle: '',
      headerTitleAlign: 'center',
      headerLeft: () => (
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{padding: moderateScale(4)}}>
          <Ionicons
            name="chevron-back"
            size={moderateScale(24)}
            color={theme.colors.text}
            style={flipX}
          />
        </Pressable>
      ),
      headerTitle: () => (
        <View style={{alignItems: 'center'}}>
          <Text
            style={{
              fontSize: moderateScale(16),
              fontFamily: theme.fonts.semiBold,
              color: theme.colors.text,
            }}
            numberOfLines={1}>
            {displayTitle}
          </Text>
          {currentSectionTitle && !isSingleCategory && (
            <Text
              style={{
                fontSize: moderateScale(12),
                fontFamily: theme.fonts.regular,
                color: theme.colors.textSecondary,
                marginTop: moderateScale(2),
              }}
              numberOfLines={1}>
              {currentSectionTitle}
            </Text>
          )}
        </View>
      ),
      headerRight: () => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: moderateScale(20),
            paddingHorizontal: moderateScale(6),
          }}>
          <Pressable onPress={handleShare} hitSlop={8}>
            <Feather
              name="share"
              size={moderateScale(20)}
              color={theme.colors.text}
            />
          </Pressable>
          <PlayAllButton
            onPress={handlePlayAll}
            isPlaying={isThisCategoryPlaying}
            disabled={loading || allAdhkarForPlayAll.length === 0}
          />
        </View>
      ),
    });
  }, [
    navigation,
    displayTitle,
    currentSectionTitle,
    isSingleCategory,
    handleShare,
    handlePlayAll,
    isThisCategoryPlaying,
    loading,
    allAdhkarForPlayAll.length,
    theme,
  ]);

  const renderItem = useCallback(
    ({item}: {item: DhikrItem}) => (
      <Link
        href={{
          pathname: '/(tabs)/(a.home)/adhkar/[superId]/[dhikrId]',
          params: {
            superId: superId,
            dhikrId: item.dhikr.id,
            globalIndex: item.globalIndex.toString(),
            categoryShortTitle: item.categoryShortTitle,
            superCategoryTitle: listTitle,
          },
        }}
        asChild>
        <Pressable style={StyleSheet.flatten([{flex: 1}])}>
          {USE_GLASS ? (
            <Link.AppleZoom>
              <DhikrListItem
                dhikr={item.dhikr}
                index={item.index}
                isCurrent={item.dhikr.id === currentDhikrId}
                isPlaying={item.dhikr.id === currentDhikrId && sessionPlaying}
              />
            </Link.AppleZoom>
          ) : (
            <DhikrListItem
              dhikr={item.dhikr}
              index={item.index}
              isCurrent={item.dhikr.id === currentDhikrId}
              isPlaying={item.dhikr.id === currentDhikrId && sessionPlaying}
            />
          )}
        </Pressable>
      </Link>
    ),
    [superId, listTitle, currentDhikrId, sessionPlaying],
  );

  const renderSectionHeader = useCallback(({section}: {section: Section}) => {
    return <CategorySectionHeader title={section.shortTitle} />;
  }, []);

  // Track current visible section for the subtitle
  const onViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken<DhikrItem | undefined>[]}) => {
      setVisibleIndices(
        visibleRowIndices(viewableItems, v => v.item?.globalIndex),
      );
      if (viewableItems.length > 0) {
        const firstItem = viewableItems[0];
        if (firstItem.section) {
          setCurrentSectionTitle((firstItem.section as Section).shortTitle);
        }
      }
    },
    [],
  );

  const onFlatViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken<DhikrItem>[]}) => {
      setVisibleIndices(
        visibleRowIndices(viewableItems, v => v.item.globalIndex),
      );
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const keyExtractor = useCallback(
    (item: DhikrItem) => `dhikr-${item?.dhikr?.id ?? 'unknown'}`,
    [],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('adhkar.noneFound')}</Text>
      </View>
    ),
    [styles.emptyContainer, styles.emptyText, t],
  );

  if (!superId) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.loadingContainer, {paddingTop: headerHeight}]}>
          <LoadingIndicator />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isSingleCategory ? (
        <FlatList
          ref={flatListRef}
          data={flatAdhkarList}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          contentInset={USE_GLASS ? {top: headerHeight} : undefined}
          contentOffset={USE_GLASS ? {x: 0, y: -headerHeight} : undefined}
          scrollIndicatorInsets={USE_GLASS ? {top: headerHeight} : undefined}
          style={!USE_GLASS ? {marginTop: headerHeight} : undefined}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          onViewableItemsChanged={onFlatViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScrollToIndexFailed={onScrollToIndexFailed}
          ListEmptyComponent={ListEmptyComponent}
        />
      ) : (
        <SectionList
          ref={sectionListRef}
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          contentInset={USE_GLASS ? {top: headerHeight} : undefined}
          contentOffset={USE_GLASS ? {x: 0, y: -headerHeight} : undefined}
          scrollIndicatorInsets={USE_GLASS ? {top: headerHeight} : undefined}
          style={!USE_GLASS ? {marginTop: headerHeight} : undefined}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={7}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScrollToIndexFailed={onScrollToIndexFailed}
          ListEmptyComponent={ListEmptyComponent}
        />
      )}
      <AdhkarJumpPill
        direction={jumpPillDirection(visibleIndices, sessionIndex)}
        playing={sessionPlaying}
        top={headerHeight + moderateScale(8)}
        onPress={handleJumpPress}
      />
    </View>
  );
};
// @ai-end

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      paddingBottom: moderateScale(100),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: moderateScale(100),
    },
    emptyText: {
      fontSize: moderateScale(15),
      fontFamily: theme.fonts.regular,
      color: theme.colors.textSecondary,
    },
  });

export default SuperCategoryListScreen;
