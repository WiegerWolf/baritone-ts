import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { Movement, MovementState } from './Movement';
import {
  LADDER_UP_ONE_COST,
  JUMP_ONE_BLOCK_COST,
  PLACE_ONE_BLOCK_COST
} from '../core/ActionCosts';

/**
 * MovementPillar: Jump straight up (tower)
 */
export class MovementPillar extends Movement {
  private hasPlacedBlock: boolean = false;
  private jumpStartY: number = 0;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check if on ladder/vine
    const currentBlock = ctx.getBlock(src.x, src.y, src.z);
    if (currentBlock?.name === 'ladder' || currentBlock?.name === 'vine') {
      // Check head clearance
      if (!this.isPassable(ctx, src.x, src.y + 2, src.z)) {
        return COST_INF;
      }
      return LADDER_UP_ONE_COST;
    }

    // Need to place block
    if (!ctx.canPlace) return COST_INF;

    // Check head clearance
    if (!this.isPassable(ctx, src.x, src.y + 2, src.z)) {
      const miningCost = this.getMiningCost(ctx, src.offset(0, 2, 0));
      if (miningCost >= COST_INF) return COST_INF;
      this.toBreak.push(src.offset(0, 2, 0));
    }

    this.toPlace.push(src);

    const cost = JUMP_ONE_BLOCK_COST + PLACE_ONE_BLOCK_COST + ctx.jumpPenalty;
    return cost;
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
        this.jumpStartY = bot.entity.position.y;
        this.state = MovementState.PLACING;
        return MovementStatus.RUNNING;

      case MovementState.BREAKING:
        this.helper!.tickBreaking().then(status => {
          if (status === MovementStatus.SUCCESS) {
            this.jumpStartY = bot.entity.position.y;
            this.state = MovementState.PLACING;
          }
        });
        return MovementStatus.RUNNING;

      case MovementState.PLACING:
        const pos = bot.entity.position;

        // Check if we're at destination
        if (pos.y >= this.dest.y && bot.entity.onGround) {
          bot.setControlState('jump', false);
          this.state = MovementState.FINISHED;
          return MovementStatus.SUCCESS;
        }

        // Jump to make room for block placement
        if (bot.entity.onGround) {
          bot.setControlState('jump', true);
          this.jumpStartY = pos.y;
        }

        // Place block when at peak of jump
        if (!this.hasPlacedBlock && pos.y > this.jumpStartY + 0.8) {
          // Look down and place
          bot.look(bot.entity.yaw, Math.PI / 2);

          // Place block below
          this.helper!.setToPlace([this.src]);
          this.helper!.tickPlacing().then(status => {
            if (status === MovementStatus.SUCCESS) {
              this.hasPlacedBlock = true;
            }
          });
        }

        return MovementStatus.RUNNING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }

  reset(): void {
    super.reset();
    this.hasPlacedBlock = false;
    this.jumpStartY = 0;
  }
}
