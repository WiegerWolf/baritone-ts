import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { Movement } from '../Movement';
import { getMovementHelper } from '../MovementHelper';
import { SWIM_DOWN_COST } from './SwimCosts';

/**
 * MovementSwimDown: Swim downward through water
 */
export class MovementSwimDown extends Movement {
    constructor(src: BlockPos, dest: BlockPos) {
        super(src, dest);
    }

    calculateCost(ctx: CalculationContext): number {
        const { src, dest } = this;

        // Source must be in water
        const srcBlock = ctx.getBlock(src.x, src.y, src.z);
        if (!ctx.isWater(srcBlock)) {
            return COST_INF;
        }

        // Destination must be in water
        const destBlock = ctx.getBlock(dest.x, dest.y, dest.z);
        if (!ctx.isWater(destBlock)) {
            return COST_INF;
        }

        // Check for floor (can't swim into solid)
        const floor = ctx.getBlock(dest.x, dest.y - 1, dest.z);
        // Allow if water or solid floor
        if (!ctx.isWater(floor) && !ctx.canWalkOn(floor)) {
            return COST_INF;
        }

        return SWIM_DOWN_COST * ctx.getFavoring(dest.x, dest.y, dest.z);
    }

    tick(ctx: CalculationContext, bot: any): MovementStatus {
        this.ticksOnCurrent++;
        if (!this.helper) this.initHelper(bot, ctx);

        // Check if we've reached destination
        if (this.helper!.isAtPosition(this.dest, 0.4)) {
            return MovementStatus.SUCCESS;
        }

        // Swim down (release jump, hold sneak)
        bot.setControlState('jump', false);
        bot.setControlState('sneak', true);

        // Move horizontally if needed
        this.helper!.moveToward(this.dest, 0.3, false, false);

        return MovementStatus.RUNNING;
    }

    reset(): void {
        super.reset();
    }
}
