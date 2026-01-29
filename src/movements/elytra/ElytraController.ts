import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import type { CalculationContext } from '../../types';
import {
    ElytraState,
    GLIDE_PITCH_OPTIMAL,
    DIVE_PITCH_MAX,
    CLIMB_PITCH_MAX,
    ROCKET_BOOST_DURATION,
    hasElytraEquipped,
    hasFireworkRockets,
    getHeightAboveGround
} from './ElytraConstants';
import { findLandingSpot } from './ElytraUtils';

/**
 * ElytraController - handles elytra flight execution
 */
export class ElytraController {
    private bot: Bot;
    private ctx: CalculationContext;
    private state: ElytraState = ElytraState.IDLE;
    private target: Vec3 | null = null;
    private lastRocketTick: number = 0;

    constructor(bot: Bot, ctx: CalculationContext) {
        this.bot = bot;
        this.ctx = ctx;
    }

    /**
     * Start flying to target
     */
    startFlight(target: Vec3): boolean {
        if (!hasElytraEquipped(this.bot)) {
            return false;
        }

        this.target = target;
        this.state = ElytraState.TAKING_OFF;
        return true;
    }

    /**
     * Stop flight
     */
    stopFlight(): void {
        this.state = ElytraState.IDLE;
        this.target = null;
        this.bot.setControlState('jump', false);
    }

    /**
     * Get current state
     */
    getState(): ElytraState {
        return this.state;
    }

    /**
     * Tick flight execution
     * Returns true when flight is complete
     */
    tick(): boolean {
        if (!this.target) return true;

        const pos = this.bot.entity.position;
        const distToTarget = pos.distanceTo(this.target);

        switch (this.state) {
            case ElytraState.IDLE:
                return true;

            case ElytraState.TAKING_OFF:
                // Jump to start flight
                this.bot.setControlState('jump', true);

                // Check if we're airborne enough to start gliding
                if (this.bot.entity.velocity.y > 0.1) {
                    // @ts-ignore - elytraFly may not be in type definitions
                    if (typeof this.bot.elytraFly === 'function') {
                        this.bot.elytraFly();
                    }
                    this.bot.setControlState('jump', false);
                    this.state = ElytraState.GLIDING;
                }
                return false;

            case ElytraState.GLIDING:
                // Check if arrived
                if (distToTarget < 5) {
                    this.state = ElytraState.LANDING;
                    return false;
                }

                // Navigate toward target
                this.navigateToward(this.target);

                // Check if we need to boost
                const heightAboveGround = getHeightAboveGround(this.ctx, pos.x, pos.y, pos.z);
                if (this.target.y > pos.y + 5 || heightAboveGround < 20) {
                    if (hasFireworkRockets(this.bot) > 0) {
                        this.state = ElytraState.BOOSTING;
                    }
                }
                return false;

            case ElytraState.BOOSTING:
                // Use rocket
                const currentTick = Date.now();
                if (currentTick - this.lastRocketTick > ROCKET_BOOST_DURATION * 50) {
                    this.useRocket();
                    this.lastRocketTick = currentTick;
                }

                this.navigateToward(this.target);

                // Return to gliding after boost
                this.state = ElytraState.GLIDING;
                return false;

            case ElytraState.LANDING:
                // Find landing spot
                const landingSpot = findLandingSpot(
                    this.ctx,
                    this.target.x,
                    this.target.y,
                    this.target.z
                );

                if (landingSpot) {
                    this.navigateToward(new Vec3(landingSpot.x + 0.5, landingSpot.y, landingSpot.z + 0.5));
                }

                // Check if landed
                if (this.bot.entity.onGround) {
                    this.state = ElytraState.LANDED;
                    return true;
                }
                return false;

            case ElytraState.LANDED:
                return true;

            default:
                return true;
        }
    }

    /**
     * Navigate toward a position
     */
    private navigateToward(target: Vec3): void {
        const pos = this.bot.entity.position;

        // Calculate direction
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dz = target.z - pos.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        // Calculate yaw
        const yaw = Math.atan2(-dx, dz);

        // Calculate pitch based on vertical difference
        let pitch: number;
        if (dy > 10) {
            pitch = CLIMB_PITCH_MAX * Math.PI / 180;
        } else if (dy < -20) {
            pitch = DIVE_PITCH_MAX * Math.PI / 180;
        } else {
            pitch = GLIDE_PITCH_OPTIMAL * Math.PI / 180;
        }

        this.bot.look(yaw, pitch, true);
    }

    /**
     * Use a firework rocket
     */
    private async useRocket(): Promise<void> {
        const rockets = this.bot.inventory.items().find(i => i.name === 'firework_rocket');
        if (rockets) {
            try {
                await this.bot.equip(rockets, 'hand');
                this.bot.activateItem();
            } catch {
                // Ignore equip errors
            }
        }
    }
}
