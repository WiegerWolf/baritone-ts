import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { Movement, MovementState } from './Movement';
import {
  WALK_OFF_BLOCK_COST,
  getFallCost
} from '../core/ActionCosts';

/**
 * MovementDescend: Drop down one or more blocks
 * Supports fall override for continuous falling
 */
export class MovementDescend extends Movement {
  private readonly fallHeight: number;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.fallHeight = src.y - dest.y;
    // Descend can accept fall override - bot can fall through without stopping
    this.canAcceptFallOverride = true;
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check destination floor
    const floor = ctx.getBlock(dest.x, dest.y - 1, dest.z);
    if (!ctx.canWalkOn(floor) && !ctx.isWater(floor)) {
      return COST_INF;
    }

    // Check body space at destination
    if (!this.isPassable(ctx, dest.x, dest.y, dest.z)) return COST_INF;
    if (!this.isPassable(ctx, dest.x, dest.y + 1, dest.z)) return COST_INF;

    // Check path clearance
    for (let y = src.y; y >= dest.y; y--) {
      if (!this.isPassable(ctx, dest.x, y, dest.z)) return COST_INF;
      if (!this.isPassable(ctx, dest.x, y + 1, dest.z)) return COST_INF;
    }

    // Calculate fall cost
    const isWaterLanding = ctx.isWater(floor);
    const fallCost = getFallCost(this.fallHeight, isWaterLanding);

    const cost = WALK_OFF_BLOCK_COST + fallCost;
    return cost * ctx.getFavoring(dest.x, dest.y, dest.z);
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    switch (this.state) {
      case MovementState.NOT_STARTED:
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        // Walk toward edge
        this.helper!.moveToward(this.dest, 0.3, false, false);

        // Check if we're falling
        if (!bot.entity.onGround) {
          this.state = MovementState.WAITING;
        }

        return MovementStatus.RUNNING;

      case MovementState.WAITING:
        // Continue moving toward destination while falling
        this.helper!.moveToward(this.dest, 0.3, false, false);

        // Wait for landing
        if (bot.entity.onGround) {
          if (this.helper!.isAtPosition(this.dest, 0.5)) {
            this.state = MovementState.FINISHED;
            return MovementStatus.SUCCESS;
          }
        }

        return MovementStatus.WAITING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }

  /**
   * Get the y-level we expect to be falling through
   * Used by fall override system
   */
  getFallPath(): number[] {
    const path: number[] = [];
    for (let y = this.src.y; y >= this.dest.y; y--) {
      path.push(y);
    }
    return path;
  }
}
