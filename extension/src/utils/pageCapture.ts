import type { ExtractionStrategy } from '@/shared/types';

const MAX_CONTENT_LENGTH = 10000;

export interface CapturedPage {
  url: string;
  title: string;
  content: string;
  selectedText?: string;
  strategy: ExtractionStrategy;
}

/**
 * Runs inside chrome.scripting.executeScript — must be entirely self-contained.
 * No imports, no outer-scope references (except the injected maxLen arg).
 */
function extractContentInPage(maxLen: number): {
  content: string;
  selectedText: string;
  strategy: 'selection' | 'semantic' | 'density' | 'fallback';
} {
  const selectedText = window.getSelection()?.toString() || '';

  // Tier 1: User selection (≥50 chars)
  if (selectedText.length >= 50) {
    return {
      content: selectedText.slice(0, maxLen),
      selectedText: selectedText.slice(0, maxLen),
      strategy: 'selection',
    };
  }

  // Tier 2: Semantic containers (<main>, <article>, [role="main"])
  const semanticEl = document.querySelector('main, article, [role="main"]');
  if (semanticEl) {
    const text = (semanticEl as HTMLElement).innerText || '';
    if (text.length >= 200) {
      return {
        content: text.slice(0, maxLen),
        selectedText,
        strategy: 'semantic',
      };
    }
  }

  // Tier 3: Text-density scoring on div/section containers (cap at 100 to avoid heavy DOM walks)
  const candidates = document.querySelectorAll('div, section');
  const maxCandidates = 100;
  let bestEl: HTMLElement | null = null;
  let bestScore = 0;

  for (let i = 0; i < Math.min(candidates.length, maxCandidates); i++) {
    const el = candidates[i] as HTMLElement;

    // Skip nav, header, footer, aside containers
    const tag = el.tagName.toLowerCase();
    if (tag === 'nav' || tag === 'header' || tag === 'footer' || tag === 'aside') continue;
    // Skip elements inside nav/header/footer/aside
    if (el.closest('nav, header, footer, aside')) continue;

    // Check lightweight property first to skip empty elements
    const htmlLen = el.innerHTML.length;
    if (htmlLen === 0) continue;

    const textLen = (el.innerText || '').length;
    if (textLen < 200) continue;

    // density = text-to-markup ratio * size bonus (low ratio = link/nav heavy)
    const density = (textLen / htmlLen) * Math.min(textLen / 1000, 1);

    if (density > bestScore) {
      bestScore = density;
      bestEl = el;
    }
  }

  if (bestEl) {
    const text = bestEl.innerText || '';
    return {
      content: text.slice(0, maxLen),
      selectedText,
      strategy: 'density',
    };
  }

  // Tier 4: Fallback — full body text
  return {
    content: (document.body.innerText || '').slice(0, maxLen),
    selectedText,
    strategy: 'fallback',
  };
}

export async function capturePageContent(): Promise<CapturedPage> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error('No active tab');

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractContentInPage,
    args: [MAX_CONTENT_LENGTH],
  });

  const result = results[0]?.result;
  if (!result) throw new Error('Failed to capture page content');

  return {
    url: tab.url,
    title: tab.title || '',
    content: result.content,
    selectedText: result.selectedText || undefined,
    strategy: result.strategy,
  };
}
