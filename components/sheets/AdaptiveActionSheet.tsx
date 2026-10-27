// @ai-generated
import React, {
  forwardRef,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
// eslint-disable-next-line no-restricted-imports -- this is the wrapper
import ActionSheet, {
  type ActionSheetProps,
  type ActionSheetRef,
} from 'react-native-actions-sheet';
import {useResponsive} from '@/hooks/useResponsive';
import {getRecentTouch, type TouchPoint} from '@/utils/lastTouch';
import {appLayoutDirection, forceLTR} from '@/utils/rtl';

/** Widest a sheet gets on iPad (ipad-standards §5.3, sheets and dialogs). */
export const SHEET_MAX_WIDTH = 560;
/** Width of a sheet shown as a menu beside its button on iPad. */
export const MENU_WIDTH = 340;
/** Tallest a sheet gets on iPad; taller content scrolls inside it. */
export const SHEET_MAX_HEIGHT = 760;
/** Closest an iPad sheet comes to the window edges. */
const EDGE_MARGIN = 24;
/** Space between the tap and the menu it opened. */
const MENU_GAP = 8;
/** Phone sheets reserve this space for the drag handle and home indicator. */
const CARD_TOP_PADDING = 12;
const CARD_BOTTOM_PADDING = 16;
const DEFAULT_RADIUS = 20;
/** Menus dim the screen less than cards, like an iPad popover. */
const MENU_OVERLAY_OPACITY = 0.12;

/**
 * How a sheet shows on iPad. `card` centers it over the screen like a form
 * sheet. `menu` floats it beside the tap that opened it, for short action
 * lists. Phones always get the bottom sheet.
 */
export type TabletPresentation = 'card' | 'menu';

export interface AdaptiveActionSheetProps extends ActionSheetProps {
  tabletPresentation?: TabletPresentation;
}

interface Size {
  width: number;
  height: number;
}

/** Width a sheet is drawn at for this window. */
export function getSheetWidth(windowWidth: number, isTablet: boolean): number {
  return isTablet ? Math.min(windowWidth, SHEET_MAX_WIDTH) : windowWidth;
}

/** Live width of a sheet, for content laid out from it (HTML, grids). */
export function useSheetWidth(): number {
  const {width, isTablet} = useResponsive();
  return getSheetWidth(width, isTablet);
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**
 * Top-left corner for a menu opened by a tap at `anchor`. It opens away from
 * the nearer side edge, below the tap when it fits and above it otherwise,
 * and never closer than `EDGE_MARGIN` to the edges of `area`.
 */
export function placeMenu(
  anchor: TouchPoint,
  menu: Size,
  area: Size,
): TouchPoint {
  const x = anchor.x > area.width / 2 ? anchor.x - menu.width : anchor.x;
  const fitsBelow =
    anchor.y + MENU_GAP + menu.height <= area.height - EDGE_MARGIN;
  const y = fitsBelow ? anchor.y + MENU_GAP : anchor.y - MENU_GAP - menu.height;
  return {
    x: clamp(x, EDGE_MARGIN, area.width - menu.width - EDGE_MARGIN),
    y: clamp(y, EDGE_MARGIN, area.height - menu.height - EDGE_MARGIN),
  };
}

/** Keeps taps on the card from reaching the layer, which closes the sheet. */
const claimTouch = () => true;

const extraPadding = (base: unknown, extra: number) =>
  typeof base === 'number' ? base + extra : extra;

/**
 * Turns a phone sheet style (rounded and bordered on top only, padded for
 * the drag handle and home indicator) into a floating card's.
 */
export function toCardStyle(style: StyleProp<ViewStyle>): ViewStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const radius =
    flat.borderTopLeftRadius ?? flat.borderRadius ?? DEFAULT_RADIUS;
  const border = flat.borderTopWidth ?? flat.borderWidth;
  return {
    ...flat,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: radius,
    borderBottomRightRadius: radius,
    ...(border != null && {borderBottomWidth: border}),
    paddingTop: extraPadding(
      flat.paddingTop ?? flat.paddingVertical ?? flat.padding,
      CARD_TOP_PADDING,
    ),
    paddingBottom: extraPadding(
      flat.paddingBottom ?? flat.paddingVertical ?? flat.padding,
      CARD_BOTTOM_PADDING,
    ),
  };
}

type TabletSheetProps = Omit<AdaptiveActionSheetProps, 'tabletPresentation'> & {
  presentation: TabletPresentation;
};

/**
 * The library sheet slides up a transparent, full-height layer, and the
 * sheet's own content sits on a card inside it. Tapping the layer around the
 * card closes the sheet, as tapping the backdrop does on phones.
 */
const TabletSheet = forwardRef<ActionSheetRef, TabletSheetProps>(
  ({presentation, containerStyle, children, ...props}, ref) => {
    // The library sheet reads the same context; read it softly so a sheet
    // rendered without a provider (tests) still draws.
    const topInset = useContext(SafeAreaInsetsContext)?.top ?? 0;
    const sheetRef = useRef<ActionSheetRef | null>(null);
    const setRef = useCallback(
      (instance: ActionSheetRef | null) => {
        sheetRef.current = instance;
        if (typeof ref === 'function') {
          ref(instance);
        } else if (ref) {
          ref.current = instance;
        }
      },
      [ref],
    );
    // The sheet mounts when it is shown, so this is the tap that showed it.
    const [touch] = useState(getRecentTouch);
    const [area, setArea] = useState<Size | null>(null);
    const [menu, setMenu] = useState<Size | null>(null);
    const asMenu = presentation === 'menu' && touch !== null;

    const {closable, closeOnTouchBackdrop, onTouchBackdrop} = props;
    const handleBackdropPress = useCallback(
      (event: GestureResponderEvent) => {
        onTouchBackdrop?.(event);
        if (closable !== false && closeOnTouchBackdrop !== false) {
          sheetRef.current?.hide();
        }
      },
      [closable, closeOnTouchBackdrop, onTouchBackdrop],
    );
    const handleAreaLayout = useCallback((event: LayoutChangeEvent) => {
      const {width, height} = event.nativeEvent.layout;
      setArea({width, height});
    }, []);
    const handleMenuLayout = useCallback((event: LayoutChangeEvent) => {
      const {width, height} = event.nativeEvent.layout;
      setMenu({width, height});
    }, []);

    const maxHeight = Math.min(
      (area?.height ?? SHEET_MAX_HEIGHT) - 2 * EDGE_MARGIN,
      SHEET_MAX_HEIGHT,
    );
    // The layer starts below the status bar; touches are in window points.
    const menuOrigin =
      asMenu && area && menu
        ? placeMenu({x: touch.x, y: touch.y - topInset}, menu, area)
        : null;

    return (
      <ActionSheet
        ref={setRef}
        {...props}
        containerStyle={styles.layer}
        gestureEnabled={false}
        disableElevation={true}
        overdrawEnabled={false}
        useBottomSafeAreaPadding={false}
        drawUnderStatusBar={false}
        animated={asMenu ? false : props.animated}
        defaultOverlayOpacity={
          asMenu ? MENU_OVERLAY_OPACITY : props.defaultOverlayOpacity
        }>
        <Pressable
          accessible={false}
          onLayout={handleAreaLayout}
          onPress={handleBackdropPress}
          style={[styles.area, forceLTR, !asMenu && styles.centered]}>
          <View
            onLayout={asMenu ? handleMenuLayout : undefined}
            onStartShouldSetResponder={claimTouch}
            style={[
              toCardStyle(containerStyle),
              styles.shadow,
              appLayoutDirection,
              asMenu
                ? [
                    styles.menu,
                    menuOrigin
                      ? {left: menuOrigin.x, top: menuOrigin.y}
                      : styles.measuring,
                  ]
                : styles.card,
              {maxHeight},
            ]}>
            {children}
          </View>
        </Pressable>
      </ActionSheet>
    );
  },
);
TabletSheet.displayName = 'TabletSheet';

/**
 * `ActionSheet` that phones get unchanged. On iPad it never spans the
 * window: it shows as a centered card at most `SHEET_MAX_WIDTH` wide, or as
 * a menu beside its button when `tabletPresentation` is `menu`.
 */
const AdaptiveActionSheet = forwardRef<
  ActionSheetRef,
  AdaptiveActionSheetProps
>(({tabletPresentation = 'card', ...props}, ref) => {
  const {isTablet} = useResponsive();
  if (isTablet) {
    return (
      <TabletSheet ref={ref} presentation={tabletPresentation} {...props} />
    );
  }
  return <ActionSheet ref={ref} {...props} />;
});
AdaptiveActionSheet.displayName = 'AdaptiveActionSheet';

export default AdaptiveActionSheet;

const styles = StyleSheet.create({
  layer: {
    height: '100%',
    backgroundColor: 'transparent',
  },
  area: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: EDGE_MARGIN,
  },
  card: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
  },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
  },
  measuring: {
    opacity: 0,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
});
