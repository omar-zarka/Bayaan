// @ai-generated
import {Alert, DevSettings, I18nManager} from 'react-native';
import {createMMKV} from 'react-native-mmkv';
import {reloadAppAsync} from 'expo';
import {getLocales} from 'expo-localization';
import * as Updates from 'expo-updates';

export type AppLanguage = 'en' | 'ar';
export type LanguagePreference = 'system' | AppLanguage;

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'ar'];

const RTL_LANGUAGES: ReadonlySet<AppLanguage> = new Set(['ar']);

const storage = createMMKV({id: 'i18n'});
const PREFERENCE_KEY = 'language_preference';
const RTL_RELOAD_GUARD_KEY = 'rtl_reload_attempted_v3';

export function getLanguagePreference(): LanguagePreference {
  const stored = storage.getString(PREFERENCE_KEY);
  if (stored === 'en' || stored === 'ar' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function getDeviceLanguage(): AppLanguage {
  try {
    for (const locale of getLocales()) {
      const code = locale.languageCode as AppLanguage | null;
      if (code && SUPPORTED_LANGUAGES.includes(code)) {
        return code;
      }
    }
  } catch {
    // Native module unavailable (e.g. tests) — fall through to English.
  }
  return 'en';
}

export function resolveLanguage(
  preference: LanguagePreference = getLanguagePreference(),
): AppLanguage {
  return preference === 'system' ? getDeviceLanguage() : preference;
}

export function isRTLLanguage(language: AppLanguage): boolean {
  return RTL_LANGUAGES.has(language);
}

/** Language for this app session. Fixed until the next JS reload. */
export const currentLanguage: AppLanguage = resolveLanguage();

/**
 * Initial reading-aid preference only. Persisted user choices take precedence
 * and remain available in every interface language.
 */
export const defaultShowEnglishReadingAids = currentLanguage !== 'ar';

async function reloadApp(): Promise<void> {
  // Reload the React Native runtime in both development and standalone builds,
  // including builds with OTA updates disabled.
  try {
    await reloadAppAsync('language direction change');
    return;
  } catch {
    // Not available in every runtime.
  }
  try {
    await Updates.reloadAsync();
    return;
  } catch {
    // Updates.reloadAsync throws in development builds.
  }
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  Alert.alert(
    currentLanguage === 'ar' ? 'أعد تشغيل التطبيق' : 'Restart required',
    currentLanguage === 'ar'
      ? 'أغلق التطبيق وافتحه مجددًا لتطبيق اللغة الجديدة.'
      : 'Close and reopen the app to apply the new language.',
  );
}

/**
 * Applies the layout direction for `language`. Direction changes only take
 * effect after a reload, so this returns whether a reload is required.
 */
function applyDirection(language: AppLanguage): boolean {
  const shouldBeRTL = isRTLLanguage(language);
  const needsReload =
    I18nManager.isRTL !== shouldBeRTL ||
    (shouldBeRTL && !I18nManager.doLeftAndRightSwapInRTL);
  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.swapLeftAndRightInRTL(true);
  // Write both directions even if the cached JS isRTL already matches. The
  // native persisted flag may have changed since those constants were read.
  I18nManager.forceRTL(shouldBeRTL);
  return needsReload;
}

export async function setLanguagePreference(
  preference: LanguagePreference,
): Promise<void> {
  storage.set(PREFERENCE_KEY, preference);
  storage.remove(RTL_RELOAD_GUARD_KEY);
  const nextLanguage = resolveLanguage(preference);
  const directionChanged = applyDirection(nextLanguage);
  if (directionChanged || nextLanguage !== currentLanguage) {
    await reloadApp();
  }
}

/**
 * Called once at startup. If the native layout direction disagrees with the
 * resolved language (e.g. first launch on an Arabic device), force it and
 * reload once. The guard prevents a reload loop if the platform refuses.
 */
export function bootstrapDirection(): void {
  const needsReload = applyDirection(currentLanguage);
  if (!needsReload) {
    storage.remove(RTL_RELOAD_GUARD_KEY);
    return;
  }
  if (storage.getString(RTL_RELOAD_GUARD_KEY) === currentLanguage) {
    return;
  }
  storage.set(RTL_RELOAD_GUARD_KEY, currentLanguage);
  void reloadApp();
}
