import { describe, it, expect } from 'vitest';
import { verifyWsClient } from './wsAuth.js';
describe('verifyWsClient', () => {
    const AUTH_SECRET = 'test-secret-123';
    describe('認証なしモード (AUTH_SECRET = undefined)', () => {
        it('全ての接続を許可する', () => {
            expect(verifyWsClient({}, undefined)).toBe(true);
            expect(verifyWsClient({ url: '/ws', host: 'localhost' }, undefined)).toBe(true);
        });
    });
    describe('Chrome拡張からの接続', () => {
        it('chrome-extension:// オリジンを許可する', () => {
            const info = {
                origin: 'chrome-extension://abcdefghijklmnop',
                url: '/ws',
                host: 'localhost:41593',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
        });
        it('任意の拡張IDを許可する', () => {
            const info = {
                origin: 'chrome-extension://xyz123',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
        });
    });
    describe('外部接続（Claude Code フック等）', () => {
        it('URLパラメータの token で認証を通す', () => {
            const info = {
                url: '/ws?token=test-secret-123',
                host: 'localhost:41593',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(true);
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
        it('URLなしを拒否する', () => {
            const info = {
                host: 'localhost:41593',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
        });
        it('hostなしを拒否する', () => {
            const info = {
                url: '/ws?token=test-secret-123',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
        });
    });
    describe('不正なURL', () => {
        it('パース不可能なURLを拒否する', () => {
            const info = {
                url: ':::invalid-url',
                host: 'localhost:41593',
            };
            expect(verifyWsClient(info, AUTH_SECRET)).toBe(false);
        });
    });
});
//# sourceMappingURL=wsAuth.test.js.map