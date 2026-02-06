import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import en from './locales/en.json';
import ja from './locales/ja.json';

type Language = 'en' | 'ja';
type TranslationData = Record<string, unknown>;

const locales: Record<Language, TranslationData> = { en, ja };

function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return path;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';

  const stored = localStorage.getItem('sushi-focus-language');
  if (stored === 'en' || stored === 'ja') {
    return stored;
  }

  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (browserLang === 'ja') {
    return 'ja';
  }

  return 'en';
}

interface TranslationContextValue {
  t: (key: string) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const TranslationContext = createContext<TranslationContextValue>({
  t: (key) => key,
  language: 'en',
  setLanguage: () => {},
});

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getInitialLanguage());

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('sushi-focus-language', lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const value = getNestedValue(locales[language], key);
      if (value !== key) return value;
      // Fallback to English
      if (language !== 'en') {
        const fallback = getNestedValue(locales.en, key);
        if (fallback !== key) return fallback;
      }
      return key;
    },
    [language],
  );

  return (
    <TranslationContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  return useContext(TranslationContext);
}
