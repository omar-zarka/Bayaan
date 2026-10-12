import 'intl-pluralrules';
import i18n, {type PostProcessorModule} from 'i18next';
import {initReactI18next} from 'react-i18next';
import {currentLanguage, bootstrapDirection} from './language';
import {localizeDigits} from './format';
import {resources, defaultNS, namespaces} from './resources';

const arabicDigits: PostProcessorModule = {
  type: 'postProcessor',
  name: 'arabicDigits',
  process: (value: string) => localizeDigits(value, 'ar'),
};

i18n
  .use(initReactI18next)
  .use(arabicDigits)
  .init({
    resources,
    lng: currentLanguage,
    fallbackLng: 'en',
    ns: namespaces,
    defaultNS,
    initAsync: false,
    returnNull: false,
    interpolation: {escapeValue: false},
    postProcess: currentLanguage === 'ar' ? ['arabicDigits'] : false,
    react: {useSuspense: false},
  });

bootstrapDirection();

export {currentLanguage};
export default i18n;
