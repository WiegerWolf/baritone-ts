import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { Movement, MovementState } from './Movement';
import {
  SPRINT_ONE_BLOCK_COST,
  JUMP_ONE_BLOCK_COST
} from '../core/ActionCosts';

/**
 * MovementParkourAscend: Long jump with upward movement (+1 Y)
 * Combination of horizontal parkour jump while also gaining 1 block of height.
 * More difficult than standard parkour - requires precise timing.
 */
export class MovementParkourAscend extends Movement {
  private readonly horizontalDistance: number;
  private hasJumped: boolean = false;
  private jumpTick: number = 0;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.horizontalDistance = Math.sqrt(
      Math.pow(dest.x - src.x, 2) +
      Math.pow(dest.z - src.z, 2)
    );
  }

  calculateCost(ctx: CalculationContext): number {
    if (!ctx.allowParkour) return COST_INF;
    if (!ctx.allowSprint) return COST_INF; // Parkour ascend always needs sprint

    const { src, dest } = this;

    // Must be ascending by exactly 1 block
    if (dest.y - src.y !== 1) return COST_INF;

    // Max horizontal distance for parkour ascend is 3 blocks
    // (can't jump as far while also ascending)
    if (this.horizontalDistance > 3) return COST_INF;

    // Check destination floor
    if (!this.isSolid(ctx, dest.x, dest.y - 1, dest.z)) {
      return COST_INF;
    }

    // Check body space at destination
    if (!this.isPassable(ctx, dest.x, dest.y, dest.z)) return COST_INF;
    if (!this.isPassable(ctx, dest.x, dest.y + 1, dest.z)) return COST_INF;

    // Check head clearance at source (need extra space for jump arc)
    if (!this.isPassable(ctx, src.x, src.y + 2, src.z)) return COST_INF;

    // Check trajectory clearance - jumping arc
    // At midpoint, player will be at approximately src.y + 1.5
    const midX = (src.x + dest.x) / 2;
    const midZ = (src.z + dest.z) / 2;
    const midY = src.y + 1; // Approximate trajectory height
    if (!this.isPassable(ctx, Math.floor(midX), Math.floor(midY), Math.floor(midZ))) {
      return COST_INF;
    }
    if (!this.isPassable(ctx, Math.floor(midX), Math.floor(midY) + 1, Math.floor(midZ))) {
      return COST_INF;
    }

    // Check gap is actually a gap (not just walking)
    // There should be no solid ground between src and dest horizontally
    const dx = Math.sign(dest.x - src.x);
    const dz = Math.sign(dest.z - src.z);
    let hasGap = false;
    for (let d = 1; d < Math.max(Math.abs(dest.x - src.x), Math.abs(dest.z - src.z)); d++) {
      const checkX = src.x + dx * d;
      const checkZ = src.z + dz * d;
      if (!this.isSolid(ctx, checkX, src.y - 1, checkZ) &&
          !this.isSolid(ctx, checkX, src.y, checkZ)) {
        hasGap = true;
        break;
      }
    }

    // If no gap and dest is only 1 block away, use regular ascend instead
    if (!hasGap && this.horizontalDistance <= 1.5) {
      return COST_INF;
    }

    // Cost: higher than regular parkour due to difficulty
    // Sprint cost + jump cost + ascend penalty
    const cost = SPRINT_ONE_BLOCK_COST * this.horizontalDistance +
                 JUMP_ONE_BLOCK_COST +
                 ctx.jumpPenalty * 1.5; // Extra penalty for difficulty

    return cost;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    // Check if we've landed at destination
    if (this.helper!.isAtPosition(this.dest, 0.5) && bot.entity.onGround) {
      bot.setControlState('sprint', false);
      bot.setControlState('jump', false);
      bot.setControlState('forward', false);
      return MovementStatus.SUCCESS;
    }

    // Timeout check - parkour ascend should complete within reasonable time
    if (this.ticksOnCurrent > 60) {
      bot.setControlState('sprint', false);
      bot.setControlState('jump', false);
      return MovementStatus.FAILED;
    }

    const pos = bot.entity.position;

    // Always sprint for parkour ascend
    bot.setControlState('sprint', true);

    // Move toward destination
    this.helper!.moveToward(this.dest, 0.15, true, false);

    // Calculate distance from source center
    const distFromSrc = Math.sqrt(
      Math.pow(pos.x - (this.src.x + 0.5), 2) +
      Math.pow(pos.z - (this.src.z + 0.5), 2)
    );

    // Jump at edge of source block
    // For parkour ascend, timing is critical - jump slightly earlier than flat parkour
    const jumpDistance = Math.min(0.4, this.horizontalDistance * 0.15);

    if (bot.entity.onGround && distFromSrc >= jumpDistance && !this.hasJumped) {
      bot.setControlState('jump', true);
      this.hasJumped = true;
      this.jumpTick = this.ticksOnCurrent;
    } else if (this.hasJumped && this.ticksOnCurrent > this.jumpTick + 2) {
      // Release jump after a couple ticks
      bot.setControlState('jump', false);
    }

    // If we've fallen back to source level or below, we failed
    if (this.hasJumped && bot.entity.onGround && pos.y <= this.src.y) {
      if (this.ticksOnCurrent > this.jumpTick + 10) {
        return MovementStatus.FAILED;
      }
    }

    return MovementStatus.RUNNING;
  }

  reset(): void {
    super.reset();
    this.hasJumped = false;
    this.jumpTick = 0;
  }
}
