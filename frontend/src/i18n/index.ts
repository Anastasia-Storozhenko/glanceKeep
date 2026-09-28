import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { uk } from './locales/uk';

export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'uk'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLanguage(language: string | null): language is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((supportedLanguage) => supportedLanguage === language);
}

export function getActiveLanguage(): SupportedLanguage {
  const activeLanguage = i18n.resolvedLanguage ?? i18n.language;
  const languageCode = activeLanguage?.split('-')[0] ?? null;

  return isSupportedLanguage(languageCode) ? languageCode : DEFAULT_LANGUAGE;
}

const deviceLanguage = getLocales()[0]?.languageCode ?? null;
const initialLanguage = isSupportedLanguage(deviceLanguage) ? deviceLanguage : DEFAULT_LANGUAGE;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    cleanCode: true,
    defaultNS: 'translation',
    fallbackLng: DEFAULT_LANGUAGE,
    initAsync: false,
    interpolation: {
      escapeValue: false,
    },
    lng: initialLanguage,
    load: 'languageOnly',
    resources: {
      en: {
        translation: en,
      },
      uk: {
        translation: uk,
      },
    },
    returnNull: false,
    supportedLngs: [...SUPPORTED_LANGUAGES],
  });
}

export { i18n };
