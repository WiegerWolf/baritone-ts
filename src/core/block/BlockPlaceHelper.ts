/**
 * BlockPlaceHelper - Handles block placing operations
 */

import { Vec3 } from 'vec3';
import type { BlockPos } from '../../types';
import type { PlacingState } from './types';

/**
 * BlockPlaceHelper manages block placement with proper positioning
 */
export class BlockPlaceHelper {
    private bot: any;
    private state: PlacingState = {
        target: null,
        referenceBlock: null,
        faceVector: null,
        started: false,
        sneaking: false
    };

    constructor(bot: any) {
        this.bot = bot;
    }

    /**
     * Start placing a block
     * @param targetPos Where to place the block
     * @param referencePos The block to place against
     * @param faceVector Direction from reference to target
     * @param getScaffoldItem Function to get a placeable block from inventory
     */
    async startPlacing(
        targetPos: BlockPos,
        referencePos: BlockPos,
        faceVector: Vec3,
        getScaffoldItem: () => any
    ): Promise<boolean> {
        const item = getScaffoldItem();
        if (!item) {
            return false; // No blocks to place
        }

        this.state.target = targetPos;
        this.state.referenceBlock = referencePos;
        this.state.faceVector = faceVector;
        this.state.started = false;
        this.state.sneaking = false;

        // Equip block
        try {
            await this.bot.equip(item, 'hand');
        } catch (e) {
            return false;
        }

        return true;
    }

    /**
     * Tick the block placing process
     * Returns true when placing is complete
     */
    async tick(): Promise<boolean> {
        if (!this.state.target || !this.state.referenceBlock || !this.state.faceVector) {
            return true;
        }

        const refPos = this.state.referenceBlock;
        const refBlock = this.bot.blockAt(new Vec3(refPos.x, refPos.y, refPos.z));

        if (!refBlock) {
            this.state.target = null;
            return true;
        }

        // Check if block already placed
        const targetPos = this.state.target;
        const targetBlock = this.bot.blockAt(new Vec3(targetPos.x, targetPos.y, targetPos.z));
        if (targetBlock && targetBlock.name !== 'air') {
            this.stopSneaking();
            this.state.target = null;
            return true;
        }

        if (!this.state.started) {
            // Start sneaking to prevent accidental interactions
            this.bot.setControlState('sneak', true);
            this.state.sneaking = true;

            // Look at placement point
            const placePoint = new Vec3(
                refPos.x + 0.5 + this.state.faceVector.x * 0.5,
                refPos.y + 0.5 + this.state.faceVector.y * 0.5,
                refPos.z + 0.5 + this.state.faceVector.z * 0.5
            );
            await this.bot.lookAt(placePoint);

            // Place block
            try {
                await this.bot.placeBlock(refBlock, this.state.faceVector);
                this.stopSneaking();
                this.state.target = null;
                return true;
            } catch (e) {
                this.stopSneaking();
                this.state.target = null;
                return true;
            }
        }

        return false;
    }

    private stopSneaking(): void {
        if (this.state.sneaking) {
            this.bot.setControlState('sneak', false);
            this.state.sneaking = false;
        }
    }

    /**
     * Cancel current placing operation
     */
    cancel(): void {
        this.stopSneaking();
        this.state.target = null;
    }
}
