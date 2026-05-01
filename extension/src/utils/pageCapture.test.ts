/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import { extractContentInPage } from './pageCapture';

// happy-dom resolves <a href> against this URL so relative URLs become absolute.
const BASE = 'https://host.example/docs/page.html';

interface HappyDOMWindow {
  happyDOM?: { setURL?: (url: string) => void };
}

function setPage(html: string): void {
  (window as unknown as HappyDOMWindow).happyDOM?.setURL?.(BASE);
  document.body.innerHTML = html;
  window.getSelection()?.removeAllRanges();
}

// Semantic tier requires ≥200 chars of inner text; this repeated filler
// comfortably crosses that threshold when placed around a short anchor.
const FILLER = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(5);

describe('extractContentInPage', () => {
  beforeEach(() => {
    setPage('');
  });

  it('http(s) アンカーの直後に (absolute-url) を挿入する (semantic tier)', () => {
    setPage(`<main>${FILLER}<a href="https://example.com/foo">click here</a>${FILLER}</main>`);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('semantic');
    expect(result.content).toContain('click here');
    expect(result.content).toContain('(https://example.com/foo)');
  });

  it('相対 URL を document URL を基準に絶対化する', () => {
    setPage(`<main>${FILLER}<a href="/issues/9228">issue #9228</a>${FILLER}</main>`);

    const result = extractContentInPage(10000);

    expect(result.content).toContain('issue #9228');
    expect(result.content).toContain('(https://host.example/issues/9228)');
    expect(result.content).not.toContain('(/issues/9228)');
  });

  it('javascript: スキームは URL を付加せずテキストのみ残す', () => {
    setPage(
      `<main>${FILLER}<a href="javascript:alert(1)">run me</a>${FILLER}</main>`,
    );

    const result = extractContentInPage(10000);

    expect(result.content).toContain('run me');
    expect(result.content).not.toContain('javascript:');
    expect(result.content).not.toContain('alert(1)');
  });

  it('data: / blob: / mailto: スキームも同様に除外する', () => {
    setPage(
      `<main>${FILLER}` +
        `<a href="data:text/plain,hello">data link</a>` +
        `<a href="blob:https://host/abcd">blob link</a>` +
        `<a href="mailto:a@b.c">mail link</a>` +
        `${FILLER}</main>`,
    );

    const result = extractContentInPage(10000);

    expect(result.content).toContain('data link');
    expect(result.content).toContain('blob link');
    expect(result.content).toContain('mail link');
    expect(result.content).not.toContain('(data:');
    expect(result.content).not.toContain('(blob:');
    expect(result.content).not.toContain('(mailto:');
  });

  it('表示テキストが空のアンカー (icon-only) はスキップする', () => {
    setPage(
      `<main>${FILLER}<a href="https://example.com/icon"><span aria-hidden="true"></span></a>${FILLER}</main>`,
    );

    const result = extractContentInPage(10000);

    expect(result.content).not.toContain('(https://example.com/icon)');
  });

  it('テキストが URL と同一のアンカーは URL を重複付加しない', () => {
    setPage(
      `<main>${FILLER}<a href="https://example.com/ref">https://example.com/ref</a>${FILLER}</main>`,
    );

    const result = extractContentInPage(10000);

    const matches = result.content.match(/https:\/\/example\.com\/ref/g) || [];
    expect(matches.length).toBe(1);
  });

  it('リンクを含まない content は変化しない (regression)', () => {
    setPage(`<main>${FILLER}no links here${FILLER}</main>`);

    const result = extractContentInPage(10000);

    expect(result.content).toContain('no links here');
    expect(result.content).not.toContain('(http');
  });

  it('tier 4 (body fallback) でもリンクを保持する', () => {
    setPage(`<a href="/nav/next">next</a>`);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('fallback');
    expect(result.content).toContain('next');
    expect(result.content).toContain('(https://host.example/nav/next)');
  });

  it('maxLen 制限を enhance 後も遵守する', () => {
    setPage(`<main>${FILLER}<a href="https://example.com/x">link</a>${FILLER}</main>`);

    const result = extractContentInPage(50);

    expect(result.content.length).toBeLessThanOrEqual(50);
  });

  it('同一ページ内 fragment-only link はスキップする (ToC, back to top)', () => {
    setPage(`<main>${FILLER}<a href="#section-1">jump to section</a>${FILLER}</main>`);

    const result = extractContentInPage(10000);

    expect(result.content).toContain('jump to section');
    // fragment-only の絶対 URL (document URL + #section-1) は付与されない
    expect(result.content).not.toContain('#section-1)');
    expect(result.content).not.toMatch(/\(https?:\/\/[^)]*#section-1\)/);
  });

  it('<pre>/<code> 内のアンカーは URL を付加しない (コード破壊防止)', () => {
    setPage(
      `<main>${FILLER}` +
        `<pre><a href="https://example.com/api">fetch()</a></pre>` +
        `<code><a href="https://example.com/cmd">ls -la</a></code>` +
        `${FILLER}</main>`,
    );

    const result = extractContentInPage(10000);

    expect(result.content).toContain('fetch()');
    expect(result.content).toContain('ls -la');
    expect(result.content).not.toContain('(https://example.com/api)');
    expect(result.content).not.toContain('(https://example.com/cmd)');
  });

  it('入れ子アンカー (a 内の a) は内側を無視し、外側のみ注釈する', () => {
    // HTML パーサは nested <a> を自動分離するため、SVG/foreign content で
    // 起こる真の入れ子を DOM API で明示構築する
    setPage(`<main>${FILLER}<div id="host"></div>${FILLER}</main>`);
    const host = document.getElementById('host');
    if (!host) throw new Error('host not found');
    const outer = document.createElement('a');
    outer.href = 'https://outer.example/o';
    outer.textContent = 'outer ';
    const inner = document.createElement('a');
    inner.href = 'https://inner.example/i';
    inner.textContent = 'inner';
    outer.appendChild(inner);
    host.appendChild(outer);

    const result = extractContentInPage(10000);

    expect(result.content).not.toContain('(https://inner.example/i)');
    expect(result.content).toContain('(https://outer.example/o)');
  });

  it('同一 path + 異なる query は fragment-only とみなさず URL を付加する', () => {
    // BASE の pathname は /docs/page.html, search は ''。
    // 遷移先は同じ path だが query が異なる → 別ページ扱いで URL 注釈必須
    setPage(`<main>${FILLER}<a href="?tab=next#section">next tab</a>${FILLER}</main>`);

    const result = extractContentInPage(10000);

    expect(result.content).toContain('next tab');
    expect(result.content).toMatch(/\(https:\/\/host\.example\/docs\/page\.html\?tab=next#section\)/);
  });

  it('anchor のテキストノード内部のみを選択した場合、祖先 a の URL を末尾に付加する', () => {
    setPage(
      `<main>${FILLER}<a id="inner-a" href="https://target.example/deep">meaningful target text that is long enough for tier 1 (>50 chars)</a>${FILLER}</main>`,
    );
    const anchor = document.getElementById('inner-a');
    if (!anchor || !anchor.firstChild) throw new Error('anchor setup failed');
    const range = document.createRange();
    // selection は anchor の text node のみを覆う (anchor 自体は range の外)
    range.selectNodeContents(anchor.firstChild);
    const sel = window.getSelection();
    if (!sel) throw new Error('no selection API');
    sel.removeAllRanges();
    sel.addRange(range);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('selection');
    expect(result.content).toContain('meaningful target text');
    expect(result.content).toContain('(https://target.example/deep)');
  });

  it('tier 4 で subtree 要素数が MAX_SUBTREE_ELEMENTS を超える場合、streaming で maxLen まで抽出し enhance はスキップする', () => {
    const head = '<a href="/nav/big">big-link</a>';
    let elements = '';
    for (let i = 0; i < 10_100; i++) elements += '<span>x</span>';
    setPage(head + elements);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('fallback');
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content).not.toContain('(https://host.example/nav/big)');
  });

  it('tier 2 semantic で巨大 <main> の場合も streaming に切り替わり enhance をスキップする', () => {
    let bigMain = '';
    for (let i = 0; i < 10_100; i++) bigMain += '<span>semantic payload </span>';
    bigMain += '<a href="https://example.com/semantic-link">semantic link</a>';
    setPage(`<main>${bigMain}</main>`);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('semantic');
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content).not.toContain('(https://example.com/semantic-link)');
  });

  it('selection が <code> 内 anchor のテキストのみの場合、ancestor 補完は code 保護ルールで URL を付加しない', () => {
    setPage(
      `<main>${FILLER}<code><a id="code-a" href="https://example.com/api">a long enough description for tier 1 threshold including fetch() call</a></code>${FILLER}</main>`,
    );
    const a = document.getElementById('code-a');
    if (!a?.firstChild) throw new Error('anchor setup failed');
    const range = document.createRange();
    range.selectNodeContents(a.firstChild);
    const sel = window.getSelection();
    if (!sel) throw new Error('no selection API');
    sel.removeAllRanges();
    sel.addRange(range);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('selection');
    expect(result.content).toContain('fetch() call');
    // code 内 anchor なので URL 付加されない (enhanceLinks と一貫)
    expect(result.content).not.toContain('(https://example.com/api)');
  });

  it('<script type="application/json"> の中身 (SSR hydration JSON) は content から除外する', () => {
    const hydrationJson =
      '{"payload":{"preloaded_records":{},"noise_marker_xyz":"SHOULD_NOT_APPEAR"}}';
    setPage(
      `<main>` +
        `<script type="application/json">${hydrationJson}</script>` +
        `${FILLER}<a href="https://example.com/real">real content link</a>${FILLER}` +
        `</main>`,
    );

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('semantic');
    expect(result.content).toContain('real content link');
    expect(result.content).toContain('(https://example.com/real)');
    expect(result.content).not.toContain('noise_marker_xyz');
    expect(result.content).not.toContain('SHOULD_NOT_APPEAR');
    expect(result.content).not.toContain('preloaded_records');
  });

  it('<style> の CSS と <template> の中身は content から除外する', () => {
    setPage(
      `<main>` +
        `<style>.secret-css-marker { color: red; }</style>` +
        `<template><div>HIDDEN_TEMPLATE_MARKER</div></template>` +
        `${FILLER}visible body text${FILLER}` +
        `</main>`,
    );

    const result = extractContentInPage(10000);

    expect(result.content).toContain('visible body text');
    expect(result.content).not.toContain('secret-css-marker');
    expect(result.content).not.toContain('HIDDEN_TEMPLATE_MARKER');
  });

  it('clone が空になる tier 4 でも、fallback streaming が noise tag を除外する', () => {
    // Body に script + 空 span のみ。clone で script 除去後は実質空 →
    // readText(clone) が空文字になり streaming fallback へ。streaming も
    // noise filter を通るので JSON 本文は絶対に混入してはいけない。
    setPage(
      `<script type="application/json">{"fallback_noise_marker":"MUST_NOT_LEAK"}</script><span>  </span>`,
    );

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('fallback');
    expect(result.content).not.toContain('fallback_noise_marker');
    expect(result.content).not.toContain('MUST_NOT_LEAK');
  });

  it('streaming path (tier 4 巨大 DOM) でも script の中身は除外する', () => {
    const noise = '{"hydration_noise_marker_abc":"LEAK"}';
    const head = `<script type="application/json">${noise}</script>`;
    let elements = '';
    for (let i = 0; i < 10_100; i++) elements += '<span>visible </span>';
    setPage(head + elements);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('fallback');
    expect(result.content).toContain('visible');
    expect(result.content).not.toContain('hydration_noise_marker_abc');
    expect(result.content).not.toContain('LEAK');
  });

  it('selection 範囲に <script> が含まれても content に noise が混入しない', () => {
    // selection に script tag を含む range を構築
    setPage(
      `<main><div id="sel-host">long enough visible text to exceed the 50 char tier 1 threshold here<script type="application/json">{"sel_noise_marker":"MUST_NOT_LEAK"}</script>trailing visible text</div></main>`,
    );
    const host = document.getElementById('sel-host');
    if (!host) throw new Error('host not found');
    const range = document.createRange();
    range.selectNodeContents(host);
    const sel = window.getSelection();
    if (!sel) throw new Error('no selection');
    sel.removeAllRanges();
    sel.addRange(range);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('selection');
    expect(result.content).toContain('long enough visible text');
    expect(result.content).toContain('trailing visible text');
    expect(result.content).not.toContain('sel_noise_marker');
    expect(result.content).not.toContain('MUST_NOT_LEAK');
    // selectedText 側も noise-free
    expect(result.selectedText).not.toContain('sel_noise_marker');
    expect(result.selectedText).not.toContain('MUST_NOT_LEAK');
  });

  it('3 連続以上の改行は 2 に圧縮される (paragraph break は温存)', () => {
    setPage(
      `<main>` +
        `${FILLER}` +
        `<div>section A</div>` +
        `<div></div><div></div><div></div><div></div><div></div>` +
        `<div>section B</div>` +
        `${FILLER}</main>`,
    );

    const result = extractContentInPage(10000);

    // 3 連続以上の \n は出現しない
    expect(result.content).not.toMatch(/\n{3,}/);
    // paragraph break 1 つ分 (\n\n) は温存される
    expect(result.content).toMatch(/section A[\s\S]*section B/);
  });

  it('行末の半角スペース/タブは除去される', () => {
    // 各行の末尾 (改行直前) の連続 space/tab を強制的に作る
    setPage(
      `<main>${FILLER}<pre>first line   \nsecond line\t\t\nthird line</pre>${FILLER}</main>`,
    );

    const result = extractContentInPage(10000);

    // どの行末にも連続 space / tab が残っていない (改行直前の whitespace 除去)
    expect(result.content).not.toMatch(/ {2,}\n/);
    expect(result.content).not.toMatch(/\t+\n/);
    // pre 内の本体 text は温存
    expect(result.content).toContain('first line');
    expect(result.content).toContain('second line');
    expect(result.content).toContain('third line');
  });

  it('全体の先頭・末尾 whitespace は trim される', () => {
    setPage(
      `<main>   \n\n\n${FILLER}trimmed body${FILLER}\n\n\n   </main>`,
    );

    const result = extractContentInPage(10000);

    expect(result.content).toBe(result.content.trimStart());
    expect(result.content).toBe(result.content.trimEnd());
  });

  it('圧縮後も maxLen を遵守する', () => {
    // 大量 blank line + 本文混在。圧縮 × slice で maxLen 以下
    let html = '';
    for (let i = 0; i < 100; i++) html += `<div>${FILLER}</div><div></div><div></div><div></div>`;
    setPage(`<main>${html}</main>`);

    const result = extractContentInPage(200);

    expect(result.content.length).toBeLessThanOrEqual(200);
  });

  it('density tier: 段落ベースの長文 body を inline-heavy な短い card より優先する (regression)', () => {
    // 現実の SPA (Immunefi 等) で起きるパターン:
    // - 短い header card: 子孫要素が少なく inline-heavy (タイトル + meta)
    // - 長い body: 子孫要素が多く paragraph-heavy (記事本文)
    // density formula は body を選ぶべき (text-to-markup ratio は近いが size bonus で本文勝利)
    const headerCardText =
      'Firedancer aborts during switch_check when the switch slot lacks a voter. Submitted 6 days ago by @whitehat for Audit Comp. ';
    const headerCard = `<div class="header-card">${headerCardText}</div>`;

    let bodyContent = '<div class="body-content">';
    for (let i = 0; i < 60; i++) {
      bodyContent += `<p>Paragraph ${i}: substantial issue body text describing the bug behavior, reproduction steps, and impact analysis. Multiple sentences per paragraph add up. </p>`;
    }
    bodyContent += '</div>';

    setPage(headerCard + bodyContent);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    // body 段落のテキストが拾われていること (header card だけではない)
    expect(result.content).toContain('Paragraph 30');
    // 適度に大きい (header card 単独より長い)
    expect(result.content.length).toBeGreaterThan(1000);
  });

  it('density tier: 700-char text-only card vs 250+ 子孫の長文 body でも body が勝つ (codex edge case)', () => {
    // codex 指摘の境界: 700 char で子孫 0 のカード (ratio=1.0) は元の formula で
    // sizeBonus 0.7 となり、ratio 0.5-0.7 の長文 body に勝ちかねない。
    // SIZE_SATURATION=3000 で抑え、長文 body が確実に勝つよう設計。
    const cardText = 'Brief summary of the report. '.repeat(24); // ≈ 696 chars
    const card = `<div class="card">${cardText}</div>`;

    let body = '<div class="body">';
    for (let i = 0; i < 70; i++) {
      // 70 paragraphs ≈ 7-9K chars text + 70+ descendants
      body += `<p>Paragraph ${i}: detailed analysis with multiple sentences explaining the technical details and context. </p>`;
    }
    // さらに細かい inline タグを足して descendant を 250+ に
    for (let i = 0; i < 200; i++) {
      body += `<span class="ref">[${i}]</span>`;
    }
    body += '</div>';

    setPage(card + body);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    // body が選ばれている (Paragraph 文字列が含まれる)
    expect(result.content).toContain('Paragraph');
    expect(result.content.length).toBeGreaterThan(1000);
  });

  it('density tier: 9 段ネストされた wrapper の deepest (innermost) wrapper が選ばれる', () => {
    // 各 wrap-N に固有の marker text を入れて、どの wrapper が選ばれたか判別する。
    // wrap-0 が最も内側 (paragraphs に直接接する)、wrap-8 が最外。
    let nested = (() => {
      let s = '';
      for (let i = 0; i < 80; i++) {
        s += `<p>Para ${i}: substantial body paragraph text content here. </p>`;
      }
      return s;
    })();
    for (let level = 0; level < 9; level++) {
      // 各 wrapper レベルに WRAP_LEVEL_N marker を inner content の前に挿入
      nested = `<div class="wrap-${level}"><span>WRAP_LEVEL_${level} </span>${nested}</div>`;
    }
    let cards = '';
    for (let i = 0; i < 6; i++) {
      cards += `<div class="card-${i}">${'compact card text. '.repeat(35)}</div>`;
    }
    setPage(cards + nested);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    expect(result.content).toContain('Para ');
    // 最内 wrap-0 のみが選ばれた場合 WRAP_LEVEL_0 のみ存在する。
    // 中間 wrap-N (1..8) が選ばれていれば対応する marker が出るので、
    // 全ての outer marker (1..8) を否定して innermost wrap-0 を保証する。
    expect(result.content).toContain('WRAP_LEVEL_0');
    for (let outer = 1; outer <= 8; outer++) {
      expect(result.content).not.toContain(`WRAP_LEVEL_${outer}`);
    }
  });

  it('density tier: 巨大 outer wrapper の中の小さな body が wrapper より優先される', () => {
    const cardText = 'compact card. '.repeat(50);
    const card = `<div class="card">${cardText}</div>`;

    // 内側 body (Stage 2 accurate path): 60 paragraphs + BODY_MARKER
    let innerBody = '<div class="real-body"><span>BODY_MARKER </span>';
    for (let i = 0; i < 60; i++) {
      innerBody += `<p>Body ${i}: clean article paragraph text content here.</p>`;
    }
    innerBody += '</div>';

    // 巨大 outer wrapper: OUTER_CHROME_MARKER + 内側 body + 10100 chrome spans
    let chrome = '';
    for (let j = 0; j < 10_100; j++) chrome += '<span class="ch">x</span>';
    const outerWrapper = `<div class="outer"><span>OUTER_CHROME_MARKER </span>${innerBody}${chrome}</div>`;

    setPage(card + outerWrapper);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    // 内側 body が選ばれていれば BODY_MARKER のみ。outer wrapper が選ばれていれば
    // OUTER_CHROME_MARKER も先頭に含まれる。
    expect(result.content).toContain('BODY_MARKER');
    expect(result.content).not.toContain('OUTER_CHROME_MARKER');
  });

  it('density tier: 101+ same-depth saturated wrappers + 同じ depth の body でも body が Phase 2 へ進む (saturated 全保持)', () => {
    // codex 指摘: depth/childrenCount/quickTextLen が全て同じ場合 DOM 順依存で
    // 排除されかねない。saturated 全保持でこの edge を排除する。
    let satWrappers = '';
    for (let i = 0; i < 110; i++) {
      // 各 wrapper visible text 2500 chars (cap saturate)、children=1
      satWrappers += `<div class="sat-${i}"><span>${'saturating wrapper text content. '.repeat(80)}</span></div>`;
    }
    // body も同じ depth (top-level sibling)、cap saturate、children=1
    let body = '<div class="real-body"><span>SAME_DEPTH_BODY_MARKER ';
    for (let i = 0; i < 80; i++) body += 'real body paragraph text content here. ';
    body += '</span></div>';
    setPage(satWrappers + body);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    // saturated 全保持なので body も Phase 2 へ。Phase 2 accurate measure で
    // ratio に基づき選ばれる。少なくとも候補から落ちないことを保証。
    expect(result.content).toContain('SAME_DEPTH_BODY_MARKER');
  });

  it('density tier: 101+ wrappers が PHASE1_TEXT_CAP を saturate しても deeper body が tie-break で残る', () => {
    // codex 指摘: saturate された候補が 101 個並ぶと byText 上位 100 が DOM 順で
    // 埋まり deeper body が排除される。depth tie-break で deepest body が残る。
    let satWrappers = '';
    for (let i = 0; i < 110; i++) {
      // 各 wrapper は visible text 2500 chars (2000 cap saturate)。children=1。
      satWrappers += `<div class="sat-${i}"><span>${'saturating wrapper text content. '.repeat(80)}</span></div>`;
    }
    // body はネストして depth を稼ぐ + 同じく cap saturate
    let body = '<div class="real-body"><span>DEEP_BODY_MARKER </span>';
    for (let i = 0; i < 80; i++) body += 'real body paragraph text content here. ';
    body += '</div>';
    const deeplyNested = `<div class="lvl1"><div class="lvl2"><div class="lvl3"><div class="lvl4"><div class="lvl5">${body}</div></div></div></div></div>`;
    setPage(satWrappers + deeplyNested);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    expect(result.content).toContain('DEEP_BODY_MARKER');
  });

  it('density tier: <script> JSON で textContent を膨らませた wrappers でも real body が byText axis で勝つ', () => {
    // codex 指摘: 旧 textContent.length 実装だと script 内の hydration JSON が
    // wrapper の quickTextLen に算入されて real body を排除する。
    // streamTextUntilMax は noise-filter 済みなので script 内 JSON は除外される。
    let scriptedWrappers = '';
    for (let i = 0; i < 150; i++) {
      // 各 wrapper は children=1 (script 1 つ)、visible text はゼロだが
      // script に大きな JSON を抱える
      scriptedWrappers += `<div class="js-wrap-${i}"><script type="application/json">{"hydration":"${'x'.repeat(3000)}"}</script></div>`;
    }
    // body: children=1 (inner div), 実 visible text ~2K
    let inner = '<div class="inner"><span>JSON_NOISE_BODY_MARKER </span>';
    for (let i = 0; i < 60; i++) inner += `body paragraph text content here. `;
    inner += '</div>';
    const body = `<div class="real-body">${inner}</div>`;
    setPage(scriptedWrappers + body);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    // body が選ばれている (script JSON は noise filter で quickTextLen に入らない)
    expect(result.content).toContain('JSON_NOISE_BODY_MARKER');
    // hydration JSON は混入しない
    expect(result.content).not.toContain('hydration');
  });

  it('density tier: 200+ high-children wrappers の中でも text-rich low-children body が選ばれる', () => {
    // codex 指摘: children.length 単独 truncation は inner div でラップされた
    // text-rich body (children=1) を排除しうる。
    // 200 wrappers × 5 children (低 textContent) で children rank を埋め、
    // body は children=1 だが textContent が大きい → byText axis で救出。
    let chrome = '';
    for (let i = 0; i < 200; i++) {
      // 各 chrome は 5 direct children だが各 span は 1 char しかない
      chrome += `<div class="chrome-${i}"><span>a</span><span>b</span><span>c</span><span>d</span><span>e</span></div>`;
    }
    // body: 直接の子は 1 つ (inner div) だけ、textContent は ~3K chars
    let inner = '<div class="inner"><span>FEW_CHILDREN_BODY_MARKER </span>';
    for (let i = 0; i < 80; i++) {
      inner += `long body paragraph text content here. `;
    }
    inner += '</div>';
    const body = `<div class="real-body">${inner}</div>`;
    setPage(chrome + body);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    expect(result.content).toContain('FEW_CHILDREN_BODY_MARKER');
    expect(result.content).toContain('long body paragraph');
  });

  it('density tier: 1001+ qualifying containers が body の前にあっても body が選ばれる (no DOM-order cap)', () => {
    // codex 指摘: 任意の DOM-order cap (100/1000) を撤廃し、cheap prepass で
    // 全候補を見て children.length 上位を Phase 2 へ送る設計を担保するテスト。
    // 1100 個の text-only filler (children=0) を body (children=61) の前に配置。
    let preFiller = '';
    for (let i = 0; i < 1100; i++) {
      // 各 filler は 200 chars 超だが direct children は 0 (text-only div)
      preFiller += `<div class="filler-${i}">${'short filler text content '.repeat(10)}</div>`;
    }
    let body = '<div class="real-body"><span>POST_FILLER_BODY_MARKER </span>';
    for (let i = 0; i < 60; i++) {
      body += `<p>Body content ${i}: detailed paragraph text content here.</p>`;
    }
    body += '</div>';
    setPage(preFiller + body);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    // body が DOM 上 1100 番目以降でも、children.length ベースの shortlist で
    // 上位入りし Phase 2 に到達して選ばれる
    expect(result.content).toContain('POST_FILLER_BODY_MARKER');
    expect(result.content).toContain('Body content');
  });

  it('density tier: 6 個の compact card に対して 1 つの medium body も union shortlist で生き残り選ばれる', () => {
    // codex 指摘: cards が Stage 1 quickDensity で上位 K を独占すると body は排除される
    // → quickDensity 上位 + textLen 上位の union shortlist で body を救出
    let html = '';
    for (let i = 0; i < 6; i++) {
      // 各 card は 700 chars で 0 子孫
      html += `<div class="card-${i}">${'card text. '.repeat(70)}</div>`;
    }
    let body = '<div class="body">';
    for (let j = 0; j < 60; j++) {
      body += `<p>Para ${j}: brief sentence here.</p>`;
    }
    body += '</div>';
    html += body;
    setPage(html);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    // body の段落が含まれる (cards だけでない)
    expect(result.content).toContain('Para');
    expect(result.content).toMatch(/Para \d+/);
  });

  it('density tier: body 内に SSR hydration JSON があっても markup denominator から除外される', () => {
    // codex 指摘: Stage 2 の innerHTML.length は <script> 中身も数えてしまい
    // 巨大 hydration JSON がある body の markup ratio を不当に下げる
    const cardText = 'simple card content text. '.repeat(28); // ~728 chars
    const card = `<div class="card">${cardText}</div>`;

    // body 自体は 1500 chars 程度の段落だが、内部に大量の hydration JSON を含む script
    let body = '<div class="body">';
    for (let i = 0; i < 60; i++) {
      body += `<p>Section ${i}: some content here.</p>`;
    }
    // 50KB 相当の JSON を script 中に詰める
    const fakeJson = '{"data":"' + 'x'.repeat(50000) + '"}';
    body += `<script type="application/json">${fakeJson}</script>`;
    body += '</div>';

    setPage(card + body);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    // body が選ばれている (hydration JSON が markup denominator を膨らませても
    // noise-filtered measurement で正しく評価)
    expect(result.content).toContain('Section');
    expect(result.content).not.toContain(fakeJson);
  });

  it('density tier: 中サイズ body (~1500-2000 chars / 60-150 descendants) も text-only card に勝つ', () => {
    // codex 指摘の境界 — saturated 10K body だけでなく中サイズ body も
    // accurate innerHTML.length re-ranking で正しく評価されることを保証。
    // 700-char text-only card と、1500 chars / 60 desc 程度の現実的な
    // SPA bug report 本文を競わせる。
    const cardText = 'Brief summary of the report with some metadata. '.repeat(15); // ~720 chars
    const card = `<div class="card">${cardText}</div>`;

    let body = '<div class="body">';
    // 60 paragraphs × ~25 chars ≈ 1500 chars text, 60 descendants
    for (let i = 0; i < 60; i++) {
      body += `<p>Paragraph ${i}: brief sentence.</p>`;
    }
    body += '</div>';

    setPage(card + body);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    expect(result.content).toContain('Paragraph');
    // body の段落が複数個含まれること (header card だけでなく)
    expect(result.content).toMatch(/Paragraph \d+/);
  });

  it('density tier: 多数の paragraph を持つ長文 body は subtree size で skip されない', () => {
    // 200 段落の現実的な記事本文。descendantCount は多いが (>200) 段落構造が
    // 普通なので markup overhead と text のバランスが取れている。
    // 旧コードの「descendantCount > MAX_SUBTREE_ELEMENTS で skip」が
    // 戻っていないかの sanity check (本ケースでは MAX 超えてないが意図確認)。
    let body = '<div class="article-body">';
    for (let i = 0; i < 200; i++) {
      body += `<p>Section ${i}: detailed content with multiple sentences explaining a particular aspect of the topic in depth. </p>`;
    }
    body += '</div>';
    const card = `<div class="card">${'short summary card. '.repeat(20)}</div>`;
    setPage(card + body);

    const result = extractContentInPage(10000);

    expect(result.strategy).toBe('density');
    expect(result.content).toContain('Section');
    expect(result.content.length).toBeGreaterThan(1000);
  });

  it('同一 URL への複数 link は 1 回だけ注釈する (dedup)', () => {
    setPage(
      `<main>${FILLER}` +
        `<a href="https://example.com/dup">first</a> と ` +
        `<a href="https://example.com/dup">second</a> と ` +
        `<a href="https://example.com/dup">third</a>` +
        `${FILLER}</main>`,
    );

    const result = extractContentInPage(10000);

    const matches = result.content.match(/\(https:\/\/example\.com\/dup\)/g) || [];
    expect(matches.length).toBe(1);
    // 3 つの link テキストはすべて残る
    expect(result.content).toContain('first');
    expect(result.content).toContain('second');
    expect(result.content).toContain('third');
  });
});
