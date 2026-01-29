import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { Movement } from './Movement';
import { MovementState } from './MovementState';
import {
  WALK_ONE_BLOCK_COST,
  SPRINT_MULTIPLIER,
  SNEAK_ONE_BLOCK_COST,
  WALK_ONE_IN_WATER_COST,
  WALK_ONE_OVER_SOUL_SAND_COST,
  PLACE_ONE_BLOCK_COST,
  BACKPLACE_ADDITIONAL_PENALTY
} from '../core/ActionCosts';

/**
 * MovementTraverse: Horizontal movement on same Y level
 */
export class MovementTraverse extends Movement {
  private readonly direction: { dx: number; dz: number };

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.direction = {
      dx: dest.x - src.x,
      dz: dest.z - src.z
    };
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check destination floor
    if (!this.isSolid(ctx, dest.x, dest.y - 1, dest.z)) {
      // Need to place a block (bridging)
      if (!ctx.canPlace) return COST_INF;

      // Calculate placement cost
      const placeCost = PLACE_ONE_BLOCK_COST;
      const needBackplace = !this.isSolid(ctx, src.x, src.y - 1, src.z + this.direction.dz) &&
        !this.isSolid(ctx, src.x + this.direction.dx, src.y - 1, src.z);
      const backplacePenalty = needBackplace ? BACKPLACE_ADDITIONAL_PENALTY : 0;

      this.toPlace.push(dest.offset(0, -1, 0));

      // Can't sprint while bridging
      const walkCost = WALK_ONE_BLOCK_COST + placeCost + backplacePenalty;
      return walkCost * ctx.getFavoring(dest.x, dest.y, dest.z);
    }

    // Check body space
    const obstacleCost = this.getObstacleCost(ctx, [
      dest.offset(0, 0, 0),  // Feet level
      dest.offset(0, 1, 0)   // Head level
    ]);
    if (obstacleCost >= COST_INF) return COST_INF;

    // Calculate base cost
    let cost = WALK_ONE_BLOCK_COST + obstacleCost;

    // Apply terrain modifiers
    const floor = ctx.getBlock(dest.x, dest.y - 1, dest.z);
    if (floor?.name === 'soul_sand' || floor?.name === 'soul_soil') {
      cost = WALK_ONE_OVER_SOUL_SAND_COST + obstacleCost;
    } else if (floor?.name === 'magma_block') {
      cost = SNEAK_ONE_BLOCK_COST + obstacleCost;
    }

    // Check for water
    const bodyBlock = ctx.getBlock(dest.x, dest.y, dest.z);
    if (ctx.isWater(bodyBlock)) {
      cost = WALK_ONE_IN_WATER_COST + obstacleCost;
    }

    // Apply sprint if no obstacles and allowed
    if (obstacleCost === 0 && ctx.allowSprint && !ctx.isWater(bodyBlock)) {
      cost *= SPRINT_MULTIPLIER;
    }

    return cost * ctx.getFavoring(dest.x, dest.y, dest.z);
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    switch (this.state) {
      case MovementState.NOT_STARTED:
        // Check if we need to break blocks
        if (this.toBreak.length > 0) {
          this.helper!.setToBreak(this.toBreak);
          this.state = MovementState.BREAKING;
          return MovementStatus.PREPPING;
        }
        // Check if we need to place blocks
        if (this.toPlace.length > 0) {
          this.helper!.setToPlace(this.toPlace);
          this.state = MovementState.PLACING;
          return MovementStatus.PREPPING;
        }
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.BREAKING:
        // Use helper for breaking
        this.helper!.tickBreaking().then(status => {
          if (status === MovementStatus.SUCCESS) {
            if (this.toPlace.length > 0) {
              this.helper!.setToPlace(this.toPlace);
              this.state = MovementState.PLACING;
            } else {
              this.state = MovementState.MOVING;
            }
          }
        });
        return MovementStatus.RUNNING;

      case MovementState.PLACING:
        // Use helper for placing (bridging)
        this.helper!.tickPlacing().then(status => {
          if (status === MovementStatus.SUCCESS || status === MovementStatus.FAILED) {
            this.state = MovementState.MOVING;
          }
        });
        // While placing, sneak to avoid falling
        bot.setControlState('sneak', true);
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        bot.setControlState('sneak', false);

        // Check if we've reached destination
        if (this.helper!.isAtPosition(this.dest)) {
          this.state = MovementState.FINISHED;
          return MovementStatus.SUCCESS;
        }

        // Move toward destination
        this.helper!.moveToward(this.dest, 0.25, ctx.allowSprint);
        return MovementStatus.RUNNING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }
}
