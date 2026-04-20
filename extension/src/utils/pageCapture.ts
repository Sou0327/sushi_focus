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
 * Exported only for unit testing under a DOM environment.
 */
export function extractContentInPage(maxLen: number): {
  content: string;
  selectedText: string;
  strategy: 'selection' | 'semantic' | 'density' | 'fallback';
} {
  // Inline helpers. All declarations stay local to preserve the self-contained
  // contract: chrome.scripting.executeScript serializes this function via
  // Function.prototype.toString and ships it into the target page, so any
  // reference to module-scope symbols would fail at runtime.
  //
  // enhanceLinks mutates the given root by inserting a text node " (absolute-url)"
  // right after each http(s) anchor whose visible text does not already contain
  // its URL. The subsequent innerText pickup then yields readable output with
  // URL suffixes. Rules:
  //   - http(s) only; javascript:/data:/blob:/mailto:/tel:/about: are skipped.
  //   - Same-document fragment-only anchors (ToC, "back to top") are skipped —
  //     they resolve to the current page URL and would burn the budget on noise.
  //   - Anchors inside <pre>/<code>/<kbd>/<samp> are skipped to avoid corrupting
  //     code samples.
  //   - Nested anchors (an <a> inside another <a>) are skipped to avoid injecting
  //     a URL mid-link.
  //   - Each unique href is annotated only once per extraction (dedup).
  // Returns true when an anchor is a same-document fragment-only reference
  // (e.g. ToC, "back to top") that resolves to the current URL with only
  // hash differing. Query-string differences DO count as a distinct target.
  const isSameDocFragment = (a: HTMLAnchorElement, loc: Location): boolean => {
    return (
      !!a.hash &&
      a.pathname === loc.pathname &&
      a.search === loc.search &&
      a.host === loc.host &&
      a.protocol === loc.protocol
    );
  };

  // Shared skip policy for both in-tree enhancement and selection-ancestor
  // fallback. Keeps the two paths consistent (e.g. code-block anchors are
  // uniformly ignored whether the user selected them or not).
  const isSkippableAnchor = (a: HTMLAnchorElement, loc: Location): boolean => {
    if (a.closest('pre, code, kbd, samp')) return true;
    if (a.parentElement?.closest('a[href]')) return true;
    const href = a.href;
    if (!href) return true;
    if (!/^https?:\/\//i.test(href)) return true;
    if (isSameDocFragment(a, loc)) return true;
    return false;
  };

  const enhanceLinks = (root: Element): void => {
    const seen = new Set<string>();
    const anchors = root.querySelectorAll('a[href]');
    const loc = window.location;
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i] as HTMLAnchorElement;
      if (isSkippableAnchor(a, loc)) continue;
      const href = a.href;
      const text = (a.textContent || '').trim();
      if (!text) continue;
      if (text === href) continue;
      if (text.includes(href)) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      a.after(document.createTextNode(` (${href})`));
    }
  };

  const readText = (el: Element): string => {
    return (el as HTMLElement).innerText || el.textContent || '';
  };

  // Collapse layout whitespace without destroying paragraph breaks or the
  // single newlines inside <pre>/code samples. Safe on any text we extract:
  //   - trim trailing spaces/tabs on each line
  //   - collapse 3+ consecutive newlines to 2 (keep one blank line between sections)
  //   - trim overall leading / trailing whitespace
  const compressWhitespace = (s: string): string => {
    return s
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '');
  };

  // Shared subtree-size guard. cloneNode(true) + querySelectorAll on very
  // large subtrees (huge <main>, dense SPAs) is expensive; fall through to
  // a TreeWalker streaming read that stops as soon as maxLen is reached.
  // Applied uniformly to semantic, density and fallback tiers so any tier
  // landing on a jank-prone subtree is protected.
  const MAX_SUBTREE_ELEMENTS = 10_000;

  // Tags whose text content must never be extracted: SSR hydration JSON
  // blobs (e.g. GitHub's <script type="application/json">), CSS, inert
  // templates, and fallback noscript bodies. On a detached clone innerText
  // falls back to textContent-like semantics and would otherwise leak these.
  const NOISE_TAG_SELECTOR = 'script, style, noscript, template';

  const streamTextUntilMax = (root: Node, max: number): string => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = (node as Text).parentElement;
        if (parent?.closest(NOISE_TAG_SELECTOR)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let text = '';
    let node: Node | null;
    while ((node = walker.nextNode()) !== null) {
      text += node.textContent || '';
      if (text.length >= max) break;
    }
    return text.slice(0, max);
  };

  const extractContent = (el: Element, max: number): string => {
    // Stream with 2x headroom so the final slice budget is spent on real
    // content after whitespace collapse (typical layout whitespace can reduce
    // raw text by 20-50%).
    const streamCap = max * 2;
    if (el.getElementsByTagName('*').length > MAX_SUBTREE_ELEMENTS) {
      return compressWhitespace(streamTextUntilMax(el, streamCap)).slice(0, max);
    }
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll(NOISE_TAG_SELECTOR).forEach((n) => n.remove());
    enhanceLinks(clone);
    const cloneText = readText(clone);
    if (cloneText) return compressWhitespace(cloneText).slice(0, max);
    // Fallback: use the noise-filtered streaming walker on the original
    // element so script/style/template bodies never leak back in.
    return compressWhitespace(streamTextUntilMax(el, streamCap)).slice(0, max);
  };

  const selection = window.getSelection();
  const selectedText = selection?.toString() || '';

  // Tier 1: User selection (≥50 chars)
  if (selectedText.length >= 50) {
    let enhanced = selectedText;
    let noiseSafeSelection = selectedText;
    const loc = window.location;
    try {
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const wrapper = document.createElement('div');
        wrapper.appendChild(range.cloneContents());
        // Same noise strip as extractContent: detached wrappers lose innerText's
        // script/style skipping, so remove them before reading.
        wrapper.querySelectorAll(NOISE_TAG_SELECTOR).forEach((n) => n.remove());
        // Capture plain noise-free text BEFORE enhancement for the
        // selectedText field (keeps the "what the user highlighted" semantic
        // URL-free, while content below gets the link-enhanced version).
        const plainAfterStrip = readText(wrapper);
        if (plainAfterStrip) noiseSafeSelection = plainAfterStrip;
        enhanceLinks(wrapper);
        const wrapperText = readText(wrapper);
        if (wrapperText) enhanced = wrapperText;

        // If the user selected only text nodes inside an anchor, cloneContents
        // returns a fragment without the wrapping <a>, so enhanceLinks finds
        // no anchors. Walk up from the range's commonAncestorContainer to find
        // an ancestor anchor and append its URL once.
        let node: Node | null = range.commonAncestorContainer;
        while (node && node.nodeType !== 1 /* ELEMENT_NODE */) {
          node = node.parentNode;
        }
        const ancestorAnchor = (node as Element | null)?.closest('a[href]') as
          | HTMLAnchorElement
          | null;
        if (ancestorAnchor && !isSkippableAnchor(ancestorAnchor, loc)) {
          const href = ancestorAnchor.href;
          if (!enhanced.includes(href)) {
            enhanced = `${enhanced} (${href})`;
          }
        }
      }
    } catch {
      // Detached nodes or cross-origin selections can throw; keep plain text.
    }
    return {
      content: compressWhitespace(enhanced).slice(0, maxLen),
      selectedText: compressWhitespace(noiseSafeSelection).slice(0, maxLen),
      strategy: 'selection',
    };
  }

  // Tier 2: Semantic containers (<main>, <article>, [role="main"])
  // Use bounded streaming for the 200-char qualification so huge <main> trees
  // don't pay for a full innerText traversal just to decide whether to qualify.
  const semanticEl = document.querySelector('main, article, [role="main"]');
  if (semanticEl && streamTextUntilMax(semanticEl, 200).length >= 200) {
    return {
      content: extractContent(semanticEl, maxLen),
      selectedText,
      strategy: 'semantic',
    };
  }

  // Tier 3: Text-density scoring on div/section containers (cap at 100 to avoid heavy DOM walks).
  // Avoid innerHTML / innerText on every candidate — both allocate large
  // strings or force layout on huge subtrees. Use the cheap live descendant
  // count as a markup-size proxy and bounded streaming for text length.
  const candidates = document.querySelectorAll('div, section');
  const maxCandidates = 100;
  const DENSITY_TEXT_BUDGET = 2000;
  let bestEl: HTMLElement | null = null;
  let bestScore = 0;

  for (let i = 0; i < Math.min(candidates.length, maxCandidates); i++) {
    const el = candidates[i] as HTMLElement;

    // Skip nav, header, footer, aside containers
    const tag = el.tagName.toLowerCase();
    if (tag === 'nav' || tag === 'header' || tag === 'footer' || tag === 'aside') continue;
    // Skip elements inside nav/header/footer/aside
    if (el.closest('nav, header, footer, aside')) continue;

    // Skip candidates whose subtree is too large to extract efficiently.
    const descendantCount = el.getElementsByTagName('*').length;
    if (descendantCount > MAX_SUBTREE_ELEMENTS) continue;

    // Bounded text extraction for scoring; cap at DENSITY_TEXT_BUDGET so we
    // don't traverse an entire long <article> repeatedly across candidates.
    const text = streamTextUntilMax(el, DENSITY_TEXT_BUDGET);
    const textLen = text.length;
    if (textLen < 200) continue;

    // density = text-per-descendant * size bonus. Text-only elements have
    // descendantCount === 0, so the denominator is floored at 1.
    const density = (textLen / Math.max(descendantCount, 1)) * Math.min(textLen / 1000, 1);

    if (density > bestScore) {
      bestScore = density;
      bestEl = el;
    }
  }

  if (bestEl) {
    return {
      content: extractContent(bestEl, maxLen),
      selectedText,
      strategy: 'density',
    };
  }

  // Tier 4: Fallback — full body text. extractContent applies the shared
  // subtree-size guard, so huge <body> trees stream via TreeWalker instead
  // of cloning.
  return {
    content: extractContent(document.body, maxLen),
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
