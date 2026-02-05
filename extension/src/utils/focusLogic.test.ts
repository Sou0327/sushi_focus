import { describe, it, expect } from 'vitest';
import { isHostOnDistractionDomain, shouldTriggerFocus } from './focusLogic';

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

describe('shouldTriggerFocus', () => {
  const COOLDOWN_MS = 45000; // 45 seconds
  const BASE_TIME = 1000000;

  describe('distraction サイトでの動作', () => {
    it('distraction サイトでは常にフォーカスする', () => {
      const result = shouldTriggerFocus(
        true, // isOnDistraction
        false, // alwaysFocusOnDone
        BASE_TIME - 1000, // lastDoneFocusTime (1秒前)
        COOLDOWN_MS,
        BASE_TIME
      );
      expect(result.shouldFocus).toBe(true);
      expect(result.reason).toBe('distraction');
    });

    it('distraction サイトではクールダウン中でもフォーカスする', () => {
      const result = shouldTriggerFocus(
        true, // isOnDistraction
        false, // alwaysFocusOnDone
        BASE_TIME - 10000, // lastDoneFocusTime (10秒前、クールダウン中)
        COOLDOWN_MS,
        BASE_TIME
      );
      expect(result.shouldFocus).toBe(true);
      expect(result.reason).toBe('distraction');
    });
  });

  describe('alwaysFocusOnDone が有効な場合', () => {
    it('常にフォーカスする', () => {
      const result = shouldTriggerFocus(
        false, // isOnDistraction
        true, // alwaysFocusOnDone
        BASE_TIME - 1000, // lastDoneFocusTime (1秒前)
        COOLDOWN_MS,
        BASE_TIME
      );
      expect(result.shouldFocus).toBe(true);
      expect(result.reason).toBe('always_focus');
    });

    it('クールダウン中でもフォーカスする', () => {
      const result = shouldTriggerFocus(
        false, // isOnDistraction
        true, // alwaysFocusOnDone
        BASE_TIME - 10000, // lastDoneFocusTime (10秒前、クールダウン中)
        COOLDOWN_MS,
        BASE_TIME
      );
      expect(result.shouldFocus).toBe(true);
      expect(result.reason).toBe('always_focus');
    });
  });

  describe('クールダウン動作', () => {
    it('クールダウン期間内はフォーカスしない', () => {
      const result = shouldTriggerFocus(
        false, // isOnDistraction
        false, // alwaysFocusOnDone
        BASE_TIME - 10000, // lastDoneFocusTime (10秒前、クールダウン中)
        COOLDOWN_MS,
        BASE_TIME
      );
      expect(result.shouldFocus).toBe(false);
      expect(result.reason).toBe('in_cooldown');
    });

    it('クールダウン期間終了後はフォーカスする', () => {
      const result = shouldTriggerFocus(
        false, // isOnDistraction
        false, // alwaysFocusOnDone
        BASE_TIME - 50000, // lastDoneFocusTime (50秒前、クールダウン終了)
        COOLDOWN_MS,
        BASE_TIME
      );
      expect(result.shouldFocus).toBe(true);
      expect(result.reason).toBe('cooldown_expired');
    });

    it('lastDoneFocusTime が 0 の場合フォーカスする（初回）', () => {
      const result = shouldTriggerFocus(
        false, // isOnDistraction
        false, // alwaysFocusOnDone
        0, // lastDoneFocusTime (初回)
        COOLDOWN_MS,
        BASE_TIME
      );
      expect(result.shouldFocus).toBe(true);
      expect(result.reason).toBe('cooldown_expired');
    });

    it('クールダウン境界値: ちょうど期間内', () => {
      const result = shouldTriggerFocus(
        false,
        false,
        BASE_TIME - COOLDOWN_MS + 1, // 1ms 期間内
        COOLDOWN_MS,
        BASE_TIME
      );
      expect(result.shouldFocus).toBe(false);
      expect(result.reason).toBe('in_cooldown');
    });

    it('クールダウン境界値: ちょうど期間終了', () => {
      const result = shouldTriggerFocus(
        false,
        false,
        BASE_TIME - COOLDOWN_MS, // ちょうど期間終了
        COOLDOWN_MS,
        BASE_TIME
      );
      expect(result.shouldFocus).toBe(true);
      expect(result.reason).toBe('cooldown_expired');
    });
  });

  describe('優先順位', () => {
    it('distraction は alwaysFocusOnDone より優先される', () => {
      const result = shouldTriggerFocus(
        true, // isOnDistraction
        true, // alwaysFocusOnDone
        BASE_TIME - 10000,
        COOLDOWN_MS,
        BASE_TIME
      );
      // 両方 true の場合、distraction が reason として返される
      expect(result.shouldFocus).toBe(true);
      expect(result.reason).toBe('distraction');
    });
  });
});
