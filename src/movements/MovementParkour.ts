import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { Movement, MovementState } from './Movement';
import {
  WALK_ONE_BLOCK_COST,
  SPRINT_ONE_BLOCK_COST
} from '../core/ActionCosts';

/**
 * MovementParkour: Long jump over gaps
 */
export class MovementParkour extends Movement {
  private readonly distance: number;
  private hasJumped: boolean = false;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.distance = Math.sqrt(
      Math.pow(dest.x - src.x, 2) +
      Math.pow(dest.z - src.z, 2)
    );
  }

  calculateCost(ctx: CalculationContext): number {
    if (!ctx.allowParkour) return COST_INF;

    const { src, dest } = this;

    // Check destination floor
    if (!this.isSolid(ctx, dest.x, dest.y - 1, dest.z)) {
      return COST_INF;
    }

    // Check body space at destination
    if (!this.isPassable(ctx, dest.x, dest.y, dest.z)) return COST_INF;
    if (!this.isPassable(ctx, dest.x, dest.y + 1, dest.z)) return COST_INF;

    // Check head clearance at source
    if (!this.isPassable(ctx, src.x, src.y + 2, src.z)) return COST_INF;

    // Determine cost based on distance
    let cost: number;
    if (this.distance <= 2) {
      cost = WALK_ONE_BLOCK_COST * this.distance;
    } else if (this.distance <= 3) {
      cost = WALK_ONE_BLOCK_COST * this.distance;
    } else {
      // 4-block jump requires sprint
      if (!ctx.allowSprint) return COST_INF;
      cost = SPRINT_ONE_BLOCK_COST * this.distance;
    }

    return cost + ctx.jumpPenalty;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    // Check if we've landed at destination
    if (this.helper!.isAtPosition(this.dest, 0.4) && bot.entity.onGround) {
      bot.setControlState('sprint', false);
      bot.setControlState('jump', false);
      return MovementStatus.SUCCESS;
    }

    const pos = bot.entity.position;
    const needsSprint = this.distance > 3;

    // Move toward destination
    this.helper!.moveToward(this.dest, 0.2, needsSprint, false);

    // Jump at edge of source block
    const distFromSrc = Math.sqrt(
      Math.pow(pos.x - (this.src.x + 0.5), 2) +
      Math.pow(pos.z - (this.src.z + 0.5), 2)
    );

    if (bot.entity.onGround && distFromSrc >= 0.3 && !this.hasJumped) {
      bot.setControlState('jump', true);
      this.hasJumped = true;
    } else if (!bot.entity.onGround) {
      bot.setControlState('jump', false);
    }

    return MovementStatus.RUNNING;
  }

  reset(): void {
    super.reset();
    this.hasJumped = false;
  }
}
