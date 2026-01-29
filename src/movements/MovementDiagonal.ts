import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { Movement, MovementState } from './Movement';
import {
  WALK_ONE_BLOCK_COST,
  SPRINT_MULTIPLIER,
  SQRT_2
} from '../core/ActionCosts';

/**
 * MovementDiagonal: Diagonal movement
 */
export class MovementDiagonal extends Movement {
  private readonly dx: number;
  private readonly dz: number;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.dx = dest.x - src.x;
    this.dz = dest.z - src.z;
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check destination floor
    if (!this.isSolid(ctx, dest.x, dest.y - 1, dest.z)) {
      return COST_INF;
    }

    // Check body space at destination
    if (!this.isPassable(ctx, dest.x, dest.y, dest.z)) return COST_INF;
    if (!this.isPassable(ctx, dest.x, dest.y + 1, dest.z)) return COST_INF;

    // Check corner clearance (need at least one path)
    const corner1Clear = this.isPassable(ctx, src.x + this.dx, src.y, src.z) &&
                        this.isPassable(ctx, src.x + this.dx, src.y + 1, src.z);
    const corner2Clear = this.isPassable(ctx, src.x, src.y, src.z + this.dz) &&
                        this.isPassable(ctx, src.x, src.y + 1, src.z + this.dz);

    if (!corner1Clear && !corner2Clear) return COST_INF;

    // Calculate cost
    let cost = WALK_ONE_BLOCK_COST * SQRT_2;

    // Can sprint if both corners clear
    if (ctx.allowSprint && corner1Clear && corner2Clear) {
      cost *= SPRINT_MULTIPLIER;
    }

    return cost * ctx.getFavoring(dest.x, dest.y, dest.z);
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    if (this.helper!.isAtPosition(this.dest)) {
      return MovementStatus.SUCCESS;
    }

    this.helper!.moveToward(this.dest, 0.25, ctx.allowSprint, false);
    return MovementStatus.RUNNING;
  }
}
