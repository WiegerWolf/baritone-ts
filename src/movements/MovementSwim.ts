import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { Movement, MovementState } from './Movement';
import {
  WALK_ONE_IN_WATER_COST,
  SWIM_UP_ONE_COST,
  SWIM_DOWN_ONE_COST
} from '../core/ActionCosts';
import { getMovementHelper } from './MovementHelper';

/**
 * MovementSwim handles swimming in water
 * Based on Baritone's swimming movement handling
 *
 * Features:
 * - Horizontal swimming
 * - Swimming up/down
 * - Surface breathing
 * - Current handling
 */

// Add swim costs to ActionCosts if not present
const SWIM_UP_COST = 6.0; // Ticks to swim up one block
const SWIM_DOWN_COST = 2.0; // Ticks to swim down one block (faster due to gravity)
const SWIM_HORIZONTAL_COST = 9.091; // Same as walking in water

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
    return 4.633; // WALK_ONE_BLOCK_COST
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
