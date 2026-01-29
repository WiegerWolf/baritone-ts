import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { LADDER_DOWN_ONE_COST } from '../../core/ActionCosts';
import { Movement, MovementState } from '../Movement';
import { getMovementHelper } from '../MovementHelper';
import { isClimbable, isVine } from './ClimbUtils';

/**
 * Vine climbing cost (slightly slower than ladder)
 */
const VINE_DOWN_ONE_COST = LADDER_DOWN_ONE_COST * 1.1; // ~1.57 ticks

/**
 * MovementClimbDown - Descend a ladder or vine
 */
export class MovementClimbDown extends Movement {
    private isVineClimb: boolean = false;

    constructor(src: BlockPos, dest: BlockPos) {
        super(src, dest);
        this.canAcceptFallOverride = true; // Can grab ladder/vine while falling
    }

    calculateCost(ctx: CalculationContext): number {
        // Check if there's a climbable block at destination (we're climbing down to it)
        const climbBlock = ctx.getBlock(this.dest.x, this.dest.y, this.dest.z);
        if (!isClimbable(climbBlock)) return COST_INF;

        // Check if destination body space is passable
        if (!ctx.canWalkThrough(climbBlock)) return COST_INF;

        this.isVineClimb = isVine(climbBlock);
        if (this.isVineClimb) {
            const hasSupport = this.checkVineSupport(ctx, this.dest.x, this.dest.y, this.dest.z);
            if (!hasSupport) return COST_INF;
        }

        return this.isVineClimb ? VINE_DOWN_ONE_COST : LADDER_DOWN_ONE_COST;
    }

    private checkVineSupport(ctx: CalculationContext, x: number, y: number, z: number): boolean {
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dz] of directions) {
            const block = ctx.getBlock(x + dx, y, z + dz);
            if (block && block.boundingBox === 'block') {
                return true;
            }
        }
        return false;
    }

    tick(ctx: CalculationContext, bot: any): MovementStatus {
        if (!this.helper) {
            this.initHelper(bot, ctx);
        }

        switch (this.state) {
            case MovementState.NOT_STARTED:
            case MovementState.WAITING: // Fall override entry point
                this.state = MovementState.MOVING;
            // Fall through

            case MovementState.MOVING:
                // Hold sneak to descend slowly
                bot.setControlState('sneak', true);
                bot.setControlState('jump', false);

                // Check if we've reached destination
                const pos = bot.entity.position;
                if (pos.y <= this.dest.y + 0.5) {
                    this.state = MovementState.FINISHED;
                }

                this.ticksOnCurrent++;
                if (this.ticksOnCurrent > 100) {
                    return MovementStatus.UNREACHABLE;
                }
                break;

            case MovementState.FINISHED:
                bot.setControlState('sneak', false);
                return MovementStatus.SUCCESS;
        }

        return MovementStatus.RUNNING;
    }
}
