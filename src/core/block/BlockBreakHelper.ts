/**
 * BlockBreakHelper - Handles block breaking operations
 */

import { Vec3 } from 'vec3';
import type { BlockPos } from '../../types';
import type { BreakingState } from './types';

/**
 * BlockBreakHelper manages block breaking with proper tool selection and timing
 */
export class BlockBreakHelper {
    private bot: any;
    private state: BreakingState = {
        target: null,
        started: false,
        ticksSinceStart: 0,
        toolEquipped: false
    };
    private breaking: boolean = false;

    constructor(bot: any) {
        this.bot = bot;
    }

    /**
     * Start breaking a block
     */
    async startBreaking(pos: BlockPos, getBestTool: (block: any) => any): Promise<boolean> {
        const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
        if (!block || block.name === 'air') {
            return true; // Already broken
        }

        this.state.target = pos;
        this.state.started = false;
        this.state.ticksSinceStart = 0;
        this.state.toolEquipped = false;

        // Equip best tool
        const tool = getBestTool(block);
        if (tool) {
            try {
                await this.bot.equip(tool, 'hand');
                this.state.toolEquipped = true;
            } catch (e) {
                // Continue without optimal tool
            }
        } else {
            this.state.toolEquipped = true;
        }

        return false;
    }

    /**
     * Tick the block breaking process
     * Returns true when breaking is complete
     */
    async tick(): Promise<boolean> {
        if (!this.state.target) return true;

        const pos = this.state.target;
        const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));

        // Block already broken
        if (!block || block.name === 'air') {
            this.state.target = null;
            this.breaking = false;
            return true;
        }

        // Start breaking if not started
        if (!this.state.started && this.state.toolEquipped) {
            // Look at block
            const blockCenter = new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
            await this.bot.lookAt(blockCenter);

            // Start digging
            try {
                this.breaking = true;
                await this.bot.dig(block, true); // forceLook = true
                this.breaking = false;
                this.state.target = null;
                return true;
            } catch (e) {
                this.breaking = false;
                this.state.target = null;
                return true; // Consider it done on error
            }
        }

        this.state.ticksSinceStart++;
        return false;
    }

    /**
     * Check if currently breaking
     */
    isBreaking(): boolean {
        return this.breaking;
    }

    /**
     * Cancel current breaking operation
     */
    cancel(): void {
        if (this.breaking) {
            try {
                this.bot.stopDigging();
            } catch (e) {
                // Ignore errors
            }
        }
        this.breaking = false;
        this.state.target = null;
    }
}
