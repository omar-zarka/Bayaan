import {Pressable} from 'react-native';
import {Stack, useRouter} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {moderateScale} from 'react-native-size-matters';
// @ai-start
import {useTranslation} from 'react-i18next';
// @ai-end
import {AdhkarAudioProvider} from '@/components/adhkar/AdhkarAudioProvider';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS} from '@/hooks/useGlassProps';
import {flipX} from '@/utils/rtl';

// A deep link (widget, Live Activity, App Link) that opens a screen in this
// stack lands on top of its first screen, so back always has a target.
export const unstable_settings = {initialRouteName: 'index'};

// @ai-start
export default function AdhkarLayout() {
  const {theme} = useTheme();
  const {t} = useTranslation(['home', 'common']);
  const router = useRouter();

  return (
    <AdhkarAudioProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          freezeOnBlur: true,
          headerTintColor: theme.colors.text,
          ...(USE_GLASS
            ? {
                headerTransparent: true,
                headerStyle: {backgroundColor: 'transparent'},
              }
            : {
                headerStyle: {backgroundColor: theme.colors.background},
              }),
          headerTitleStyle: {
            fontFamily: 'Manrope-SemiBold',
            color: theme.colors.text,
          },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen
          name="index"
          options={{
            title: t('common:terms.adhkar'),
            // The first screen of this stack gets no system back button, so
            // draw one whenever the home stack has a screen to return to.
            headerLeft: ({canGoBack}) =>
              canGoBack ? (
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('common:actions.back')}
                  style={{padding: moderateScale(4)}}>
                  <Ionicons
                    name="chevron-back"
                    size={moderateScale(24)}
                    color={theme.colors.text}
                    style={flipX}
                  />
                </Pressable>
              ) : null,
          }}
        />
        <Stack.Screen name="[superId]/index" />
        <Stack.Screen name="[superId]/[dhikrId]" />
        <Stack.Screen name="saved" />
      </Stack>
    </AdhkarAudioProvider>
  );
}
// @ai-end
