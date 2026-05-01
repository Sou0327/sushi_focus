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

  // Tier 3: Text-density scoring on div/section containers.
  //
  // Two-stage approach to balance correctness and performance:
  //   Stage 1 — Cheap pass over all candidates (capped at 100 iterations).
  //     Score with `descendantCount * 30` as a markup-size estimate; this
  //     avoids allocating large innerHTML strings on every candidate and
  //     produces a coarse ranking.
  //   Stage 2 — Accurate re-ranking on a shortlist using the actual
  //     `innerHTML.length`, with `<script>/<style>/<noscript>/<template>`
  //     content subtracted out so the markup denominator matches the
  //     noise-filtered textLen numerator. The shortlist is the union of
  //     "top K by quickDensity" and "top K by textLen" — the second axis
  //     guarantees a long body candidate isn't squeezed out by several
  //     compact text-only cards that score marginally higher in Stage 1.
  //
  // Together, two-stage + union shortlist + noise-aware markup measurement
  // lets Tier 3 reliably pick realistic medium-length bodies (~1.5–2 KB,
  // 60–150 descendants) over compact cards on SPA dashboards.
  // Phase 1: truly cheap prepass over EVERY div/section candidate. Per
  // element we only do constant- or text-bounded work (tagName, closest,
  // children.length, textContent.length). No descendant walking, no DOM
  // scoring. This guarantees the real body container is observed even on
  // SPAs where it sits past 1000+ chrome wrappers in DOM order.
  //
  // We then shortlist candidates via the UNION of two cheap axes so that
  // bodies which lose one axis still survive on the other:
  //   - children.length: paragraph-rich bodies with many direct children win
  //   - textContent.length: text-rich bodies wrapped in a single inner
  //     container (children=1) or pure text-only bodies still win
  const candidates = document.querySelectorAll('div, section');
  const DENSITY_TEXT_BUDGET = 10_000;
  const ESTIMATED_TAG_OVERHEAD = 30;
  // Saturate size bonus at 3K chars (vs the original 1K). With textLen capped
  // at DENSITY_TEXT_BUDGET this prevents pure text-only cards (ratio ≈ 1.0)
  // from outranking long bodies whose ratio is naturally lower.
  const SIZE_SATURATION = 3000;
  // Phase 2 inner shortlist size per axis. Larger than the original 5 so
  // realistic SPAs (with many ties on quickDensity / textLen proxies) don't
  // drop the true body before accurate innerHTML.length re-ranking. 32
  // matches a band-style cutoff: any candidate within the top ~32 on either
  // axis gets the expensive accurate measurement.
  const SHORTLIST_PER_AXIS = 32;
  // Per-axis cap for the Phase 1 shortlist; union of two axes yields up to
  // 2x candidates entering Phase 2. Realistic pages stay far below this.
  const PHASE1_PER_AXIS = 100;
  // Hard upper bound for cap-saturated candidates (text-axis saturation
  // alone gives no ordering signal among them). Beyond this we tie-break
  // by depth, keeping the deepest first so the actual body wins ties.
  // 300 is far above any realistic page's substantive container count
  // while still bounding the worst-case Phase 2 work.
  const PHASE1_SATURATED_HARD_CAP = 300;
  // Bound for the cheap Phase 1 text sampler: walked through the same
  // noise-filtered TreeWalker as the later tiers, so SSR hydration JSON in
  // <script> tags can't inflate quickTextLen and squeeze the real body out
  // of the byText shortlist. 2000 is enough to differentiate substantive
  // bodies from minimal cards while keeping per-candidate work bounded.
  const PHASE1_TEXT_CAP = 2000;

  // Cheap DOM depth (parent-chain length). When many candidates saturate
  // PHASE1_TEXT_CAP, deeper candidates are body-favoring tie-breakers because
  // the actual content container tends to sit deeper than its ancestor
  // wrappers in the DOM.
  const depthOf = (e: Element): number => {
    let depth = 0;
    let p: Element | null = e.parentElement;
    while (p) {
      depth++;
      p = p.parentElement;
    }
    return depth;
  };

  type Survivor = {
    el: HTMLElement;
    childrenCount: number;
    quickTextLen: number;
    depth: number;
  };
  const survivors: Survivor[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i] as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'nav' || tag === 'header' || tag === 'footer' || tag === 'aside') continue;
    if (el.closest('nav, header, footer, aside')) continue;
    survivors.push({
      el,
      childrenCount: el.children.length,
      quickTextLen: streamTextUntilMax(el, PHASE1_TEXT_CAP).length,
      depth: depthOf(el),
    });
  }
  // Union of two cheap rankings.
  //   byChildren: tie-break by depth so ancestor-wrapper ties favor deeper
  //     (more specific) bodies.
  //   byText: cap-saturated candidates ALL pass through (text alone gives no
  //     ordering signal among them, so don't truncate by DOM order). Below
  //     the cap, take top-N by quickTextLen with depth tie-break.
  // Deduping later via the phase2Map keeps total candidates bounded by
  // unique elements rather than per-axis count.
  const byChildren = [...survivors]
    .sort((a, b) => {
      if (b.childrenCount !== a.childrenCount) return b.childrenCount - a.childrenCount;
      return b.depth - a.depth;
    })
    .slice(0, PHASE1_PER_AXIS);
  // Cap-saturated candidates carry no text-ordering signal, so sort them
  // by depth (deeper = more body-favoring) and bound to PHASE1_SATURATED_HARD_CAP.
  const saturatedSorted = survivors
    .filter((s) => s.quickTextLen >= PHASE1_TEXT_CAP)
    .sort((a, b) => b.depth - a.depth)
    .slice(0, PHASE1_SATURATED_HARD_CAP);
  const unsaturatedTop = survivors
    .filter((s) => s.quickTextLen < PHASE1_TEXT_CAP)
    .sort((a, b) => {
      if (b.quickTextLen !== a.quickTextLen) return b.quickTextLen - a.quickTextLen;
      return b.depth - a.depth;
    })
    .slice(0, PHASE1_PER_AXIS);
  const byText: Survivor[] = [...saturatedSorted, ...unsaturatedTop];
  const phase2Map = new Map<HTMLElement, Survivor>();
  for (const s of byChildren) phase2Map.set(s.el, s);
  for (const s of byText) phase2Map.set(s.el, s);
  const phase2 = Array.from(phase2Map.values());

  // Phase 2: only on the shortlisted candidates do we incur per-element
  // streamTextUntilMax + descendantCount + the later innerHTML measurement.
  type Cand = {
    el: HTMLElement;
    textLen: number;
    descendantCount: number;
    quickDensity: number;
  };
  const allCandidates: Cand[] = [];
  for (let i = 0; i < phase2.length; i++) {
    const el = phase2[i].el;

    const text = streamTextUntilMax(el, DENSITY_TEXT_BUDGET);
    const textLen = text.length;
    if (textLen < 200) continue;

    const descendantCount = el.getElementsByTagName('*').length;
    const estimatedMarkup = textLen + descendantCount * ESTIMATED_TAG_OVERHEAD;
    const quickDensity =
      (textLen / estimatedMarkup) * Math.min(textLen / SIZE_SATURATION, 1);
    allCandidates.push({ el, textLen, descendantCount, quickDensity });
  }

  // Build shortlist: union of top-K by quickDensity and top-K by textLen.
  // Tie-break textLen by quickDensity so that on pages with deeply nested
  // wrappers (each ancestor mirroring its descendant's text), the tighter
  // (deeper, fewer-descendants) wrapper survives the shortlist instead of
  // being filled by outer ancestors in DOM order.
  // Using a Map keyed on the element ref dedupes overlapping picks.
  const byDensity = [...allCandidates]
    .sort((a, b) => b.quickDensity - a.quickDensity)
    .slice(0, SHORTLIST_PER_AXIS);
  const byTextLen = [...allCandidates]
    .sort((a, b) => {
      if (b.textLen !== a.textLen) return b.textLen - a.textLen;
      return b.quickDensity - a.quickDensity;
    })
    .slice(0, SHORTLIST_PER_AXIS);
  const shortlistMap = new Map<HTMLElement, Cand>();
  for (const c of byDensity) shortlistMap.set(c.el, c);
  for (const c of byTextLen) shortlistMap.set(c.el, c);
  const shortlist = Array.from(shortlistMap.values());

  // Stage 2: accurate re-ranking on shortlist. Compute noise-free markup
  // length (innerHTML minus outerHTML of script/style/noscript/template
  // descendants) so the ratio is symmetric with the noise-filtered textLen.
  // For pathologically huge subtrees (>MAX_SUBTREE_ELEMENTS) we fall back to
  // quickDensity to avoid allocating multi-megabyte HTML strings.
  let bestEl: HTMLElement | null = null;
  let bestScore = 0;
  // For huge subtrees full innerHTML serialization could allocate megabytes,
  // so we sample the first SAMPLE_SIZE descendants and compute their average
  // tag overhead (open + close tag chars including attributes) to extrapolate
  // estimated markup length. This avoids both the over-scoring of a fixed
  // ratio floor and the cost of full serialization, while remaining fair to
  // text-rich legitimate bodies that happen to have many descendants.
  const SAMPLE_SIZE = 100;

  for (const cand of shortlist) {
    let score: number;
    if (cand.descendantCount > MAX_SUBTREE_ELEMENTS) {
      const walker = document.createTreeWalker(cand.el, NodeFilter.SHOW_ELEMENT);
      let sampledOverhead = 0;
      let sampledCount = 0;
      let elNode: Node | null;
      while ((elNode = walker.nextNode()) !== null && sampledCount < SAMPLE_SIZE) {
        const e = elNode as HTMLElement;
        const t = e.tagName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT' || t === 'TEMPLATE') {
          continue;
        }
        const tagNameLen = t.length;
        let openLen = tagNameLen + 2; // <tag>
        for (let a = 0; a < e.attributes.length; a++) {
          const attr = e.attributes[a];
          openLen += 1 + attr.name.length + 3 + attr.value.length; // ' name="value"'
        }
        const closeLen = tagNameLen + 3; // </tag>
        sampledOverhead += openLen + closeLen;
        sampledCount++;
      }
      const avgOverhead =
        sampledCount > 0 ? sampledOverhead / sampledCount : ESTIMATED_TAG_OVERHEAD;
      const estimatedMarkup = cand.textLen + cand.descendantCount * avgOverhead;
      score =
        (cand.textLen / Math.max(estimatedMarkup, 1)) *
        Math.min(cand.textLen / SIZE_SATURATION, 1);
    } else {
      const rawHtmlLen = cand.el.innerHTML.length;
      if (rawHtmlLen === 0) continue;
      let noiseLen = 0;
      const noise = cand.el.querySelectorAll(NOISE_TAG_SELECTOR);
      for (let j = 0; j < noise.length; j++) {
        noiseLen += (noise[j] as HTMLElement).outerHTML.length;
      }
      const cleanHtmlLen = Math.max(rawHtmlLen - noiseLen, 1);
      score =
        (cand.textLen / cleanHtmlLen) * Math.min(cand.textLen / SIZE_SATURATION, 1);
    }
    if (score > bestScore) {
      bestScore = score;
      bestEl = cand.el;
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
