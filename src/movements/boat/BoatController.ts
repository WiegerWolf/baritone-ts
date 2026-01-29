import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import type { CalculationContext } from '../../types';
import {
    BoatState,
    isInBoat,
    findNearbyBoat,
    hasBoatItem
} from './BoatConstants';
import { findWaterSurface } from './BoatUtils';

/**
 * BoatController - handles boat travel execution
 */
export class BoatController {
    private bot: Bot;
    private ctx: CalculationContext;
    private state: BoatState = BoatState.IDLE;
    private target: Vec3 | null = null;
    private targetBoat: Entity | null = null;

    constructor(bot: Bot, ctx: CalculationContext) {
        this.bot = bot;
        this.ctx = ctx;
    }

    /**
     * Start boat travel to target
     */
    startTravel(target: Vec3): boolean {
        // Check if water is available
        const startY = findWaterSurface(
            this.ctx,
            Math.floor(this.bot.entity.position.x),
            Math.floor(this.bot.entity.position.z),
            Math.floor(this.bot.entity.position.y)
        );

        if (startY === null && !isInBoat(this.bot)) {
            return false;
        }

        this.target = target;
        this.state = isInBoat(this.bot) ? BoatState.TRAVELING : BoatState.FINDING_BOAT;
        return true;
    }

    /**
     * Stop boat travel
     */
    stopTravel(): void {
        this.state = BoatState.IDLE;
        this.target = null;
        this.bot.setControlState('forward', false);
        this.bot.setControlState('back', false);
    }

    /**
     * Get current state
     */
    getState(): BoatState {
        return this.state;
    }

    /**
     * Tick boat travel execution
     * Returns true when travel is complete
     */
    tick(): boolean {
        if (!this.target && this.state !== BoatState.IDLE) {
            this.state = BoatState.IDLE;
            return true;
        }

        switch (this.state) {
            case BoatState.IDLE:
                return true;

            case BoatState.FINDING_BOAT:
                // Look for nearby boat or place one
                this.targetBoat = findNearbyBoat(this.bot);

                if (this.targetBoat) {
                    this.state = BoatState.BOARDING;
                } else if (hasBoatItem(this.bot)) {
                    // Place a boat
                    this.placeBoat();
                } else {
                    // Can't proceed without boat
                    this.state = BoatState.FINISHED;
                    return true;
                }
                return false;

            case BoatState.BOARDING:
                if (isInBoat(this.bot)) {
                    this.state = BoatState.TRAVELING;
                    return false;
                }

                // Move toward and board boat
                if (this.targetBoat && this.targetBoat.isValid) {
                    const dist = this.bot.entity.position.distanceTo(this.targetBoat.position);

                    if (dist < 3) {
                        // Mount the boat
                        this.bot.mount(this.targetBoat);
                    } else {
                        // Move toward boat
                        this.bot.lookAt(this.targetBoat.position);
                        this.bot.setControlState('forward', true);
                    }
                } else {
                    // Boat disappeared, find another
                    this.state = BoatState.FINDING_BOAT;
                }
                return false;

            case BoatState.TRAVELING:
                if (!isInBoat(this.bot)) {
                    // Fell out of boat?
                    this.state = BoatState.FINDING_BOAT;
                    return false;
                }

                const pos = this.bot.entity.position;
                const distToTarget = pos.distanceTo(this.target!);

                if (distToTarget < 3) {
                    this.state = BoatState.DISEMBARKING;
                    return false;
                }

                // Navigate toward target
                this.navigateToward(this.target!);
                return false;

            case BoatState.DISEMBARKING:
                this.bot.setControlState('forward', false);

                if (!isInBoat(this.bot)) {
                    this.state = BoatState.FINISHED;
                    return true;
                }

                // Dismount
                this.bot.dismount();
                return false;

            case BoatState.FINISHED:
                return true;

            default:
                return true;
        }
    }

    /**
     * Navigate boat toward a position
     */
    private navigateToward(target: Vec3): void {
        const pos = this.bot.entity.position;

        // Calculate direction
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;

        // Calculate yaw
        const yaw = Math.atan2(-dx, dz);

        this.bot.look(yaw, 0, false);
        this.bot.setControlState('forward', true);
    }

    /**
     * Place a boat on water
     */
    private async placeBoat(): Promise<void> {
        const boatItem = this.bot.inventory.items().find(i =>
            i.name.includes('boat') && !i.name.includes('chest_boat')
        );

        if (boatItem) {
            try {
                await this.bot.equip(boatItem, 'hand');

                // Look at water below/ahead
                const pos = this.bot.entity.position;
                const waterY = findWaterSurface(
                    this.ctx,
                    Math.floor(pos.x),
                    Math.floor(pos.z),
                    Math.floor(pos.y)
                );

                if (waterY !== null) {
                    await this.bot.lookAt(new Vec3(pos.x, waterY, pos.z));
                    this.bot.activateItem();

                    // Wait for boat to spawn
                    setTimeout(() => {
                        this.targetBoat = findNearbyBoat(this.bot);
                        if (this.targetBoat) {
                            this.state = BoatState.BOARDING;
                        }
                    }, 500);
                }
            } catch {
                // Ignore equip errors
            }
        }
    }
}
