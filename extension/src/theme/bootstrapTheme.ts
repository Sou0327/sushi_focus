import type { Theme } from '@/shared/types';
import { applyTheme } from './useTheme';

export function bootstrapTheme(render: () => void, fallback: Theme = 'dark'): void {
  try {
    chrome.storage.local.get('settings', (result) => {
      const theme = result.settings?.theme;
      if (theme === 'light' || theme === 'dark') {
        applyTheme(theme);
      } else {
        applyTheme(fallback);
      }
      render();
    });
  } catch {
    applyTheme(fallback);
    render();
  }
}
