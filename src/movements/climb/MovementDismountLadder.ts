import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { WALK_ONE_BLOCK_COST } from '../../core/ActionCosts';
import { Movement, MovementState } from '../Movement';
import { getMovementHelper } from '../MovementHelper';
import { isClimbable } from './ClimbUtils';

/**
 * MovementDismountLadder - Move from ladder/vine to adjacent ground
 */
export class MovementDismountLadder extends Movement {
    constructor(src: BlockPos, dest: BlockPos) {
        super(src, dest);
    }

    calculateCost(ctx: CalculationContext): number {
        // Source should have a climbable block
        const climbBlock = ctx.getBlock(this.src.x, this.src.y, this.src.z);
        if (!isClimbable(climbBlock)) return COST_INF;

        // Destination should be walkable ground
        const destFloor = ctx.getBlock(this.dest.x, this.dest.y - 1, this.dest.z);
        if (!ctx.canWalkOn(destFloor)) return COST_INF;

        // Destination body space should be clear
        const destBody = ctx.getBlock(this.dest.x, this.dest.y, this.dest.z);
        const destHead = ctx.getBlock(this.dest.x, this.dest.y + 1, this.dest.z);
        if (!ctx.canWalkThrough(destBody)) return COST_INF;
        if (!ctx.canWalkThrough(destHead)) return COST_INF;

        // Cost is dismount + walk
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
                // Look toward destination and walk off
                const pos = bot.entity.position;
                const dx = this.dest.x + 0.5 - pos.x;
                const dz = this.dest.z + 0.5 - pos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < 0.3) {
                    this.state = MovementState.FINISHED;
                } else {
                    const yaw = Math.atan2(-dx, dz);
                    bot.look(yaw, 0);
                    bot.setControlState('forward', true);
                    // Small jump to dismount cleanly
                    if (this.ticksOnCurrent === 0) {
                        bot.setControlState('jump', true);
                    } else {
                        bot.setControlState('jump', false);
                    }
                }

                this.ticksOnCurrent++;
                if (this.ticksOnCurrent > 60) {
                    return MovementStatus.UNREACHABLE;
                }
                break;

            case MovementState.FINISHED:
                bot.setControlState('forward', false);
                bot.setControlState('jump', false);
                return MovementStatus.SUCCESS;
        }

        return MovementStatus.RUNNING;
    }
}
