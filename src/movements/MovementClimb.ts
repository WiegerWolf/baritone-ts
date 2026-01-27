import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import {
  LADDER_UP_ONE_COST,
  LADDER_DOWN_ONE_COST,
  WALK_ONE_BLOCK_COST
} from '../core/ActionCosts';
import { Movement, MovementState } from './Movement';
import { getMovementHelper } from './MovementHelper';

/**
 * Vine climbing cost (slightly slower than ladder)
 * Vines require the player to be against a solid block
 */
const VINE_UP_ONE_COST = LADDER_UP_ONE_COST * 1.2; // 6.0 ticks
const VINE_DOWN_ONE_COST = LADDER_DOWN_ONE_COST * 1.1; // ~1.57 ticks

/**
 * Check if a block is climbable (ladder or vine)
 */
export function isClimbable(block: any): boolean {
  if (!block) return false;
  const name = block.name || '';
  return name === 'ladder' || name === 'vine' || name === 'twisting_vines' ||
         name === 'weeping_vines' || name === 'twisting_vines_plant' ||
         name === 'weeping_vines_plant' || name === 'cave_vines' ||
         name === 'cave_vines_plant';
}

/**
 * Check if block is a ladder specifically
 */
export function isLadder(block: any): boolean {
  if (!block) return false;
  return block.name === 'ladder';
}

/**
 * Check if block is a vine type
 */
export function isVine(block: any): boolean {
  if (!block) return false;
  const name = block.name || '';
  return name === 'vine' || name === 'twisting_vines' || name === 'weeping_vines' ||
         name === 'twisting_vines_plant' || name === 'weeping_vines_plant' ||
         name === 'cave_vines' || name === 'cave_vines_plant';
}

/**
 * MovementClimbUp - Climb up a ladder or vine
 */
export class MovementClimbUp extends Movement {
  private isVineClimb: boolean = false;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
  }

  calculateCost(ctx: CalculationContext): number {
    // Check if there's a climbable block at the source position
    const climbBlock = ctx.getBlock(this.src.x, this.src.y, this.src.z);
    if (!isClimbable(climbBlock)) return COST_INF;

    // Check if destination is clear
    const destBlock = ctx.getBlock(this.dest.x, this.dest.y, this.dest.z);
    if (!ctx.canWalkThrough(destBlock)) return COST_INF;

    // Check head space at destination
    const headSpace = ctx.getBlock(this.dest.x, this.dest.y + 1, this.dest.z);
    if (!ctx.canWalkThrough(headSpace)) return COST_INF;

    // Vines require a solid block behind them
    this.isVineClimb = isVine(climbBlock);
    if (this.isVineClimb) {
      // Check if vine has solid backing (simplified check)
      const hasSupport = this.checkVineSupport(ctx, this.src.x, this.src.y, this.src.z);
      if (!hasSupport) return COST_INF;
    }

    // Return appropriate cost
    return this.isVineClimb ? VINE_UP_ONE_COST : LADDER_UP_ONE_COST;
  }

  private checkVineSupport(ctx: CalculationContext, x: number, y: number, z: number): boolean {
    // Check all 4 horizontal directions for a solid block
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of directions) {
      const block = ctx.getBlock(x + dx, y, z + dz);
      if (block && block.boundingBox === 'block') {
        return true;
      }
    }
    return false;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    if (!this.helper) {
      this.initHelper(bot, ctx);
    }

    switch (this.state) {
      case MovementState.NOT_STARTED:
        // Look up
        bot.look(bot.entity.yaw, -Math.PI / 4);

        // Hold jump to climb
        bot.setControlState('jump', true);
        bot.setControlState('forward', false);

        this.state = MovementState.MOVING;
        break;

      case MovementState.MOVING:
        // Continue holding jump to climb
        bot.setControlState('jump', true);

        // Check if we've reached destination
        const pos = bot.entity.position;
        if (pos.y >= this.dest.y) {
          this.state = MovementState.FINISHED;
        }

        this.ticksOnCurrent++;
        if (this.ticksOnCurrent > 100) {
          return MovementStatus.UNREACHABLE;
        }
        break;

      case MovementState.FINISHED:
        bot.setControlState('jump', false);
        return MovementStatus.SUCCESS;
    }

    return MovementStatus.RUNNING;
  }
}

/**
 * MovementClimbDown - Descend a ladder or vine
 */
export class MovementClimbDown extends Movement {
  private isVineClimb: boolean = false;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.canAcceptFallOverride = true; // Can grab ladder/vine while falling
  }

  calculateCost(ctx: CalculationContext): number {
    // Check if there's a climbable block at destination (we're climbing down to it)
    const climbBlock = ctx.getBlock(this.dest.x, this.dest.y, this.dest.z);
    if (!isClimbable(climbBlock)) return COST_INF;

    // Check if destination body space is passable
    if (!ctx.canWalkThrough(climbBlock)) return COST_INF;

    this.isVineClimb = isVine(climbBlock);
    if (this.isVineClimb) {
      const hasSupport = this.checkVineSupport(ctx, this.dest.x, this.dest.y, this.dest.z);
      if (!hasSupport) return COST_INF;
    }

    return this.isVineClimb ? VINE_DOWN_ONE_COST : LADDER_DOWN_ONE_COST;
  }

  private checkVineSupport(ctx: CalculationContext, x: number, y: number, z: number): boolean {
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of directions) {
      const block = ctx.getBlock(x + dx, y, z + dz);
      if (block && block.boundingBox === 'block') {
        return true;
      }
    }
    return false;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    if (!this.helper) {
      this.initHelper(bot, ctx);
    }

    switch (this.state) {
      case MovementState.NOT_STARTED:
      case MovementState.WAITING: // Fall override entry point
        this.state = MovementState.MOVING;
        // Fall through

      case MovementState.MOVING:
        // Hold sneak to descend slowly
        bot.setControlState('sneak', true);
        bot.setControlState('jump', false);

        // Check if we've reached destination
        const pos = bot.entity.position;
        if (pos.y <= this.dest.y + 0.5) {
          this.state = MovementState.FINISHED;
        }

        this.ticksOnCurrent++;
        if (this.ticksOnCurrent > 100) {
          return MovementStatus.UNREACHABLE;
        }
        break;

      case MovementState.FINISHED:
        bot.setControlState('sneak', false);
        return MovementStatus.SUCCESS;
    }

    return MovementStatus.RUNNING;
  }
}

/**
 * MovementMountLadder - Move from ground onto a ladder/vine
 */
export class MovementMountLadder extends Movement {
  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
  }

  calculateCost(ctx: CalculationContext): number {
    // Destination should have a climbable block
    const climbBlock = ctx.getBlock(this.dest.x, this.dest.y, this.dest.z);
    if (!isClimbable(climbBlock)) return COST_INF;

    // Source should be walkable ground
    const srcFloor = ctx.getBlock(this.src.x, this.src.y - 1, this.src.z);
    if (!ctx.canWalkOn(srcFloor)) return COST_INF;

    // Path between should be clear
    const srcBody = ctx.getBlock(this.src.x, this.src.y, this.src.z);
    const srcHead = ctx.getBlock(this.src.x, this.src.y + 1, this.src.z);
    if (!ctx.canWalkThrough(srcBody)) return COST_INF;
    if (!ctx.canWalkThrough(srcHead)) return COST_INF;

    // Cost is walk to ladder + mount
    return WALK_ONE_BLOCK_COST + 1.0;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    if (!this.helper) {
      this.initHelper(bot, ctx);
    }

    switch (this.state) {
      case MovementState.NOT_STARTED:
        this.state = MovementState.MOVING;
        // Fall through

      case MovementState.MOVING:
        // Walk toward the ladder
        const pos = bot.entity.position;
        const dx = this.dest.x + 0.5 - pos.x;
        const dz = this.dest.z + 0.5 - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.3) {
          this.state = MovementState.FINISHED;
        } else {
          // Look toward ladder and walk
          const yaw = Math.atan2(-dx, dz);
          bot.look(yaw, 0);
          bot.setControlState('forward', true);
        }

        this.ticksOnCurrent++;
        if (this.ticksOnCurrent > 60) {
          return MovementStatus.UNREACHABLE;
        }
        break;

      case MovementState.FINISHED:
        bot.setControlState('forward', false);
        return MovementStatus.SUCCESS;
    }

    return MovementStatus.RUNNING;
  }
}

/**
 * MovementDismountLadder - Move from ladder/vine to adjacent ground
 */
export class MovementDismountLadder extends Movement {
  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
  }

  calculateCost(ctx: CalculationContext): number {
    // Source should have a climbable block
    const climbBlock = ctx.getBlock(this.src.x, this.src.y, this.src.z);
    if (!isClimbable(climbBlock)) return COST_INF;

    // Destination should be walkable ground
    const destFloor = ctx.getBlock(this.dest.x, this.dest.y - 1, this.dest.z);
    if (!ctx.canWalkOn(destFloor)) return COST_INF;

    // Destination body space should be clear
    const destBody = ctx.getBlock(this.dest.x, this.dest.y, this.dest.z);
    const destHead = ctx.getBlock(this.dest.x, this.dest.y + 1, this.dest.z);
    if (!ctx.canWalkThrough(destBody)) return COST_INF;
    if (!ctx.canWalkThrough(destHead)) return COST_INF;

    // Cost is dismount + walk
    return WALK_ONE_BLOCK_COST + 1.0;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    if (!this.helper) {
      this.initHelper(bot, ctx);
    }

    switch (this.state) {
      case MovementState.NOT_STARTED:
        this.state = MovementState.MOVING;
        // Fall through

      case MovementState.MOVING:
        // Look toward destination and walk off
        const pos = bot.entity.position;
        const dx = this.dest.x + 0.5 - pos.x;
        const dz = this.dest.z + 0.5 - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.3) {
          this.state = MovementState.FINISHED;
        } else {
          const yaw = Math.atan2(-dx, dz);
          bot.look(yaw, 0);
          bot.setControlState('forward', true);
          // Small jump to dismount cleanly
          if (this.ticksOnCurrent === 0) {
            bot.setControlState('jump', true);
          } else {
            bot.setControlState('jump', false);
          }
        }

        this.ticksOnCurrent++;
        if (this.ticksOnCurrent > 60) {
          return MovementStatus.UNREACHABLE;
        }
        break;

      case MovementState.FINISHED:
        bot.setControlState('forward', false);
        bot.setControlState('jump', false);
        return MovementStatus.SUCCESS;
    }

    return MovementStatus.RUNNING;
  }
}
