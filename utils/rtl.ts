import {I18nManager, type ViewStyle} from 'react-native';
import {currentLanguage} from '@/i18n/language';

export const isRTL = I18nManager.isRTL;

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
 * controls, progress sliders, and the mushaf pager, which already encodes
 * right-to-left page order itself.
 */
export const forceLTR: ViewStyle = {direction: 'ltr'};
