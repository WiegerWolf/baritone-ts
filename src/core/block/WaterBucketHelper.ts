/**
 * WaterBucketHelper - Handles water bucket operations for fall cushioning
 */

import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import type { WaterBucketState } from './types';

/**
 * WaterBucketHelper manages water bucket placement for fall cushioning
 */
export class WaterBucketHelper {
    private bot: any;
    private state: WaterBucketState = {
        active: false,
        placedWaterAt: null,
        needsPickup: false
    };

    constructor(bot: any) {
        this.bot = bot;
    }

    /**
     * Check if we have a water bucket
     */
    hasWaterBucket(): boolean {
        const items = this.bot.inventory.items();
        return items.some((item: any) => item.name === 'water_bucket');
    }

    /**
     * Check if we have an empty bucket
     */
    hasEmptyBucket(): boolean {
        const items = this.bot.inventory.items();
        return items.some((item: any) => item.name === 'bucket');
    }

    /**
     * Get water bucket from inventory
     */
    getWaterBucket(): any {
        const items = this.bot.inventory.items();
        return items.find((item: any) => item.name === 'water_bucket');
    }

    /**
     * Get empty bucket from inventory
     */
    getEmptyBucket(): any {
        const items = this.bot.inventory.items();
        return items.find((item: any) => item.name === 'bucket');
    }

    /**
     * Activate water bucket cushioning for a fall
     * Call this when starting a high fall
     */
    activate(): boolean {
        if (!this.hasWaterBucket()) return false;

        this.state.active = true;
        this.state.placedWaterAt = null;
        this.state.needsPickup = false;
        return true;
    }

    /**
     * Tick the water bucket cushioning
     * Should be called while falling
     * @param currentY Current Y position
     * @param targetY Target landing Y position
     * @param velocity Current Y velocity (negative when falling)
     */
    async tick(currentY: number, targetY: number, velocity: number): Promise<void> {
        if (!this.state.active) return;

        const heightAboveGround = currentY - targetY;
        const timeToLand = velocity !== 0 ? heightAboveGround / Math.abs(velocity) : Infinity;

        // Place water when close to ground (within 3 blocks or ~0.5 seconds)
        if (heightAboveGround <= 3 || timeToLand <= 10) {
            if (!this.state.placedWaterAt) {
                await this.placeWater(targetY);
            }
        }

        // Pick up water after landing
        if (this.state.needsPickup && this.bot.entity.onGround) {
            // Wait a moment for water to settle
            setTimeout(() => this.pickupWater(), 100);
        }
    }

    /**
     * Place water at feet level
     */
    private async placeWater(targetY: number): Promise<void> {
        const bucket = this.getWaterBucket();
        if (!bucket) return;

        try {
            await this.bot.equip(bucket, 'hand');

            // Look straight down
            await this.bot.look(this.bot.entity.yaw, Math.PI / 2);

            // Place water
            const pos = this.bot.entity.position;
            const targetPos = new BlockPos(
                Math.floor(pos.x),
                Math.floor(targetY),
                Math.floor(pos.z)
            );

            // Activate item (place water)
            await this.bot.activateItem();

            this.state.placedWaterAt = targetPos;
            this.state.needsPickup = true;
        } catch (e) {
            // Failed to place water
        }
    }

    /**
     * Pick up the placed water
     */
    private async pickupWater(): Promise<void> {
        if (!this.state.placedWaterAt) return;

        const bucket = this.getEmptyBucket();
        if (!bucket) {
            this.state.active = false;
            return;
        }

        try {
            await this.bot.equip(bucket, 'hand');

            // Look at water
            const waterPos = this.state.placedWaterAt;
            const waterBlock = this.bot.blockAt(new Vec3(waterPos.x, waterPos.y, waterPos.z));

            if (waterBlock && (waterBlock.name === 'water' || waterBlock.name === 'flowing_water')) {
                await this.bot.lookAt(new Vec3(waterPos.x + 0.5, waterPos.y + 0.5, waterPos.z + 0.5));
                await this.bot.activateItem();
            }
        } catch (e) {
            // Failed to pick up water
        }

        this.state.active = false;
        this.state.placedWaterAt = null;
        this.state.needsPickup = false;
    }

    /**
     * Check if water bucket cushioning is active
     */
    isActive(): boolean {
        return this.state.active;
    }

    /**
     * Cancel water bucket operation
     */
    cancel(): void {
        this.state.active = false;
        this.state.needsPickup = false;
    }
}
