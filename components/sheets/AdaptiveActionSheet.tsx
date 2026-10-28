// @ai-generated
import React, {forwardRef} from 'react';
// eslint-disable-next-line no-restricted-imports -- this is the wrapper
import ActionSheet, {
  type ActionSheetProps,
  type ActionSheetRef,
} from 'react-native-actions-sheet';
import {useResponsive} from '@/hooks/useResponsive';

/** Widest a sheet gets on iPad (ipad-standards §5.3, sheets and dialogs). */
export const SHEET_MAX_WIDTH = 560;

/** Width a sheet is drawn at for this window. */
export function getSheetWidth(windowWidth: number, isTablet: boolean): number {
  return isTablet ? Math.min(windowWidth, SHEET_MAX_WIDTH) : windowWidth;
}

/** Live width of a sheet, for content laid out from it (HTML, grids). */
export function useSheetWidth(): number {
  const {width, isTablet} = useResponsive();
  return getSheetWidth(width, isTablet);
}

/**
 * `ActionSheet` that stops at `SHEET_MAX_WIDTH` and centers on iPad instead
 * of spanning the whole window. Phones render the library sheet unchanged.
 */
const AdaptiveActionSheet = forwardRef<ActionSheetRef, ActionSheetProps>(
  (props, ref) => {
    const {isTablet} = useResponsive();
    return (
      <ActionSheet
        ref={ref}
        {...props}
        containerStyle={
          isTablet
            ? [props.containerStyle, {maxWidth: SHEET_MAX_WIDTH}]
            : props.containerStyle
        }
      />
    );
  },
);
AdaptiveActionSheet.displayName = 'AdaptiveActionSheet';

export default AdaptiveActionSheet;
