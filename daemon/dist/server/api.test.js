import { describe, it, expect, beforeAll } from 'vitest';
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
});
//# sourceMappingURL=api.test.js.map