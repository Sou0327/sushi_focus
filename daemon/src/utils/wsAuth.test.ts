import { describe, it, expect } from 'vitest';
import { verifyWsClient, extractExtensionId, type WsClientInfo } from './wsAuth.js';

describe('extractExtensionId', () => {
  it('有効なChrome拡張IDを抽出する', () => {
    expect(extractExtensionId('chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef')).toBe('abcdefghijklmnopqrstuvwxyzabcdef');
  });

  it('大文字小文字を保持する', () => {
    expect(extractExtensionId('chrome-extension://ABCDEFghijklmnopqrstuvwxyzABCDEF')).toBe('ABCDEFghijklmnopqrstuvwxyzABCDEF');
  });

  it('無効な形式はnullを返す', () => {
    expect(extractExtensionId(undefined)).toBe(null);
    expect(extractExtensionId('')).toBe(null);
    expect(extractExtensionId('chrome-extension://')).toBe(null);
    expect(extractExtensionId('chrome-extension://abc')).toBe(null); // 32文字未満
    expect(extractExtensionId('chrome-extension://abc123')).toBe(null);
    expect(extractExtensionId('http://localhost')).toBe(null);
  });
});

describe('verifyWsClient', () => {
  const AUTH_SECRET = 'test-secret-123';
  const VALID_EXTENSION_ID = 'abcdefghijklmnopqrstuvwxyzabcdef'; // 32文字

  describe('認証なしモード (AUTH_SECRET = undefined)', () => {
    it('全ての接続を許可する', () => {
      expect(verifyWsClient({}, undefined)).toBe(true);
      expect(verifyWsClient({ url: '/ws', host: 'localhost' }, undefined)).toBe(
        true
      );
    });
  });

  describe('Chrome拡張からの接続 (ALLOWED_EXTENSION_ID なし)', () => {
    it('有効なchrome-extension:// オリジンを許可する', () => {
      const info: WsClientInfo = {
        origin: `chrome-extension://${VALID_EXTENSION_ID}`,
        url: '/ws',
        host: 'localhost:41593',
      };
      expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
    });

    it('任意の有効な拡張IDを許可する', () => {
      const info: WsClientInfo = {
        origin: 'chrome-extension://zyxwvutsrqponmlkjihgfedcbazyxwvu',
      };
      expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
    });

    it('無効な拡張ID形式は拒否する', () => {
      const info: WsClientInfo = {
        origin: 'chrome-extension://short',
        url: '/ws',
        host: 'localhost:41593',
      };
      expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
    });
  });

  describe('Chrome拡張からの接続 (ALLOWED_EXTENSION_ID あり)', () => {
    const ALLOWED_ID = 'specificextensionidabcdefghijklm'; // 32 chars

    it('許可された拡張IDは接続できる', () => {
      const info: WsClientInfo = {
        origin: `chrome-extension://${ALLOWED_ID}`,
        url: '/ws',
        host: 'localhost:41593',
      };
      expect(verifyWsClient(info, AUTH_SECRET, ALLOWED_ID)).toBe(true);
    });

    it('大文字小文字を無視してマッチする', () => {
      const info: WsClientInfo = {
        origin: `chrome-extension://${ALLOWED_ID.toUpperCase()}`,
      };
      expect(verifyWsClient(info, AUTH_SECRET, ALLOWED_ID)).toBe(true);
    });

    it('異なる拡張IDは拒否される', () => {
      const info: WsClientInfo = {
        origin: `chrome-extension://${VALID_EXTENSION_ID}`, // 違うID
        url: '/ws',
        host: 'localhost:41593',
      };
      expect(verifyWsClient(info, AUTH_SECRET, ALLOWED_ID)).toBe(false);
    });
  });

  describe('ALLOWED_EXTENSION_ID 設定済み & AUTH_SECRET 未設定', () => {
    const ALLOWED_ID = 'specificextensionidabcdefghijklm'; // 32 chars

    it('許可された拡張IDは接続できる', () => {
      const info: WsClientInfo = {
        origin: `chrome-extension://${ALLOWED_ID}`,
      };
      // AUTH_SECRET が undefined でも ALLOWED_EXTENSION_ID は有効
      expect(verifyWsClient(info, undefined, ALLOWED_ID)).toBe(true);
    });

    it('異なる拡張IDは拒否される', () => {
      const info: WsClientInfo = {
        origin: `chrome-extension://${VALID_EXTENSION_ID}`, // 違うID
      };
      // AUTH_SECRET が undefined でも ALLOWED_EXTENSION_ID による制限は有効
      expect(verifyWsClient(info, undefined, ALLOWED_ID)).toBe(false);
    });

    it('外部接続はAUTH_SECRET未設定のため許可される', () => {
      const info: WsClientInfo = {
        url: '/ws',
        host: 'localhost:41593',
      };
      // AUTH_SECRET が undefined = 開発モード、外部接続は許可
      expect(verifyWsClient(info, undefined, ALLOWED_ID)).toBe(true);
    });
  });

  describe('外部接続（Claude Code フック等）', () => {
    it('URLパラメータの token で認証を通す', () => {
      const info: WsClientInfo = {
        url: '/ws?token=test-secret-123',
        host: 'localhost:41593',
      };
      expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
    });

    it('Authorization ヘッダーで認証を通す', () => {
      const info: WsClientInfo = {
        url: '/ws',
        host: 'localhost:41593',
        authorization: 'Bearer test-secret-123',
      };
      expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
    });

    it('不正なトークンを拒否する', () => {
      const info: WsClientInfo = {
        url: '/ws?token=wrong-token',
        host: 'localhost:41593',
      };
      expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
    });

    it('トークンなしを拒否する', () => {
      const info: WsClientInfo = {
        url: '/ws',
        host: 'localhost:41593',
      };
      expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
    });

    it('URLなしを拒否する', () => {
      const info: WsClientInfo = {
        host: 'localhost:41593',
      };
      expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
    });

    it('hostなしを拒否する', () => {
      const info: WsClientInfo = {
        url: '/ws?token=test-secret-123',
      };
      expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
    });
  });

  describe('不正なURL', () => {
    it('パース不可能なURLを拒否する', () => {
      const info: WsClientInfo = {
        url: ':::invalid-url',
        host: 'localhost:41593',
      };
      expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
    });
  });
});
