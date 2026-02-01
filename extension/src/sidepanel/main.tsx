import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { TranslationProvider } from '@/i18n/TranslationContext';
import { bootstrapTheme } from '@/theme/bootstrapTheme';
import '@/styles/global.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  bootstrapTheme(() => {
    root.render(
      <React.StrictMode>
        <TranslationProvider>
          <App />
        </TranslationProvider>
      </React.StrictMode>
    );
  });
}
