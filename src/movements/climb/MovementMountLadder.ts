import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { WALK_ONE_BLOCK_COST } from '../../core/ActionCosts';
import { Movement } from '../Movement';
import { MovementState } from '../MovementState';
import { getMovementHelper } from '../MovementHelper';
import { isClimbable } from './ClimbUtils';

/**
 * MovementMountLadder - Move from ground onto a ladder/vine
 */
export class MovementMountLadder extends Movement {
    constructor(src: BlockPos, dest: BlockPos) {
        super(src, dest);
    }

    calculateCost(ctx: CalculationContext): number {
        // Destination should have a climbable block
        const climbBlock = ctx.getBlock(this.dest.x, this.dest.y, this.dest.z);
        if (!isClimbable(climbBlock)) return COST_INF;

        // Source should be walkable ground
        const srcFloor = ctx.getBlock(this.src.x, this.src.y - 1, this.src.z);
        if (!ctx.canWalkOn(srcFloor)) return COST_INF;

        // Path between should be clear
        const srcBody = ctx.getBlock(this.src.x, this.src.y, this.src.z);
        const srcHead = ctx.getBlock(this.src.x, this.src.y + 1, this.src.z);
        if (!ctx.canWalkThrough(srcBody)) return COST_INF;
        if (!ctx.canWalkThrough(srcHead)) return COST_INF;

        // Cost is walk to ladder + mount
        return WALK_ONE_BLOCK_COST + 1.0;
    }

    tick(ctx: CalculationContext, bot: any): MovementStatus {
        if (!this.helper) {
            this.initHelper(bot, ctx);
        }

        switch (this.state) {
            case MovementState.NOT_STARTED:
                this.state = MovementState.MOVING;
            // Fall through

            case MovementState.MOVING:
                // Walk toward the ladder
                const pos = bot.entity.position;
                const dx = this.dest.x + 0.5 - pos.x;
                const dz = this.dest.z + 0.5 - pos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < 0.3) {
                    this.state = MovementState.FINISHED;
                } else {
                    // Look toward ladder and walk
                    const yaw = Math.atan2(-dx, dz);
                    bot.look(yaw, 0);
                    bot.setControlState('forward', true);
                }

                this.ticksOnCurrent++;
                if (this.ticksOnCurrent > 60) {
                    return MovementStatus.UNREACHABLE;
                }
                break;

            case MovementState.FINISHED:
                bot.setControlState('forward', false);
                return MovementStatus.SUCCESS;
        }

        return MovementStatus.RUNNING;
    }
}
