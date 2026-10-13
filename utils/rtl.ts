// @ai-generated
import {type ViewStyle} from 'react-native';
import {currentLanguage, isRTLLanguage} from '@/i18n/language';

// The selected language is the source of truth, including the first frame
// before a native direction reload completes.
export const isRTL = isRTLLanguage(currentLanguage);
export const appDirection = isRTL ? 'rtl' : 'ltr';
export const appLayoutDirection: ViewStyle = {direction: appDirection};

/**
 * Letter spacing breaks Arabic cursive joining, so it is dropped when the UI
 * language is Arabic.
 */
export function latinLetterSpacing(value: number): number {
  return currentLanguage === 'ar' ? 0 : value;
}

/**
 * Mirrors directional icons (chevrons, arrows, back buttons) in RTL.
 * Do not apply to media transport icons (play, next, previous) or logos.
 */
export const flipX: ViewStyle | undefined = isRTL
  ? {transform: [{scaleX: -1}]}
  : undefined;

/**
 * Keeps a subtree laid out left-to-right in RTL. Use for media transport
 * controls, progress sliders, and content with physical canvas coordinates.
 * Do not use on horizontal FlatLists: their scroll/index calculations use
 * the native app direction, regardless of the view's direction style.
 */
export const forceLTR: ViewStyle = {direction: 'ltr'};
