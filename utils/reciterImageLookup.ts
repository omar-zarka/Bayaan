// @ai-generated
import type {ImageSourcePropType} from 'react-native';
import {reciterImages} from './reciterImages';
import {bundledImageKey, reciterImageKey} from './reciterImageKey';

export {reciterImageKey};

/** The bundled photo for a reciter, if the app ships one. */
export function getLocalReciterImage(
  name: string | null | undefined,
): ImageSourcePropType | undefined {
  if (!name) return undefined;
  return reciterImages[bundledImageKey(name)];
}
