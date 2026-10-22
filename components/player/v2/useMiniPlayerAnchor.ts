// @ai-generated
import {useEffect, useRef} from 'react';
import type {View} from 'react-native';
import {
  registerMiniPlayerAnchor,
  unregisterMiniPlayerAnchor,
  type PlayerOrigin,
} from '@/services/player/sheetRef';

/**
 * Registers a mini player as the rect the morphing player surface grows out
 * of. Attach the returned ref to the view whose bounds match the mini player's
 * visible shape. `radius` maps the measured height to its corner radius
 * (capsules pass `h => h / 2`).
 */
export function useMiniPlayerAnchor(radius: (height: number) => number) {
  const anchorRef = useRef<View>(null);
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  useEffect(() => {
    const measure = (done: (origin?: PlayerOrigin) => void) => {
      const view = anchorRef.current;
      if (!view) {
        done(undefined);
        return;
      }
      view.measureInWindow((x, y, width, height) => {
        if (!width || !height) {
          done(undefined);
          return;
        }
        done({x, y, width, height, radius: radiusRef.current(height)});
      });
    };
    registerMiniPlayerAnchor(measure);
    return () => unregisterMiniPlayerAnchor(measure);
  }, []);

  return anchorRef;
}
