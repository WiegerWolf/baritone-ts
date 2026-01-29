/**
 * Process manager handles process lifecycle and priority
 */

import type { Bot } from 'mineflayer';
import { ProcessState } from './ProcessState';
import type { ProcessTickResult } from './ProcessTickResult';
import type { IProcess } from './IProcess';

/**
 * Process manager handles process lifecycle and priority
 */
export class ProcessManager {
    private bot: Bot;
    private pathfinder: any;
    private processes: Map<string, IProcess> = new Map();
    private activeProcess: IProcess | null = null;

    constructor(bot: Bot, pathfinder: any) {
        this.bot = bot;
        this.pathfinder = pathfinder;
    }

    /**
     * Register a process
     */
    register(name: string, process: IProcess): void {
        this.processes.set(name, process);
    }

    /**
     * Unregister a process
     */
    unregister(name: string): void {
        const process = this.processes.get(name);
        if (process === this.activeProcess) {
            this.deactivate();
        }
        this.processes.delete(name);
    }

    /**
     * Activate a process by name
     */
    activate(name: string): boolean {
        const process = this.processes.get(name);
        if (!process) return false;

        // Check if current process has higher priority
        if (this.activeProcess && this.activeProcess.priority > process.priority) {
            return false;
        }

        // Deactivate current process
        if (this.activeProcess) {
            this.activeProcess.onDeactivate();
        }

        // Activate new process
        this.activeProcess = process;
        process.onActivate();
        return true;
    }

    /**
     * Deactivate current process
     */
    deactivate(): void {
        if (this.activeProcess) {
            this.activeProcess.onDeactivate();
            this.activeProcess = null;
        }
    }

    /**
     * Get the currently active process
     */
    getActive(): IProcess | null {
        return this.activeProcess;
    }

    /**
     * Get a process by name
     */
    get(name: string): IProcess | undefined {
        return this.processes.get(name);
    }

    /**
     * Check if a process is active
     */
    isActive(name: string): boolean {
        const process = this.processes.get(name);
        return process !== undefined && process === this.activeProcess;
    }

    /**
     * Tick the active process
     */
    tick(): ProcessTickResult | null {
        if (!this.activeProcess) {
            return null;
        }

        // Check if process is paused
        if (this.activeProcess.state === ProcessState.PAUSED) {
            return { continuePathing: false, keepActive: true, status: 'Paused' };
        }

        // Tick the process
        const result = this.activeProcess.tick();

        // Handle process completion
        if (!result.keepActive || this.activeProcess.isComplete() || this.activeProcess.hasFailed()) {
            this.activeProcess.onDeactivate();
            this.activeProcess = null;
        }

        return result;
    }

    /**
     * Cancel all processes
     */
    cancelAll(): void {
        if (this.activeProcess) {
            this.activeProcess.cancel();
            this.activeProcess = null;
        }
    }

    /**
     * Get all registered process names
     */
    getRegisteredNames(): string[] {
        return Array.from(this.processes.keys());
    }
}
