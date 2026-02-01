import { useState, useEffect, useCallback } from 'react';
import type { Theme } from '@/shared/types';

export function useTheme(initialTheme: Theme = 'dark') {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    chrome.storage.local.get('settings', (result) => {
      const settings = result.settings;
      if (settings?.theme) {
        setThemeState(settings.theme);
        applyTheme(settings.theme);
      }
    });

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.settings?.newValue?.theme) {
        const newTheme = changes.settings.newValue.theme;
        setThemeState(newTheme);
        applyTheme(newTheme);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    chrome.storage.local.get('settings', (result) => {
      const current = result.settings || {};
      chrome.storage.local.set({
        settings: { ...current, theme: newTheme },
      });
    });
  }, []);

  return { theme, setTheme };
}

export function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
