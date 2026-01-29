import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { Movement, MovementState } from './Movement';
import {
  WALK_ONE_BLOCK_COST,
  JUMP_ONE_BLOCK_COST,
  PLACE_ONE_BLOCK_COST
} from '../core/ActionCosts';

/**
 * MovementAscend: Jump up one block
 */
export class MovementAscend extends Movement {
  private jumped: boolean = false;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check destination floor
    if (!this.isSolid(ctx, dest.x, dest.y - 1, dest.z)) {
      // Need to place a block to jump onto
      if (!ctx.canPlace) return COST_INF;

      this.toPlace.push(dest.offset(0, -1, 0));
    }

    // Check head clearance at source
    if (!this.isPassable(ctx, src.x, src.y + 2, src.z)) {
      const miningCost = this.getMiningCost(ctx, src.offset(0, 2, 0));
      if (miningCost >= COST_INF) return COST_INF;
      this.toBreak.push(src.offset(0, 2, 0));
    }

    // Check body space at destination
    const obstacleCost = this.getObstacleCost(ctx, [
      dest.offset(0, 0, 0),
      dest.offset(0, 1, 0)
    ]);
    if (obstacleCost >= COST_INF) return COST_INF;

    // Calculate cost
    let cost = WALK_ONE_BLOCK_COST + JUMP_ONE_BLOCK_COST + ctx.jumpPenalty + obstacleCost;

    if (this.toPlace.length > 0) {
      cost += PLACE_ONE_BLOCK_COST;
    }

    return cost * ctx.getFavoring(dest.x, dest.y, dest.z);
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    switch (this.state) {
      case MovementState.NOT_STARTED:
        if (this.toBreak.length > 0) {
          this.helper!.setToBreak(this.toBreak);
          this.state = MovementState.BREAKING;
          return MovementStatus.PREPPING;
        }
        if (this.toPlace.length > 0) {
          this.helper!.setToPlace(this.toPlace);
          this.state = MovementState.PLACING;
          return MovementStatus.PREPPING;
        }
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.BREAKING:
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
        this.helper!.tickPlacing().then(status => {
          if (status === MovementStatus.SUCCESS || status === MovementStatus.FAILED) {
            this.state = MovementState.MOVING;
          }
        });
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        // Check if we've reached destination
        if (this.helper!.isAtPosition(this.dest, 0.3)) {
          this.state = MovementState.FINISHED;
          bot.setControlState('jump', false);
          return MovementStatus.SUCCESS;
        }

        // Jump and move toward destination
        const pos = bot.entity.position;
        const atSrc = Math.abs(pos.x - (this.src.x + 0.5)) < 0.4 &&
                      Math.abs(pos.z - (this.src.z + 0.5)) < 0.4;

        // Only jump when at source and on ground
        if (atSrc && bot.entity.onGround && !this.jumped) {
          bot.setControlState('jump', true);
          this.jumped = true;
        } else if (this.jumped && !bot.entity.onGround) {
          bot.setControlState('jump', false);
        }

        // Move toward destination
        this.helper!.moveToward(this.dest, 0.25, false, false);
        return MovementStatus.RUNNING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }

  reset(): void {
    super.reset();
    this.jumped = false;
  }
}
