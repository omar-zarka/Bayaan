// @ai-generated
import React, {useCallback, useEffect, useMemo} from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {GlassView} from 'expo-glass-effect';
import {usePlayerActions} from '@/hooks/usePlayerActions';
import {usePlayerStore} from '@/services/player/store/playerStore';
import {useTheme} from '@/hooks/useTheme';
import {USE_GLASS, useGlassColorScheme} from '@/hooks/useGlassProps';
import {FrostedView} from '@/components/FrostedView';
import {
  measureMiniPlayerAnchor,
  registerPlayerSheetController,
  unregisterPlayerSheetController,
  type PlayerOrigin,
  type PlayerSheetController,
} from '@/services/player/sheetRef';
import {appLayoutDirection, forceLTR} from '@/utils/rtl';
import {PlayerBody} from '../PlayerBody';
import {
  PlayerDismissProvider,
  type PlayerDismissApi,
} from '../PlayerDismissContext';

/**
 * Corner radius the surface takes while it is in motion or being dragged. It
 * eases to 0 as the surface settles full screen, so an open player is a plain
 * full-screen view and the physical screen corners do the rounding: nothing
 * can show around the corners whatever the device's real radius is.
 */
const SCREEN_CORNER_RADIUS = Platform.select({ios: 44, default: 32});

// Critically damped, no overshoot: an overshoot past full screen would
// briefly pull the corners off the screen edges.
const SPRING = {
  damping: 30,
  stiffness: 280,
  mass: 1,
  overshootClamping: true,
} as const;

const REDUCED_MOTION_DURATION = 200;

// Release thresholds for drag-to-dismiss.
const CLOSE_VELOCITY = 900; // px/s downward
const CLOSE_DISTANCE_RATIO = 0.25; // of the screen height
const BACKDROP_OPACITY = 0.5;

interface SurfaceMotion {
  /** Morph progress: 0 = on the mini player's rect, 1 = full screen. */
  progress: SharedValue<number>;
  /** Interactive drag-down offset in px, applied on top of the morph. */
  dragY: SharedValue<number>;
  onDragStart: () => void;
  onDragUpdate: (translationY: number) => void;
  onDragEnd: (velocityY: number) => void;
}

/**
 * Scroll component for the Mushaf / queue FlashLists inside the surface. A
 * downward drag that starts with the list at its top hands off to the
 * surface's dismiss; any other drag scrolls the list as usual. Unlike gorhom's
 * scrollable it never intercepts imperative scrollToIndex / scrollToOffset.
 */
function createSurfaceScrollable(motion: SurfaceMotion) {
  const SurfaceScrollable = React.forwardRef<ScrollView, ScrollViewProps>(
    (props, ref) => {
      const {onScroll, style, contentContainerStyle} = props;
      const scrollY = useSharedValue(0);
      const touchStartY = useSharedValue(0);

      const gesture = useMemo(() => {
        const native = Gesture.Native();
        const pan = Gesture.Pan()
          .manualActivation(true)
          .onTouchesDown(e => {
            touchStartY.value = e.allTouches[0]?.absoluteY ?? 0;
          })
          .onTouchesMove((e, manager) => {
            const touch = e.allTouches[0];
            if (!touch) return;
            const dy = touch.absoluteY - touchStartY.value;
            if (Math.abs(dy) < 10) return;
            if (dy > 0 && scrollY.value <= 0) {
              manager.activate();
            } else {
              manager.fail();
            }
          })
          .onStart(motion.onDragStart)
          .onUpdate(e => motion.onDragUpdate(e.translationY))
          .onEnd(e => motion.onDragEnd(e.velocityY))
          .simultaneousWithExternalGesture(native);
        return Gesture.Simultaneous(native, pan);
      }, [scrollY, touchStartY]);

      const handleScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollY.value = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        },
        [onScroll, scrollY],
      );

      return (
        <GestureDetector gesture={gesture}>
          <ScrollView
            ref={ref}
            {...props}
            // Keep the native viewport LTR and let the content inherit the
            // app direction, matching the gorhom scrollable.
            style={[style, forceLTR]}
            contentContainerStyle={[contentContainerStyle, appLayoutDirection]}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            // The pull-down at the top belongs to the dismiss, not a bounce.
            bounces={false}
            overScrollMode="never"
          />
        </GestureDetector>
      );
    },
  );
  SurfaceScrollable.displayName = 'SurfaceScrollable';
  return SurfaceScrollable;
}

/**
 * The full player as one always-mounted surface that morphs out of the mini
 * player (iOS bottom accessory, Android pill, tablet dock) and back onto it.
 * The surface starts exactly over the mini player's rect, with a transparent
 * background that fades in as it grows, so the mini player underneath is
 * covered for the whole open and close and needs no hiding of its own.
 */
export const PlayerSurface = () => {
  const {theme} = useTheme();
  const glassColorScheme = useGlassColorScheme();
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const {setSheetMode, setImmersive} = usePlayerActions();
  const sheetMode = usePlayerStore(s => s.sheetMode);

  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  // Where progress is heading, so a JS-side sheetMode change doesn't restart
  // (and drop the velocity of) an animation a gesture already started.
  const target = useSharedValue(0);
  const origin = useSharedValue<PlayerOrigin | null>(null);
  const screen = useSharedValue({width: screenWidth, height: screenHeight});

  useEffect(() => {
    screen.value = {width: screenWidth, height: screenHeight};
  }, [screen, screenWidth, screenHeight]);

  const settle = useCallback(
    (to: 0 | 1, velocity: number) => {
      'worklet';
      target.value = to;
      if (reducedMotion) {
        progress.value = withTiming(to, {duration: REDUCED_MOTION_DURATION});
        dragY.value = withTiming(0, {duration: REDUCED_MOTION_DURATION});
        return;
      }
      progress.value = withSpring(to, {...SPRING, velocity});
      dragY.value = withSpring(0, SPRING);
    },
    [reducedMotion, target, progress, dragY],
  );

  const open = useCallback(
    (from?: PlayerOrigin) => {
      if (target.value === 1) return;
      target.value = 1;
      const start = (o?: PlayerOrigin) => {
        origin.value = o ?? null;
        settle(1, 0);
      };
      if (from) start(from);
      else measureMiniPlayerAnchor(start);
    },
    [origin, settle, target],
  );

  const close = useCallback(() => {
    if (target.value === 0) return;
    target.value = 0;
    // Re-measure: the mini player may have moved while the player was open
    // (e.g. the iOS accessory switching between its two placements).
    measureMiniPlayerAnchor(o => {
      if (o) origin.value = o;
      settle(0, 0);
    });
  }, [origin, settle, target]);

  useEffect(() => {
    const controller: PlayerSheetController = {expand: open, close};
    registerPlayerSheetController(controller);
    return () => unregisterPlayerSheetController(controller);
  }, [open, close]);

  useEffect(() => {
    if (sheetMode === 'full') {
      open();
    } else {
      setImmersive(false);
      close();
    }
  }, [sheetMode, open, close, setImmersive]);

  const markHidden = useCallback(() => {
    if (usePlayerStore.getState().sheetMode !== 'hidden') {
      setSheetMode('hidden');
    }
  }, [setSheetMode]);

  const onDragStart = useCallback(() => {
    'worklet';
    cancelAnimation(dragY);
    dragStartY.value = dragY.value;
  }, [dragY, dragStartY]);

  const onDragUpdate = useCallback(
    (translationY: number) => {
      'worklet';
      dragY.value = Math.max(0, dragStartY.value + translationY);
    },
    [dragY, dragStartY],
  );

  const onDragEnd = useCallback(
    (velocityY: number) => {
      'worklet';
      const shouldClose =
        velocityY > CLOSE_VELOCITY ||
        (dragY.value > screen.value.height * CLOSE_DISTANCE_RATIO &&
          velocityY > -CLOSE_VELOCITY / 3);
      if (shouldClose) {
        // Progress is in units of the open distance; carry the finger's
        // velocity into the morph so a flick finishes naturally.
        const distance = Math.max(origin.value?.y ?? screen.value.height, 1);
        settle(0, -velocityY / distance);
        runOnJS(markHidden)();
      } else {
        settle(1, 0);
      }
    },
    [dragY, screen, origin, settle, markHidden],
  );

  const motion = useMemo<SurfaceMotion>(
    () => ({progress, dragY, onDragStart, onDragUpdate, onDragEnd}),
    [progress, dragY, onDragStart, onDragUpdate, onDragEnd],
  );

  const renderScrollComponent = useMemo(
    () => createSurfaceScrollable(motion),
    [motion],
  );

  const createDismissGesture = useCallback(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .failOffsetX([-20, 20])
        .onStart(motion.onDragStart)
        .onUpdate(e => motion.onDragUpdate(e.translationY))
        .onEnd(e => motion.onDragEnd(e.velocityY))
        .shouldCancelWhenOutside(false),
    [motion],
  );

  const dismissApi = useMemo<PlayerDismissApi>(
    () => ({createDismissGesture, renderScrollComponent}),
    [createDismissGesture, renderScrollComponent],
  );

  const frameStyle = useAnimatedStyle(() => {
    const {width: w, height: h} = screen.value;
    const p = progress.value;
    if (reducedMotion) {
      return {
        width: w,
        height: h,
        borderRadius: 0,
        opacity: p,
        transform: [{translateX: 0}, {translateY: 0}],
      };
    }
    // No mini player to grow from (e.g. a deep link): slide up from below.
    const o = origin.value ?? {
      x: 0,
      y: h,
      width: w,
      height: h,
      radius: SCREEN_CORNER_RADIUS,
    };
    const morphRadius = interpolate(
      p,
      [0, 0.9, 1],
      [o.radius, SCREEN_CORNER_RADIUS, 0],
    );
    const dragRadius = interpolate(
      dragY.value,
      [0, 40],
      [0, SCREEN_CORNER_RADIUS],
      Extrapolation.CLAMP,
    );
    return {
      width: interpolate(p, [0, 1], [o.width, w]),
      height: interpolate(p, [0, 1], [o.height, h]),
      borderRadius: Math.max(morphRadius, dragRadius * p),
      opacity: 1,
      transform: [
        {translateX: interpolate(p, [0, 1], [o.x, 0])},
        {translateY: interpolate(p, [0, 1], [o.y, 0]) + dragY.value * p},
      ],
    };
  });

  // Uniform scale so the full-size content grows with the frame instead of
  // being revealed by it; it is laid out once at screen size and never relaid
  // out during the morph.
  const contentStyle = useAnimatedStyle(() => {
    const {width: w, height: h} = screen.value;
    const p = progress.value;
    const startScale =
      reducedMotion || !origin.value ? 1 : origin.value.width / w;
    return {
      width: w,
      height: h,
      opacity: interpolate(p, [0.1, 0.45], [0, 1], Extrapolation.CLAMP),
      transform: [{scale: interpolate(p, [0, 1], [startScale, 1])}],
    };
  });

  // The mini player's own material at the start, so the surface's first frame
  // matches the capsule it sits on, then the player background.
  const glassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.05, 0.3],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.05, 0.3],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const backdropStyle = useAnimatedStyle(() => {
    const dragFade = interpolate(
      dragY.value,
      [0, screen.value.height],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {opacity: progress.value * dragFade * BACKDROP_OPACITY};
  });

  const isOpen = sheetMode === 'full';

  return (
    <PlayerDismissProvider value={dismissApi}>
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, backdropStyle]}
      />
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[styles.frame, frameStyle]}>
        {USE_GLASS ? (
          <Animated.View style={[StyleSheet.absoluteFill, glassStyle]}>
            <GlassView
              style={StyleSheet.absoluteFill}
              glassEffectStyle="regular"
              colorScheme={glassColorScheme}
            />
          </Animated.View>
        ) : (
          <Animated.View style={[StyleSheet.absoluteFill, glassStyle]}>
            <FrostedView style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor: theme.colors.background},
            backgroundStyle,
          ]}
        />
        <Animated.View style={[styles.content, contentStyle]}>
          <PlayerBody />
        </Animated.View>
      </Animated.View>
    </PlayerDismissProvider>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000',
    zIndex: 2000,
    elevation: 20,
  },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    borderCurve: 'continuous',
    zIndex: 2000,
    elevation: 20,
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: 'left top',
  },
});
