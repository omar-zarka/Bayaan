import React from 'react';
import {View} from 'react-native';
import {moderateScale} from 'react-native-size-matters';
import {ScaledSheet} from 'react-native-size-matters';
import {Theme} from '@/utils/themeUtils';
import {useTheme} from '@/hooks/useTheme';
import SearchBar from '@/components/SearchBar';
import {SearchHeaderProps} from '@/components/reciter-profile/types';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end

/**
 * SearchHeader component for the ReciterProfile
 *
 * This component displays the search bar at the top of the ReciterProfile screen
 * when search is active.
 *
 * @component
 */
// @ai-start
export const SearchHeader: React.FC<SearchHeaderProps> = ({
  showSearch,
  searchQuery,
  onSearchChange,
  insets,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation('player');
  const styles = createStyles(theme);

  if (!showSearch) return null;

  return (
    <View
      style={[
        styles.searchBarContainer,
        {paddingTop: insets.top + moderateScale(15)},
      ]}>
      <SearchBar
        placeholder={t('reciterProfile.searchPlaceholder')}
        onChangeText={onSearchChange}
        value={searchQuery}
      />
    </View>
  );
};
// @ai-end

const createStyles = (theme: Theme) =>
  ScaledSheet.create({
    searchBarContainer: {
      backgroundColor: theme.colors.background,
      paddingHorizontal: moderateScale(20),
      paddingBottom: moderateScale(10),
      zIndex: 1,
    },
  });
