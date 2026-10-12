import {Alert} from 'react-native';
import i18n from '@/i18n';

export const handleError = (error: Error, customMessage?: string) => {
  console.error(error);
  Alert.alert(
    i18n.t('content:errors.title'),
    customMessage || i18n.t('content:errors.unexpected'),
    [{text: i18n.t('common:actions.ok')}],
  );
};
