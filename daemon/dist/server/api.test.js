import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
// Note: We need to import app after mocking environment to avoid server start
// For now, we'll create a separate test app configuration
describe('GET /health', () => {
    // Import app dynamically to avoid server startup during test
    let app;
    beforeAll(async () => {
        // Import the app - this will also start the server
        // In a real setup, we'd refactor to separate app creation from server startup
        const module = await import('./index.js');
        app = module.app;
    });
    it('200 と branch 情報を返す', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('version');
        expect(res.body).toHaveProperty('gitBranch');
    });
});
describe('POST /agent/start', () => {
    let app;
    beforeAll(async () => {
        const module = await import('./index.js');
        app = module.app;
    });
    it('有効なリクエストで 200 を返す', async () => {
        const res = await request(app)
            .post('/agent/start')
            .send({
            prompt: 'Test prompt for task',
            taskId: 'test-task-1',
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('taskId');
    });
    it('prompt 欠落で 400 を返す', async () => {
        const res = await request(app)
            .post('/agent/start')
            .send({
            taskId: 'test-task-2',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toContain('prompt');
    });
    it('空の prompt で 400 を返す', async () => {
        const res = await request(app)
            .post('/agent/start')
            .send({
            prompt: '',
            taskId: 'test-task-3',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('prompt');
    });
});
describe('POST /agent/done', () => {
    let app;
    beforeAll(async () => {
        const module = await import('./index.js');
        app = module.app;
    });
    it('有効なリクエストで 200 を返す', async () => {
        const res = await request(app)
            .post('/agent/done')
            .send({
            taskId: 'test-task-done-1',
            summary: 'Task completed successfully',
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
    });
    it('taskId 欠落で 400 を返す', async () => {
        const res = await request(app)
            .post('/agent/done')
            .send({
            summary: 'Task completed',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('taskId');
    });
    it('空の taskId で 400 を返す', async () => {
        const res = await request(app)
            .post('/agent/done')
            .send({
            taskId: '',
            summary: 'Task completed',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('taskId');
    });
});
describe('POST /agent/log', () => {
    let app;
    beforeAll(async () => {
        const module = await import('./index.js');
        app = module.app;
    });
    it('有効なリクエストで 200 を返す', async () => {
        const res = await request(app)
            .post('/agent/log')
            .send({
            taskId: 'test-task-log-1',
            message: 'Test log message',
            level: 'info',
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
    });
    it('message 欠落で 400 を返す', async () => {
        const res = await request(app)
            .post('/agent/log')
            .send({
            taskId: 'test-task-log-2',
            level: 'info',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('message');
    });
    it('不正な level で 400 を返す', async () => {
        const res = await request(app)
            .post('/agent/log')
            .send({
            taskId: 'test-task-log-3',
            message: 'Test message',
            level: 'invalid-level',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('level');
    });
    it('success レベルで 200 を返す', async () => {
        const res = await request(app)
            .post('/agent/log')
            .send({
            taskId: 'test-task-log-success',
            message: '🎉 タスク完了！',
            level: 'success',
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
    });
    it('focus レベルで 200 を返す', async () => {
        const res = await request(app)
            .post('/agent/log')
            .send({
            taskId: 'test-task-log-focus',
            message: '🍣 IDE にフォーカスを戻しています...',
            level: 'focus',
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
    });
    it('command レベルで 200 を返す', async () => {
        const res = await request(app)
            .post('/agent/log')
            .send({
            taskId: 'test-task-log-command',
            message: '$ pnpm build',
            level: 'command',
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
    });
});
describe('/focus/settings', () => {
    let app;
    beforeAll(async () => {
        const module = await import('./index.js');
        app = module.app;
    });
    beforeEach(async () => {
        // Reset to defaults before each test
        await request(app)
            .post('/focus/settings')
            .send({ enabled: true, focusOnDone: true });
    });
    it('GET でデフォルト設定を返す', async () => {
        const res = await request(app).get('/focus/settings');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('enabled', true);
        expect(res.body).toHaveProperty('focusOnDone', true);
    });
    it('POST で focusOnDone を更新できる', async () => {
        const res = await request(app)
            .post('/focus/settings')
            .send({ focusOnDone: false });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body.settings).toHaveProperty('focusOnDone', false);
        // GET で反映を確認
        const getRes = await request(app).get('/focus/settings');
        expect(getRes.body).toHaveProperty('focusOnDone', false);
    });
    it('POST で不正な focusOnDone 型は 400 を返す', async () => {
        const res = await request(app)
            .post('/focus/settings')
            .send({ focusOnDone: 'invalid' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('focusOnDone');
    });
    it('認証ヘッダーなしでもアクセスできる（SECRET 未設定時）', async () => {
        const getRes = await request(app).get('/focus/settings');
        expect(getRes.status).toBe(200);
        const postRes = await request(app)
            .post('/focus/settings')
            .send({ focusOnDone: false });
        expect(postRes.status).toBe(200);
    });
});
describe('POST /context', () => {
    let app;
    beforeAll(async () => {
        const module = await import('./index.js');
        app = module.app;
    });
    it('有効なリクエストで 200 を返す', async () => {
        const res = await request(app)
            .post('/context')
            .send({
            url: 'https://example.com',
            title: 'Example Page',
            content: 'Page content here',
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
    });
    it('url 欠落で 400 を返す', async () => {
        const res = await request(app)
            .post('/context')
            .send({
            content: 'Some content',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('url');
    });
    it('content 欠落で 400 を返す', async () => {
        const res = await request(app)
            .post('/context')
            .send({
            url: 'https://example.com',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('content');
    });
    it('content が MAX_CONTEXT_CONTENT_LENGTH 超で 400 を返す', async () => {
        const res = await request(app)
            .post('/context')
            .send({
            url: 'https://example.com',
            content: 'x'.repeat(10001),
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('content');
    });
    it('javascript: スキームの URL で 400 を返す', async () => {
        const res = await request(app)
            .post('/context')
            .send({
            url: 'javascript:alert(1)',
            content: 'XSS attempt',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
    });
    it('不正なフォーマットの URL で 400 を返す', async () => {
        const res = await request(app)
            .post('/context')
            .send({
            url: 'not-a-url',
            content: 'Invalid URL',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
    });
    it('キュー上限超過時に古いものが削除される', async () => {
        // Drain first
        await request(app).get('/context');
        // Post 12 contexts (limit is 10)
        for (let i = 0; i < 12; i++) {
            await request(app)
                .post('/context')
                .send({
                url: `https://example.com/page-${i}`,
                content: `Content ${i}`,
            });
        }
        const res = await request(app).get('/context');
        expect(res.body.contexts).toHaveLength(10);
        // Oldest 2 should be evicted, so first should be page-2
        expect(res.body.contexts[0].url).toBe('https://example.com/page-2');
        expect(res.body.contexts[9].url).toBe('https://example.com/page-11');
    });
    it('strategy 付きリクエストで 200 を返す', async () => {
        const res = await request(app)
            .post('/context')
            .send({
            url: 'https://example.com/semantic',
            title: 'Semantic Page',
            content: 'Main article content',
            strategy: 'semantic',
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
    });
    it('strategy なしで 200 を返す（後方互換）', async () => {
        const res = await request(app)
            .post('/context')
            .send({
            url: 'https://example.com/no-strategy',
            content: 'Content without strategy',
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
    });
    it('不正な strategy で 400 を返す', async () => {
        const res = await request(app)
            .post('/context')
            .send({
            url: 'https://example.com/bad-strategy',
            content: 'Content',
            strategy: 'invalid',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('strategy');
    });
});
describe('GET /context', () => {
    let app;
    beforeAll(async () => {
        const module = await import('./index.js');
        app = module.app;
    });
    it('空キューで { contexts: [] } を返す', async () => {
        // First drain any existing contexts
        await request(app).get('/context');
        const res = await request(app).get('/context');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ contexts: [] });
    });
    it('POST 後に GET で取得できる', async () => {
        // Drain first
        await request(app).get('/context');
        await request(app)
            .post('/context')
            .send({
            url: 'https://example.com/test',
            title: 'Test Page',
            content: 'Test content',
            selectedText: 'selected',
        });
        const res = await request(app).get('/context');
        expect(res.status).toBe(200);
        expect(res.body.contexts).toHaveLength(1);
        expect(res.body.contexts[0]).toMatchObject({
            url: 'https://example.com/test',
            title: 'Test Page',
            content: 'Test content',
            selectedText: 'selected',
        });
        expect(res.body.contexts[0]).toHaveProperty('timestamp');
    });
    it('GET /context で strategy が保持される', async () => {
        // Drain first
        await request(app).get('/context');
        await request(app)
            .post('/context')
            .send({
            url: 'https://example.com/strategy-test',
            title: 'Strategy Test',
            content: 'Content with strategy',
            strategy: 'density',
        });
        const res = await request(app).get('/context');
        expect(res.status).toBe(200);
        expect(res.body.contexts).toHaveLength(1);
        expect(res.body.contexts[0]).toHaveProperty('strategy', 'density');
    });
    it('GET /context で strategy なしの場合 strategy フィールドが存在しない', async () => {
        // Drain first
        await request(app).get('/context');
        await request(app)
            .post('/context')
            .send({
            url: 'https://example.com/no-strat',
            content: 'Content without strategy field',
        });
        const res = await request(app).get('/context');
        expect(res.status).toBe(200);
        expect(res.body.contexts).toHaveLength(1);
        expect(res.body.contexts[0]).not.toHaveProperty('strategy');
    });
    it('GET 後の再 GET で空になる（消費型確認）', async () => {
        // Drain first
        await request(app).get('/context');
        await request(app)
            .post('/context')
            .send({
            url: 'https://example.com/drain',
            content: 'Drain test',
        });
        // First GET - should return the context
        const res1 = await request(app).get('/context');
        expect(res1.body.contexts).toHaveLength(1);
        // Second GET - should be empty
        const res2 = await request(app).get('/context');
        expect(res2.body.contexts).toHaveLength(0);
    });
});
describe('/focus/settings (SUSHI_FOCUS_SECRET 有効時)', () => {
    let authedApp;
    const TEST_SECRET = 'test-secret-for-focus-settings';
    let originalSecret;
    beforeAll(async () => {
        // Save and set secret, re-import module with fresh module registry
        originalSecret = process.env.SUSHI_FOCUS_SECRET;
        process.env.SUSHI_FOCUS_SECRET = TEST_SECRET;
        vi.resetModules();
        const module = await import('./index.js');
        authedApp = module.app;
    });
    afterAll(() => {
        // Restore original env
        if (originalSecret === undefined) {
            delete process.env.SUSHI_FOCUS_SECRET;
        }
        else {
            process.env.SUSHI_FOCUS_SECRET = originalSecret;
        }
    });
    beforeEach(async () => {
        // Reset via authed request
        await request(authedApp)
            .post('/focus/settings')
            .set('Authorization', `Bearer ${TEST_SECRET}`)
            .send({ enabled: true, focusOnDone: true });
    });
    it('GET は認証なしでアクセスできる', async () => {
        const res = await request(authedApp).get('/focus/settings');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('enabled');
    });
    it('POST は認証なしで 401 を返す', async () => {
        const res = await request(authedApp)
            .post('/focus/settings')
            .send({ focusOnDone: false });
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('ok', false);
    });
    it('POST は正しいトークンで 200 を返す', async () => {
        const res = await request(authedApp)
            .post('/focus/settings')
            .set('Authorization', `Bearer ${TEST_SECRET}`)
            .send({ focusOnDone: false });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body.settings).toHaveProperty('focusOnDone', false);
    });
    it('POST は不正なトークンで 401 を返す', async () => {
        const res = await request(authedApp)
            .post('/focus/settings')
            .set('Authorization', 'Bearer wrong-token')
            .send({ focusOnDone: false });
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('ok', false);
    });
});
describe('POST /context (SUSHI_FOCUS_SECRET 有効時の Bearer 認証)', () => {
    let authedApp;
    const TEST_SECRET = 'test-secret-for-context-auth';
    let originalSecret;
    beforeAll(async () => {
        originalSecret = process.env.SUSHI_FOCUS_SECRET;
        process.env.SUSHI_FOCUS_SECRET = TEST_SECRET;
        vi.resetModules();
        const module = await import('./index.js');
        authedApp = module.app;
    });
    afterAll(() => {
        if (originalSecret === undefined) {
            delete process.env.SUSHI_FOCUS_SECRET;
        }
        else {
            process.env.SUSHI_FOCUS_SECRET = originalSecret;
        }
    });
    it('認証なしで 401 を返す', async () => {
        const res = await request(authedApp)
            .post('/context')
            .send({
            url: 'https://example.com/no-auth',
            content: 'Injected content',
        });
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('Authorization');
    });
    it('Bearer プレフィックスなしで 401 を返す', async () => {
        const res = await request(authedApp)
            .post('/context')
            .set('Authorization', TEST_SECRET)
            .send({
            url: 'https://example.com/no-bearer',
            content: 'Missing Bearer prefix',
        });
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('Bearer');
    });
    it('正しいトークンで 200 を返す', async () => {
        // Drain any existing contexts first
        await request(authedApp)
            .get('/context')
            .set('Authorization', `Bearer ${TEST_SECRET}`);
        const res = await request(authedApp)
            .post('/context')
            .set('Authorization', `Bearer ${TEST_SECRET}`)
            .send({
            url: 'https://example.com/authed',
            content: 'Authenticated content',
            strategy: 'semantic',
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('ok', true);
        // Verify the context was actually stored
        const getRes = await request(authedApp)
            .get('/context')
            .set('Authorization', `Bearer ${TEST_SECRET}`);
        expect(getRes.body.contexts).toHaveLength(1);
        expect(getRes.body.contexts[0].url).toBe('https://example.com/authed');
        expect(getRes.body.contexts[0].strategy).toBe('semantic');
    });
    it('不正なトークンで 401 を返す', async () => {
        const res = await request(authedApp)
            .post('/context')
            .set('Authorization', 'Bearer wrong-token')
            .send({
            url: 'https://example.com/bad-token',
            content: 'Bad token content',
        });
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('ok', false);
        expect(res.body.error).toContain('Invalid');
    });
});
//# sourceMappingURL=api.test.js.map