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
        // Prevent concurrent task execution (both running and waiting_input states)
        if (this.currentTask && (this.currentTask.status === 'running' || this.currentTask.status === 'waiting_input')) {
            console.log(`[TaskManager] Task already active (status: ${this.currentTask.status}), rejecting`);
            return null;
        }
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
            prompt,
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
            messageKey: 'daemon.log.taskCancelled',
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
            messageKey: 'daemon.log.taskCancelled',
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
    log(taskId, level, message, messageKey, messageParams) {
        const logEntry = { level, message, ts: Date.now(), messageKey, messageParams };
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
            ...(messageKey && { messageKey }),
            ...(messageParams && { messageParams }),
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
            this.log(taskId, 'info', `Starting task: "${prompt}"`, 'daemon.log.startingTask', { prompt });
            await this.delay(500);
            if (this.isCancelled(taskId))
                return;
            this.log(taskId, 'info', 'Analyzing codebase...', 'daemon.log.analyzing');
            await this.delay(1000);
            if (this.isCancelled(taskId))
                return;
            this.log(taskId, 'info', 'Found 3 files to modify', 'daemon.log.foundFiles', { count: 3 });
            await this.delay(800);
            if (this.isCancelled(taskId))
                return;
            this.log(taskId, 'info', 'Generating changes...', 'daemon.log.generating');
            await this.delay(1500);
            if (this.isCancelled(taskId))
                return;
            // Simulate need_input
            this.log(taskId, 'info', 'Changes ready for review', 'daemon.log.changesReady');
            const choice = await this.waitForInput(taskId, 'Apply the following changes?', [
                { id: 'apply', label: 'Apply Changes' },
                { id: 'skip', label: 'Skip' },
                { id: 'modify', label: 'Modify & Retry' },
            ]);
            if (this.isCancelled(taskId) || choice === '__cancelled__')
                return;
            this.updateStatus('running');
            if (choice === 'apply') {
                this.log(taskId, 'info', 'Applying changes...', 'daemon.log.applying');
                await this.delay(1000);
                if (this.isCancelled(taskId))
                    return;
                this.log(taskId, 'info', 'Changes applied successfully', 'daemon.log.applied');
            }
            else if (choice === 'skip') {
                this.log(taskId, 'info', 'Changes skipped', 'daemon.log.skipped');
            }
            else {
                this.log(taskId, 'info', 'Regenerating with modifications...', 'daemon.log.regenerating');
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
    /**
     * Delay utility - exposed for testing with fake timers.
     * @internal
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=TaskManager.js.map