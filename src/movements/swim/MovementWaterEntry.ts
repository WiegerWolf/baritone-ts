import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../../types';
import { WALK_ONE_BLOCK_COST } from '../../core/ActionCosts';
import { Movement } from '../Movement';
import { getMovementHelper } from '../MovementHelper';

/**
 * MovementWaterEntry: Enter water from land
 */
export class MovementWaterEntry extends Movement {
    constructor(src: BlockPos, dest: BlockPos) {
        super(src, dest);
        this.canAcceptFallOverride = true;
    }

    calculateCost(ctx: CalculationContext): number {
        const { src, dest } = this;

        // Source must be on solid ground
        const srcFloor = ctx.getBlock(src.x, src.y - 1, src.z);
        if (!ctx.canWalkOn(srcFloor) && !ctx.isWater(srcFloor)) {
            return COST_INF;
        }

        // Destination must be in water
        const destBlock = ctx.getBlock(dest.x, dest.y, dest.z);
        if (!ctx.isWater(destBlock)) {
            return COST_INF;
        }

        // Simple walk-off cost
        return WALK_ONE_BLOCK_COST;
    }

    tick(ctx: CalculationContext, bot: any): MovementStatus {
        this.ticksOnCurrent++;
        if (!this.helper) this.initHelper(bot, ctx);

        // Check if we've reached destination (in water)
        if (this.helper!.isAtPosition(this.dest, 0.4)) {
            return MovementStatus.SUCCESS;
        }

        // Walk into water
        this.helper!.moveToward(this.dest, 0.3, false, false);

        return MovementStatus.RUNNING;
    }
}
