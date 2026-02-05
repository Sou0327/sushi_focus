import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from './TaskManager.js';
/**
 * テスト用の TaskManager 拡張クラス
 * プライベートな状態を操作できるメソッドを追加
 */
class TestableTaskManager extends TaskManager {
    /**
     * テスト用: タスクの状態を直接設定
     */
    setTaskStatus(status) {
        const task = this.getCurrentTask();
        if (task) {
            task.status = status;
            task.updatedAt = Date.now();
        }
    }
    /**
     * テスト用: タスクをクリア
     */
    clearTask() {
        // getCurrentTask() で取得できるように internal 状態をリセット
        // createTask で null チェックされるので、done 状態にして新規作成可能にする
        this.setTaskStatus('done');
    }
}
describe('TaskManager', () => {
    let taskManager;
    let broadcastedEvents;
    beforeEach(() => {
        broadcastedEvents = [];
        taskManager = new TestableTaskManager((event) => {
            broadcastedEvents.push(event);
        });
    });
    describe('createTask', () => {
        it('新規タスクを作成できる', () => {
            const taskId = taskManager.createTask('repo1', 'Test prompt');
            expect(taskId).not.toBeNull();
            expect(taskId).toMatch(/^t_/);
            const task = taskManager.getCurrentTask();
            expect(task).not.toBeNull();
            expect(task?.status).toBe('running');
            expect(task?.prompt).toBe('Test prompt');
        });
        it('task.started イベントをブロードキャストする', () => {
            taskManager.createTask('repo1', 'Test prompt');
            const startEvent = broadcastedEvents.find((e) => e.type === 'task.started');
            expect(startEvent).toBeDefined();
            expect(startEvent?.type).toBe('task.started');
            if (startEvent?.type === 'task.started') {
                expect(startEvent.prompt).toBe('Test prompt');
                expect(startEvent.repoId).toBe('repo1');
            }
        });
        it('running 状態のタスクがある場合は null を返す', () => {
            const taskId1 = taskManager.createTask('repo1', 'First task');
            expect(taskId1).not.toBeNull();
            const taskId2 = taskManager.createTask('repo1', 'Second task');
            expect(taskId2).toBeNull();
            // 最初のタスクがまだアクティブ
            const task = taskManager.getCurrentTask();
            expect(task?.prompt).toBe('First task');
        });
        it('waiting_input 状態のタスクがある場合は null を返す', () => {
            // タスクを作成
            const taskId = taskManager.createTask('repo1', 'First task');
            expect(taskId).not.toBeNull();
            // 状態を waiting_input に変更
            taskManager.setTaskStatus('waiting_input');
            // 新しいタスクの作成を試みる
            const taskId2 = taskManager.createTask('repo1', 'Second task');
            expect(taskId2).toBeNull();
            // 最初のタスクがまだアクティブ
            const currentTask = taskManager.getCurrentTask();
            expect(currentTask?.prompt).toBe('First task');
            expect(currentTask?.status).toBe('waiting_input');
        });
        it('done 状態のタスクがある場合は新規タスクを作成できる', () => {
            const taskId1 = taskManager.createTask('repo1', 'First task');
            expect(taskId1).not.toBeNull();
            // タスクを完了状態に
            taskManager.setTaskStatus('done');
            // 新しいタスクを作成できる
            const taskId2 = taskManager.createTask('repo1', 'Second task');
            expect(taskId2).not.toBeNull();
        });
        it('error 状態のタスクがある場合は新規タスクを作成できる', () => {
            const taskId1 = taskManager.createTask('repo1', 'First task');
            expect(taskId1).not.toBeNull();
            // タスクをエラー状態に
            taskManager.setTaskStatus('error');
            // 新しいタスクを作成できる
            const taskId2 = taskManager.createTask('repo1', 'Second task');
            expect(taskId2).not.toBeNull();
        });
    });
    describe('cancelTask', () => {
        it('アクティブなタスクをキャンセルできる', () => {
            const taskId = taskManager.createTask('repo1', 'Test task');
            expect(taskId).not.toBeNull();
            const result = taskManager.cancelTask(taskId);
            expect(result).toBe(true);
            // タスクが消える
            expect(taskManager.getCurrentTask()).toBeNull();
        });
        it('存在しないタスクのキャンセルは false を返す', () => {
            const result = taskManager.cancelTask('nonexistent');
            expect(result).toBe(false);
        });
        it('キャンセル後に task.error イベントをブロードキャストする', () => {
            const taskId = taskManager.createTask('repo1', 'Test task');
            taskManager.cancelTask(taskId);
            const errorEvent = broadcastedEvents.find((e) => e.type === 'task.error');
            expect(errorEvent).toBeDefined();
            if (errorEvent?.type === 'task.error') {
                expect(errorEvent.message).toContain('cancelled');
            }
        });
        it('waiting_input 状態のタスクもキャンセルできる', () => {
            const taskId = taskManager.createTask('repo1', 'Test task');
            expect(taskId).not.toBeNull();
            // waiting_input 状態に
            taskManager.setTaskStatus('waiting_input');
            const result = taskManager.cancelTask(taskId);
            expect(result).toBe(true);
            expect(taskManager.getCurrentTask()).toBeNull();
        });
    });
    describe('submitChoice', () => {
        it('running 状態では false を返す', () => {
            const taskId = taskManager.createTask('repo1', 'Test task');
            expect(taskId).not.toBeNull();
            // running 状態では false
            const result = taskManager.submitChoice(taskId, 'choice1');
            expect(result).toBe(false);
        });
        it('異なるタスクIDでは false を返す', () => {
            const taskId = taskManager.createTask('repo1', 'Test task');
            expect(taskId).not.toBeNull();
            const result = taskManager.submitChoice('wrong-id', 'choice1');
            expect(result).toBe(false);
        });
        it('タスクがない場合は false を返す', () => {
            const result = taskManager.submitChoice('any-id', 'choice1');
            expect(result).toBe(false);
        });
    });
    describe('concurrent task rejection (409 scenario)', () => {
        it('running タスク中に新規作成すると拒否される', () => {
            // 最初のタスク作成
            const taskId1 = taskManager.createTask('repo1', 'Task 1');
            expect(taskId1).not.toBeNull();
            expect(taskManager.getCurrentTask()?.status).toBe('running');
            // 2つ目のタスク作成を試みる → 拒否
            const taskId2 = taskManager.createTask('repo1', 'Task 2');
            expect(taskId2).toBeNull();
            // 元のタスクは影響を受けない
            expect(taskManager.getCurrentTask()?.id).toBe(taskId1);
        });
        it('waiting_input タスク中に新規作成すると拒否される', () => {
            // 最初のタスク作成
            const taskId1 = taskManager.createTask('repo1', 'Task 1');
            expect(taskId1).not.toBeNull();
            // waiting_input 状態に遷移
            taskManager.setTaskStatus('waiting_input');
            expect(taskManager.getCurrentTask()?.status).toBe('waiting_input');
            // 2つ目のタスク作成を試みる → 拒否
            const taskId2 = taskManager.createTask('repo1', 'Task 2');
            expect(taskId2).toBeNull();
            // 元のタスクは影響を受けない
            expect(taskManager.getCurrentTask()?.id).toBe(taskId1);
            expect(taskManager.getCurrentTask()?.status).toBe('waiting_input');
        });
    });
});
//# sourceMappingURL=TaskManager.test.js.map