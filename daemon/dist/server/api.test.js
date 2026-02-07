import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
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
describe('/focus/settings (SUSHI_FOCUS_SECRET 有効時)', () => {
    let authedApp;
    const TEST_SECRET = 'test-secret-for-focus-settings';
    beforeAll(async () => {
        // Set secret and re-import module with fresh module registry
        process.env.SUSHI_FOCUS_SECRET = TEST_SECRET;
        vi.resetModules();
        const module = await import('./index.js');
        authedApp = module.app;
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
//# sourceMappingURL=api.test.js.map