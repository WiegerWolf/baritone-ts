import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { Movement } from '../Movement';
import { getMovementHelper } from '../MovementHelper';
import { SWIM_UP_COST } from './SwimCosts';

/**
 * MovementWaterExit: Exit water onto land
 */
export class MovementWaterExit extends Movement {
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

        // Destination must be on solid ground
        const destFloor = ctx.getBlock(dest.x, dest.y - 1, dest.z);
        if (!ctx.canWalkOn(destFloor)) {
            return COST_INF;
        }

        // Destination must be passable
        const destBlock = ctx.getBlock(dest.x, dest.y, dest.z);
        const destHead = ctx.getBlock(dest.x, dest.y + 1, dest.z);
        if (!ctx.canWalkThrough(destBlock) || !ctx.canWalkThrough(destHead)) {
            return COST_INF;
        }

        // Exit cost - swimming up + climbing out
        return SWIM_UP_COST + 2.0;
    }

    tick(ctx: CalculationContext, bot: any): MovementStatus {
        this.ticksOnCurrent++;
        if (!this.helper) this.initHelper(bot, ctx);

        // Check if we've reached destination
        if (this.helper!.isAtPosition(this.dest, 0.35) && bot.entity.onGround) {
            bot.setControlState('jump', false);
            return MovementStatus.SUCCESS;
        }

        // Swim toward exit and jump to climb out
        this.helper!.moveToward(this.dest, 0.2, false, false);
        bot.setControlState('jump', true);

        return MovementStatus.RUNNING;
    }
}
