import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { Movement, MovementState } from './Movement';
import {
  WALK_OFF_BLOCK_COST,
  getFallCost,
  PLACE_ONE_BLOCK_COST
} from '../core/ActionCosts';
import { getMovementHelper } from './MovementHelper';

/**
 * MovementFall handles extended falls with optional water bucket cushioning
 * Based on Baritone's MovementFall
 */
export class MovementFall extends Movement {
  private readonly fallHeight: number;
  private useWaterBucket: boolean = false;
  private waterBucketPlaced: boolean = false;
  private waterBucketPickedUp: boolean = false;
  private ticksSinceLanding: number = 0;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.fallHeight = src.y - dest.y;
    // MovementFall can accept fall override from previous movements
    this.canAcceptFallOverride = true;
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check destination
    const floor = ctx.getBlock(dest.x, dest.y - 1, dest.z);

    // Check for water landing
    if (ctx.isWater(floor)) {
      // Safe water landing
      const fallCost = getFallCost(this.fallHeight, true);
      return WALK_OFF_BLOCK_COST + fallCost;
    }

    // Check if floor is solid
    if (!ctx.canWalkOn(floor)) {
      return COST_INF;
    }

    // Check fall height
    if (this.fallHeight > 3) {
      // Would take damage - check for water bucket
      if (ctx.allowWaterBucket && this.canUseWaterBucket(ctx)) {
        this.useWaterBucket = true;
        // Cost includes water bucket placement and pickup
        const fallCost = getFallCost(this.fallHeight, true); // Safe with bucket
        return WALK_OFF_BLOCK_COST + fallCost + PLACE_ONE_BLOCK_COST * 2;
      } else {
        // Calculate damage cost
        const fallCost = getFallCost(this.fallHeight, false);
        if (fallCost >= COST_INF) return COST_INF;
        return WALK_OFF_BLOCK_COST + fallCost;
      }
    }

    // Safe fall (3 blocks or less)
    const fallCost = getFallCost(this.fallHeight, false);
    return WALK_OFF_BLOCK_COST + fallCost;
  }

  /**
   * Check if water bucket cushioning is possible
   */
  private canUseWaterBucket(ctx: CalculationContext): boolean {
    // Check we have a water bucket
    const items = ctx.bot.inventory.items();
    const hasWaterBucket = items.some((item: any) => item.name === 'water_bucket');
    if (!hasWaterBucket) return false;

    // Check destination can hold water
    const destBlock = ctx.getBlock(this.dest.x, this.dest.y, this.dest.z);
    if (!ctx.canWalkThrough(destBlock)) return false;

    // Check floor below destination can support water
    const floor = ctx.getBlock(this.dest.x, this.dest.y - 1, this.dest.z);
    if (!ctx.canWalkOn(floor)) return false;

    return true;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    switch (this.state) {
      case MovementState.NOT_STARTED:
        // If fall override is active, we're already falling
        if (this.fallOverrideActive) {
          this.state = MovementState.WAITING;
          return MovementStatus.WAITING;
        }
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        // Walk toward edge
        this.helper!.moveToward(this.dest, 0.3, false, false);

        // Check if we're over the edge (falling)
        if (!bot.entity.onGround) {
          this.state = MovementState.WAITING;
        }

        return MovementStatus.RUNNING;

      case MovementState.WAITING:
        return this.tickFalling(ctx, bot);

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }

  /**
   * Handle the falling state
   */
  private tickFalling(ctx: CalculationContext, bot: any): MovementStatus {
    const pos = bot.entity.position;
    const velocity = bot.entity.velocity;
    const heightAboveGround = pos.y - this.dest.y;

    // Continue moving toward destination while falling
    this.helper!.moveToward(this.dest, 0.3, false, false);

    // Adjust look for water bucket
    if (this.useWaterBucket) {
      bot.look(bot.entity.yaw, Math.PI / 2); // Look down
    }

    // Water bucket logic
    if (this.useWaterBucket && !this.waterBucketPlaced) {
      // Place water when close to ground
      if (heightAboveGround <= 2.5 || this.ticksOnCurrent > 40) {
        this.placeWaterBucket(bot);
      }
    }

    // Check for landing
    if (bot.entity.onGround) {
      this.ticksSinceLanding++;

      // Check if we're at destination
      if (this.helper!.isAtPosition(this.dest, 0.5)) {
        // Pick up water if we placed it
        if (this.waterBucketPlaced && !this.waterBucketPickedUp) {
          if (this.ticksSinceLanding >= 3) { // Wait a moment
            this.pickupWaterBucket(bot);
            return MovementStatus.WAITING;
          }
          return MovementStatus.WAITING;
        }

        this.state = MovementState.FINISHED;
        return MovementStatus.SUCCESS;
      }
    }

    return MovementStatus.WAITING;
  }

  /**
   * Place water bucket for cushioning
   */
  private async placeWaterBucket(bot: any): Promise<void> {
    try {
      // Find water bucket in inventory
      const items = bot.inventory.items();
      const bucket = items.find((item: any) => item.name === 'water_bucket');
      if (!bucket) return;

      // Equip bucket
      await bot.equip(bucket, 'hand');

      // Use bucket (places water at looked-at position)
      await bot.activateItem();

      this.waterBucketPlaced = true;
    } catch (e) {
      // Failed to place water
    }
  }

  /**
   * Pick up the placed water
   */
  private async pickupWaterBucket(bot: any): Promise<void> {
    try {
      // Find empty bucket in inventory
      const items = bot.inventory.items();
      const bucket = items.find((item: any) => item.name === 'bucket');
      if (!bucket) {
        this.waterBucketPickedUp = true; // Skip if no empty bucket
        return;
      }

      // Equip bucket
      await bot.equip(bucket, 'hand');

      // Look at water
      const waterPos = this.dest;
      const waterBlock = bot.blockAt({ x: waterPos.x, y: waterPos.y, z: waterPos.z });

      if (waterBlock && (waterBlock.name === 'water' || waterBlock.name === 'flowing_water')) {
        await bot.lookAt({
          x: waterPos.x + 0.5,
          y: waterPos.y + 0.5,
          z: waterPos.z + 0.5
        });
        await bot.activateItem();
      }

      this.waterBucketPickedUp = true;
    } catch (e) {
      this.waterBucketPickedUp = true; // Consider it done on error
    }
  }

  /**
   * Get valid positions during fall
   */
  getValidPositions(): BlockPos[] {
    const positions = [this.src];

    // Include all positions in the fall path
    for (let y = this.src.y - 1; y >= this.dest.y; y--) {
      positions.push(new BlockPos(this.dest.x, y, this.dest.z));
    }

    positions.push(this.dest);
    return positions;
  }

  /**
   * Reset movement state
   */
  reset(): void {
    super.reset();
    this.waterBucketPlaced = false;
    this.waterBucketPickedUp = false;
    this.ticksSinceLanding = 0;
  }
}

/**
 * Calculate dynamic fall cost by scanning downward
 * Returns the landing position and cost, or null if no safe landing
 */
export function dynamicFallCost(
  ctx: CalculationContext,
  startX: number,
  startY: number,
  startZ: number,
  destX: number,
  destZ: number,
  maxFall: number = 256
): { landingY: number; cost: number; waterLanding: boolean } | null {
  let currentY = startY - 1;
  let fallDistance = 1;

  const minY = (ctx.bot.game as any)?.minY ?? -64;
  while (currentY >= minY && fallDistance <= maxFall) {
    const block = ctx.getBlock(destX, currentY, destZ);
    const blockAbove = ctx.getBlock(destX, currentY + 1, destZ);

    // Check for water landing
    if (ctx.isWater(block)) {
      return {
        landingY: currentY,
        cost: WALK_OFF_BLOCK_COST + getFallCost(fallDistance, true),
        waterLanding: true
      };
    }

    // Check for solid landing
    if (ctx.canWalkOn(block)) {
      // Make sure there's head space
      if (ctx.canWalkThrough(blockAbove)) {
        const damageFall = fallDistance > 3;
        const cost = WALK_OFF_BLOCK_COST + getFallCost(fallDistance, false);

        if (cost >= COST_INF) return null;

        return {
          landingY: currentY + 1, // Stand on top of the block
          cost,
          waterLanding: false
        };
      }
    }

    // Check for vines/ladders that would slow fall
    if (block?.name === 'ladder' || block?.name === 'vine') {
      // Can grab onto climbable - resets fall distance
      fallDistance = 0;
    }

    // Check for lava (bad!)
    if (ctx.isLava(block)) {
      return null;
    }

    // Continue falling
    currentY--;
    fallDistance++;
  }

  return null; // No safe landing found
}
