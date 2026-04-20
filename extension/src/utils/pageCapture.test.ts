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
