import { lazy, Suspense } from 'react';
import { ThemeProvider } from '@/theme/ThemeContext';
import { TranslationProvider } from '@/i18n/TranslationContext';
import Layout from '@/components/Layout';
import Hero from '@/components/Hero';
import Features from '@/components/Features';

const DemoTerminal = lazy(() => import('@/components/DemoTerminal'));
const Installation = lazy(() => import('@/components/Installation'));
const Architecture = lazy(() => import('@/components/Architecture'));
const CTA = lazy(() => import('@/components/CTA'));

export default function App() {
  return (
    <ThemeProvider>
      <TranslationProvider>
        <Layout>
          <Hero />
          <Features />
          <Suspense fallback={null}>
            <DemoTerminal />
            <Installation />
            <Architecture />
            <CTA />
          </Suspense>
        </Layout>
      </TranslationProvider>
    </ThemeProvider>
  );
}
