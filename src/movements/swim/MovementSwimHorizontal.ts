import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { Movement } from '../Movement';
import { MovementState } from '../MovementState';
import { getMovementHelper } from '../MovementHelper';
import { SWIM_HORIZONTAL_COST } from './SwimCosts';

/**
 * MovementSwimHorizontal: Swim horizontally through water
 */
export class MovementSwimHorizontal extends Movement {
    constructor(src: BlockPos, dest: BlockPos) {
        super(src, dest);
        // Swimming movements can accept fall override (water landing)
        this.canAcceptFallOverride = true;
    }

    calculateCost(ctx: CalculationContext): number {
        const { src, dest } = this;

        // Check source is in water
        const srcBlock = ctx.getBlock(src.x, src.y, src.z);
        if (!ctx.isWater(srcBlock)) {
            return COST_INF;
        }

        // Check destination has water or is passable above water
        const destBlock = ctx.getBlock(dest.x, dest.y, dest.z);
        const destBelow = ctx.getBlock(dest.x, dest.y - 1, dest.z);

        // Must be swimming into water or onto water surface
        if (!ctx.isWater(destBlock) && !ctx.isWater(destBelow)) {
            return COST_INF;
        }

        // Check for head clearance
        const headSpace = ctx.getBlock(dest.x, dest.y + 1, dest.z);
        if (!ctx.canWalkThrough(headSpace) && !ctx.isWater(headSpace)) {
            return COST_INF;
        }

        return SWIM_HORIZONTAL_COST * ctx.getFavoring(dest.x, dest.y, dest.z);
    }

    tick(ctx: CalculationContext, bot: any): MovementStatus {
        this.ticksOnCurrent++;
        if (!this.helper) this.initHelper(bot, ctx);

        // Check if we've reached destination
        if (this.helper!.isAtPosition(this.dest, 0.4)) {
            return MovementStatus.SUCCESS;
        }

        // Swim toward destination
        this.helper!.moveToward(this.dest, 0.3, false, false);

        // Hold space to stay afloat / swim up if needed
        const pos = bot.entity.position;
        if (pos.y < this.dest.y + 0.5) {
            bot.setControlState('jump', true);
        } else {
            bot.setControlState('jump', false);
        }

        return MovementStatus.RUNNING;
    }
}
