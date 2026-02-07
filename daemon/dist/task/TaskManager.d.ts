import type { Task, DaemonEvent } from '../types/index.js';
type BroadcastFn = (event: DaemonEvent) => void;
export declare class TaskManager {
    private currentTask;
    private broadcast;
    private pendingInputResolve;
    private cancelledTaskIds;
    constructor(broadcast: BroadcastFn);
    getCurrentTask(): Task | null;
    createTask(repoId: string, prompt: string): string | null;
    cancelTask(taskId: string): boolean;
    cancelExternalTask(taskId: string): boolean;
    submitChoice(taskId: string, choiceId: string): boolean;
    private updateStatus;
    private log;
    private waitForInput;
    private isCancelled;
    private runDemoTask;
    /**
     * Delay utility - exposed for testing with fake timers.
     * @internal
     */
    protected delay(ms: number): Promise<void>;
}
export {};
//# sourceMappingURL=TaskManager.d.ts.map