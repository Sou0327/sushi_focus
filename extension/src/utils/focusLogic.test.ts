import { describe, it, expect } from 'vitest';
import { isHostOnDistractionDomain } from './focusLogic';

describe('isHostOnDistractionDomain', () => {
  const distractionDomains = [
    'youtube.com',
    'twitter.com',
    'x.com',
    'netflix.com',
    'reddit.com',
  ];

  it('完全一致するドメインを検出する', () => {
    expect(isHostOnDistractionDomain('youtube.com', distractionDomains)).toBe(
      true
    );
    expect(isHostOnDistractionDomain('twitter.com', distractionDomains)).toBe(
      true
    );
    expect(isHostOnDistractionDomain('x.com', distractionDomains)).toBe(true);
    expect(isHostOnDistractionDomain('netflix.com', distractionDomains)).toBe(
      true
    );
  });

  it('サブドメインを検出する', () => {
    expect(
      isHostOnDistractionDomain('www.youtube.com', distractionDomains)
    ).toBe(true);
    expect(
      isHostOnDistractionDomain('m.youtube.com', distractionDomains)
    ).toBe(true);
    expect(
      isHostOnDistractionDomain('music.youtube.com', distractionDomains)
    ).toBe(true);
    expect(
      isHostOnDistractionDomain('mobile.twitter.com', distractionDomains)
    ).toBe(true);
    expect(
      isHostOnDistractionDomain('old.reddit.com', distractionDomains)
    ).toBe(true);
  });

  it('リストにないドメインを許可する', () => {
    expect(isHostOnDistractionDomain('google.com', distractionDomains)).toBe(
      false
    );
    expect(isHostOnDistractionDomain('github.com', distractionDomains)).toBe(
      false
    );
    expect(
      isHostOnDistractionDomain('stackoverflow.com', distractionDomains)
    ).toBe(false);
    expect(isHostOnDistractionDomain('localhost', distractionDomains)).toBe(
      false
    );
    expect(
      isHostOnDistractionDomain('127.0.0.1', distractionDomains)
    ).toBe(false);
  });

  it('大文字小文字を区別しない', () => {
    expect(isHostOnDistractionDomain('YOUTUBE.COM', distractionDomains)).toBe(
      true
    );
    expect(isHostOnDistractionDomain('YouTube.com', distractionDomains)).toBe(
      true
    );
    expect(isHostOnDistractionDomain('WWW.YOUTUBE.COM', distractionDomains)).toBe(
      true
    );
    expect(
      isHostOnDistractionDomain('Youtube.Com', ['YOUTUBE.COM'])
    ).toBe(true);
  });

  it('部分一致を拒否する（ドメイン境界を尊重）', () => {
    // "youtube.com" が "notyoutube.com" にマッチしないことを確認
    expect(
      isHostOnDistractionDomain('notyoutube.com', distractionDomains)
    ).toBe(false);
    expect(
      isHostOnDistractionDomain('fakeyoutube.com', distractionDomains)
    ).toBe(false);
    expect(
      isHostOnDistractionDomain('youtube.com.evil.com', distractionDomains)
    ).toBe(false);
  });

  it('空のドメインリストに対して false を返す', () => {
    expect(isHostOnDistractionDomain('youtube.com', [])).toBe(false);
    expect(isHostOnDistractionDomain('any.domain.com', [])).toBe(false);
  });
});
