import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Language } from '@/shared/types';
import en from './locales/en.json';
import ja from './locales/ja.json';

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

interface TranslationContextValue {
  t: (key: string, params?: Record<string, string | number>) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const TranslationContext = createContext<TranslationContextValue>({
  t: (key) => key,
  language: 'en',
  setLanguage: () => {},
});

export function TranslationProvider({
  children,
  initialLanguage = 'en',
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      const settings = result.settings;
      if (settings?.language) {
        setLanguageState(settings.language);
      }
    });

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.settings?.newValue?.language) {
        setLanguageState(changes.settings.newValue.language);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    chrome.storage.local.get('settings', (result) => {
      const current = result.settings || {};
      chrome.storage.local.set({
        settings: { ...current, language: lang },
      });
    });
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = getNestedValue(locales[language], key);
      if (value === key && language !== 'en') {
        // Fallback to English
        const fallback = getNestedValue(locales.en, key);
        if (fallback !== key) value = fallback;
      }
      if (!params) return value;
      return value.replace(/\{(\w+)\}/g, (_, k) =>
        params[k] !== undefined ? String(params[k]) : `{${k}}`
      );
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
