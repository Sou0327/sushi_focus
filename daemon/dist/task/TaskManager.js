import { v4 as uuidv4 } from 'uuid';
export class TaskManager {
    currentTask = null;
    broadcast;
    pendingInputResolve = null;
    cancelledTaskIds = new Set();
    constructor(broadcast) {
        this.broadcast = broadcast;
    }
    getCurrentTask() {
        return this.currentTask;
    }
    createTask(repoId, prompt) {
        const taskId = `t_${uuidv4().slice(0, 8)}`;
        this.currentTask = {
            id: taskId,
            repoId,
            prompt,
            status: 'running',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            logs: [],
        };
        // Emit started event
        const startEvent = {
            type: 'task.started',
            taskId,
            repoId,
            startedAt: Date.now(),
        };
        this.broadcast(startEvent);
        // Start demo task execution
        this.runDemoTask(taskId, prompt);
        return taskId;
    }
    cancelTask(taskId) {
        if (!this.currentTask || this.currentTask.id !== taskId) {
            return false;
        }
        // Mark as cancelled so running async tasks (e.g. demo) stop
        this.cancelledTaskIds.add(taskId);
        this.updateStatus('error');
        const errorEvent = {
            type: 'task.error',
            taskId,
            message: 'Task cancelled by user',
        };
        this.broadcast(errorEvent);
        // Resolve pending input to unblock waitForInput
        if (this.pendingInputResolve) {
            this.pendingInputResolve('__cancelled__');
            this.pendingInputResolve = null;
        }
        this.currentTask = null;
        return true;
    }
    cancelExternalTask(taskId) {
        // Mark as cancelled so running async tasks (e.g. demo) stop
        this.cancelledTaskIds.add(taskId);
        const errorEvent = {
            type: 'task.error',
            taskId,
            message: 'Task cancelled by user',
        };
        this.broadcast(errorEvent);
        // Also cancel internal task if it matches
        if (this.currentTask && this.currentTask.id === taskId) {
            this.updateStatus('error');
            // Resolve pending input to unblock waitForInput
            if (this.pendingInputResolve) {
                this.pendingInputResolve('__cancelled__');
                this.pendingInputResolve = null;
            }
            this.currentTask = null;
            // Keep taskId in cancelledTaskIds — runDemoTask's finally block
            // will clean it up after the async task detects cancellation.
        }
        else {
            // Pure external task: no runDemoTask running, safe to clean up immediately.
            this.cancelledTaskIds.delete(taskId);
        }
        return true;
    }
    submitChoice(taskId, choiceId) {
        if (!this.currentTask || this.currentTask.id !== taskId) {
            return false;
        }
        if (this.currentTask.status !== 'waiting_input') {
            return false;
        }
        if (this.pendingInputResolve) {
            this.pendingInputResolve(choiceId);
            this.pendingInputResolve = null;
        }
        return true;
    }
    updateStatus(status) {
        if (this.currentTask) {
            this.currentTask.status = status;
            this.currentTask.updatedAt = Date.now();
        }
    }
    log(taskId, level, message) {
        const logEntry = { level, message, ts: Date.now() };
        if (this.currentTask && this.currentTask.id === taskId) {
            this.currentTask.logs.push(logEntry);
            // Keep only last 100 logs
            if (this.currentTask.logs.length > 100) {
                this.currentTask.logs = this.currentTask.logs.slice(-100);
            }
        }
        const logEvent = {
            type: 'task.log',
            taskId,
            level,
            message,
        };
        this.broadcast(logEvent);
    }
    async waitForInput(taskId, question, choices) {
        this.updateStatus('waiting_input');
        const inputEvent = {
            type: 'task.need_input',
            taskId,
            question,
            choices,
        };
        this.broadcast(inputEvent);
        return new Promise((resolve) => {
            this.pendingInputResolve = resolve;
        });
    }
    isCancelled(taskId) {
        return this.cancelledTaskIds.has(taskId);
    }
    async runDemoTask(taskId, prompt) {
        // Demo task simulation
        try {
            this.log(taskId, 'info', `Starting task: "${prompt}"`);
            await this.delay(500);
            if (this.isCancelled(taskId))
                return;
            this.log(taskId, 'info', 'Analyzing codebase...');
            await this.delay(1000);
            if (this.isCancelled(taskId))
                return;
            this.log(taskId, 'info', 'Found 3 files to modify');
            await this.delay(800);
            if (this.isCancelled(taskId))
                return;
            this.log(taskId, 'info', 'Generating changes...');
            await this.delay(1500);
            if (this.isCancelled(taskId))
                return;
            // Simulate need_input
            this.log(taskId, 'info', 'Changes ready for review');
            const choice = await this.waitForInput(taskId, 'Apply the following changes?', [
                { id: 'apply', label: 'Apply Changes' },
                { id: 'skip', label: 'Skip' },
                { id: 'modify', label: 'Modify & Retry' },
            ]);
            if (this.isCancelled(taskId) || choice === '__cancelled__')
                return;
            this.updateStatus('running');
            if (choice === 'apply') {
                this.log(taskId, 'info', 'Applying changes...');
                await this.delay(1000);
                if (this.isCancelled(taskId))
                    return;
                this.log(taskId, 'info', 'Changes applied successfully');
            }
            else if (choice === 'skip') {
                this.log(taskId, 'info', 'Changes skipped');
            }
            else {
                this.log(taskId, 'info', 'Regenerating with modifications...');
                await this.delay(1000);
                if (this.isCancelled(taskId))
                    return;
            }
            await this.delay(500);
            if (this.isCancelled(taskId))
                return;
            // Complete
            this.updateStatus('done');
            const doneEvent = {
                type: 'task.done',
                taskId,
                summary: `Completed: ${prompt}. Modified 3 files.`,
                meta: {
                    changedFiles: 3,
                    tests: 'not_run',
                },
            };
            this.broadcast(doneEvent);
            this.currentTask = null;
        }
        catch (error) {
            if (this.isCancelled(taskId))
                return;
            this.updateStatus('error');
            const errorEvent = {
                type: 'task.error',
                taskId,
                message: error instanceof Error ? error.message : 'Unknown error',
            };
            this.broadcast(errorEvent);
            this.currentTask = null;
        }
        finally {
            this.cancelledTaskIds.delete(taskId);
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=TaskManager.js.map