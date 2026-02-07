import { describe, it, expect } from 'vitest';
import { verifyWsClient, extractExtensionId, safeCompare } from './wsAuth.js';
describe('safeCompare', () => {
    it('同じ文字列で true を返す', () => {
        expect(safeCompare('abc', 'abc')).toBe(true);
    });
    it('異なる文字列で false を返す', () => {
        expect(safeCompare('abc', 'def')).toBe(false);
    });
    it('異なる長さで false を返す', () => {
        expect(safeCompare('abc', 'abcd')).toBe(false);
    });
    it('非ASCIIでバイト長が異なる場合に例外を投げない', () => {
        // 'éé' は4バイト、'aa' は2バイト（同じ文字数だがバイト長が異なる）
        expect(() => safeCompare('éé', 'aa')).not.toThrow();
        expect(safeCompare('éé', 'aa')).toBe(false);
    });
    it('空文字同士で true を返す', () => {
        expect(safeCompare('', '')).toBe(true);
    });
});
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
            expect(verifyWsClient({ url: '/ws', host: 'localhost' }, undefined)).toBe(true);
        });
    });
    describe('Chrome拡張からの接続 (ALLOWED_EXTENSION_ID なし)', () => {
        it('有効なchrome-extension:// オリジンを許可する', () => {
            const info = {
                origin: `chrome-extension://${VALID_EXTENSION_ID}`,
                url: '/ws',
                host: 'localhost:41593',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
        });
        it('任意の有効な拡張IDを許可する', () => {
            const info = {
                origin: 'chrome-extension://zyxwvutsrqponmlkjihgfedcbazyxwvu',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
        });
        it('無効な拡張ID形式は拒否する', () => {
            const info = {
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
            const info = {
                origin: `chrome-extension://${ALLOWED_ID}`,
                url: '/ws',
                host: 'localhost:41593',
            };
            expect(verifyWsClient(info, AUTH_SECRET, ALLOWED_ID)).toBe(true);
        });
        it('大文字小文字を無視してマッチする', () => {
            const info = {
                origin: `chrome-extension://${ALLOWED_ID.toUpperCase()}`,
            };
            expect(verifyWsClient(info, AUTH_SECRET, ALLOWED_ID)).toBe(true);
        });
        it('異なる拡張IDは拒否される', () => {
            const info = {
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
            const info = {
                origin: `chrome-extension://${ALLOWED_ID}`,
            };
            // AUTH_SECRET が undefined でも ALLOWED_EXTENSION_ID は有効
            expect(verifyWsClient(info, undefined, ALLOWED_ID)).toBe(true);
        });
        it('異なる拡張IDは拒否される', () => {
            const info = {
                origin: `chrome-extension://${VALID_EXTENSION_ID}`, // 違うID
            };
            // AUTH_SECRET が undefined でも ALLOWED_EXTENSION_ID による制限は有効
            expect(verifyWsClient(info, undefined, ALLOWED_ID)).toBe(false);
        });
        it('外部接続はAUTH_SECRET未設定のため許可される', () => {
            const info = {
                url: '/ws',
                host: 'localhost:41593',
            };
            // AUTH_SECRET が undefined = 開発モード、外部接続は許可
            expect(verifyWsClient(info, undefined, ALLOWED_ID)).toBe(true);
        });
    });
    describe('外部接続（Claude Code フック等）', () => {
        it('URLパラメータの token は無視される（セキュリティ上の理由）', () => {
            const info = {
                url: '/ws?token=test-secret-123',
                host: 'localhost:41593',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
        });
        it('Authorization ヘッダーで認証を通す', () => {
            const info = {
                url: '/ws',
                host: 'localhost:41593',
                authorization: 'Bearer test-secret-123',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
        });
        it('不正なトークンを拒否する', () => {
            const info = {
                url: '/ws?token=wrong-token',
                host: 'localhost:41593',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
        });
        it('トークンなしを拒否する', () => {
            const info = {
                url: '/ws',
                host: 'localhost:41593',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
        });
        it('Authorizationヘッダーなしを拒否する', () => {
            const info = {
                host: 'localhost:41593',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
        });
        it('AuthorizationヘッダーがあればURL/hostなしでも許可する', () => {
            const info = {
                authorization: 'Bearer test-secret-123',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
        });
        it('不正なAuthorizationヘッダー形式を拒否する', () => {
            const info = {
                authorization: 'Basic test-secret-123',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
        });
        it('Bearer プレフィックスなしでもトークンが正しければ許可する', () => {
            const info = {
                authorization: 'test-secret-123',
            };
            // replace('Bearer ', '') は一致しないので元の文字列がそのままトークンとして使われる
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
        });
    });
});
//# sourceMappingURL=wsAuth.test.js.map