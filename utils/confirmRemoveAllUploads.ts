import {Alert} from 'react-native';
import type {TFunction} from 'i18next';

/**
 * Ask before wiping every imported recitation. Uploads are the user's own
 * audio files and can't be re-downloaded, so this must never run on a single
 * tap from the options sheet.
 */
export function confirmRemoveAllUploads(
  t: TFunction,
  deleteAll: () => Promise<void>,
): void {
  Alert.alert(
    t('collection:uploadsScreen.removeAllTitle'),
    t('collection:uploadsScreen.removeAllConfirm'),
    [
      {text: t('common:actions.cancel'), style: 'cancel'},
      {
        text: t('common:actions.remove'),
        style: 'destructive',
        onPress: () => {
          deleteAll().catch(error => {
            console.error('Error removing all uploads:', error);
          });
        },
      },
    ],
  );
}
