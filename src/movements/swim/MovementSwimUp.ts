import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { Movement } from '../Movement';
import { getMovementHelper } from '../MovementHelper';
import { SWIM_UP_COST } from './SwimCosts';

/**
 * MovementSwimUp: Swim upward through water
 */
export class MovementSwimUp extends Movement {
    constructor(src: BlockPos, dest: BlockPos) {
        super(src, dest);
    }

    calculateCost(ctx: CalculationContext): number {
        const { src, dest } = this;

        // Must be in water
        const srcBlock = ctx.getBlock(src.x, src.y, src.z);
        if (!ctx.isWater(srcBlock)) {
            return COST_INF;
        }

        // Destination must have water or be above water surface
        const destBlock = ctx.getBlock(dest.x, dest.y, dest.z);
        const destBelow = ctx.getBlock(dest.x, dest.y - 1, dest.z);

        if (!ctx.isWater(destBlock) && !ctx.isWater(destBelow)) {
            // Only allow if we're surfacing
            if (!ctx.canWalkThrough(destBlock)) {
                return COST_INF;
            }
        }

        // Check head clearance
        const headSpace = ctx.getBlock(dest.x, dest.y + 1, dest.z);
        if (!ctx.canWalkThrough(headSpace) && !ctx.isWater(headSpace)) {
            return COST_INF;
        }

        return SWIM_UP_COST * ctx.getFavoring(dest.x, dest.y, dest.z);
    }

    tick(ctx: CalculationContext, bot: any): MovementStatus {
        this.ticksOnCurrent++;
        if (!this.helper) this.initHelper(bot, ctx);

        // Check if we've reached destination
        const pos = bot.entity.position;
        if (pos.y >= this.dest.y - 0.5) {
            if (this.helper!.isAtPosition(this.dest, 0.4)) {
                bot.setControlState('jump', false);
                return MovementStatus.SUCCESS;
            }
        }

        // Swim up
        bot.setControlState('jump', true);

        // Also move horizontally if needed
        const dx = Math.abs(pos.x - (this.dest.x + 0.5));
        const dz = Math.abs(pos.z - (this.dest.z + 0.5));
        if (dx > 0.3 || dz > 0.3) {
            this.helper!.moveToward(this.dest, 0.3, false, false);
        }

        return MovementStatus.RUNNING;
    }
}
