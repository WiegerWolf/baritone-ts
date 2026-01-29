/**
 * MLGBucketTask - Emergency Fall Damage Prevention
 * Based on BaritonePlus's MLGBucketTask.java
 *
 * WHY: Fall damage is a major cause of death in Minecraft. The "MLG water bucket"
 * technique involves placing water just before landing to negate fall damage.
 * This task automates that timing-critical maneuver.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { Dimension } from './ResourceTask';

/**
 * State for MLG bucket task
 */
enum MLGState {
  CHECKING,
  LOOKING_DOWN,
  PLACING,
  FINISHED,
  FAILED
}

/**
 * Configuration for MLGBucketTask
 */
export interface MLGConfig {
  /** Minimum fall distance to trigger MLG */
  minFallDistance: number;
  /** Height above ground to start placing water */
  placeHeight: number;
  /** Whether to pick up water after landing */
  pickupWater: boolean;
}

export const DEFAULT_CONFIG: MLGConfig = {
  minFallDistance: 4,
  placeHeight: 2,
  pickupWater: true,
};

/**
 * Task to perform MLG water bucket save.
 *
 * WHY: Taking fall damage wastes resources and can cause death.
 * By precisely timing water bucket placement, we can survive any fall.
 * This is especially critical in speedruns and high-altitude situations.
 *
 * Based on BaritonePlus MLGBucketTask.java
 */
export class MLGBucketTask extends Task {
  private config: MLGConfig;
  private state: MLGState = MLGState.CHECKING;
  private waterPlaced: boolean = false;
  private placedWaterPos: Vec3 | null = null;
  private startY: number = 0;
  private pickupAttempted: boolean = false;

  constructor(bot: Bot, config: Partial<MLGConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get displayName(): string {
    return 'MLGBucket';
  }

  onStart(): void {
    this.state = MLGState.CHECKING;
    this.waterPlaced = false;
    this.placedWaterPos = null;
    this.startY = this.bot.entity.position.y;
    this.pickupAttempted = false;
  }

  onTick(): Task | null {
    // Check dimension - water evaporates in nether
    if (this.getCurrentDimension() === Dimension.NETHER) {
      // Could use hay bale or slow falling instead
      this.state = MLGState.FAILED;
      return null;
    }

    switch (this.state) {
      case MLGState.CHECKING:
        return this.handleChecking();

      case MLGState.LOOKING_DOWN:
        return this.handleLookingDown();

      case MLGState.PLACING:
        return this.handlePlacing();

      case MLGState.FINISHED:
        return this.handlePickupWater();

      default:
        return null;
    }
  }

  private handleChecking(): Task | null {
    // Check if we have water bucket
    if (!this.hasWaterBucket()) {
      this.state = MLGState.FAILED;
      return null;
    }

    // Check if we're falling
    const velocity = this.bot.entity.velocity;
    if (velocity.y >= 0) {
      // Not falling or going up
      return null;
    }

    // Check fall distance
    const fallDistance = this.startY - this.bot.entity.position.y;
    if (fallDistance < this.config.minFallDistance) {
      // Haven't fallen enough yet
      return null;
    }

    // Start looking down
    this.state = MLGState.LOOKING_DOWN;
    return null;
  }

  private handleLookingDown(): Task | null {
    // Look straight down
    this.bot.look(this.bot.entity.yaw, Math.PI / 2); // 90 degrees down

    // Check height above ground
    const heightAboveGround = this.getHeightAboveGround();

    if (heightAboveGround <= this.config.placeHeight) {
      this.state = MLGState.PLACING;
    }

    return null;
  }

  private handlePlacing(): Task | null {
    if (this.waterPlaced) {
      // Already placed, wait to land
      if (this.bot.entity.onGround || this.isInWater()) {
        this.state = MLGState.FINISHED;
      }
      return null;
    }

    // Find block below to place water on
    const groundBlock = this.getGroundBlock();
    if (!groundBlock) {
      this.state = MLGState.FAILED;
      return null;
    }

    // Equip water bucket and place
    try {
      const waterBucket = this.bot.inventory.items().find(
        item => item.name === 'water_bucket'
      );

      if (!waterBucket) {
        this.state = MLGState.FAILED;
        return null;
      }

      // Equip water bucket
      this.bot.equip(waterBucket, 'hand');

      // Look at ground block
      const groundPos = groundBlock.position;
      this.bot.lookAt(groundPos.offset(0.5, 1, 0.5));

      // Activate (right-click) to place water
      this.bot.activateBlock(groundBlock);

      this.waterPlaced = true;
      this.placedWaterPos = groundPos.offset(0, 1, 0);
    } catch {
      // Placement failed
      this.state = MLGState.FAILED;
    }

    return null;
  }

  private handlePickupWater(): Task | null {
    // Successfully landed, optionally pick up water
    if (!this.config.pickupWater || !this.placedWaterPos) {
      return null;
    }

    if (this.pickupAttempted) {
      return null; // Already tried
    }

    // Wait until we're on ground and stable
    if (!this.bot.entity.onGround) {
      return null;
    }

    // Try to pick up water
    try {
      const bucket = this.bot.inventory.items().find(
        item => item.name === 'bucket'
      );

      if (bucket) {
        this.bot.equip(bucket, 'hand');

        const waterBlock = this.bot.blockAt(this.placedWaterPos);
        if (waterBlock && waterBlock.name === 'water') {
          this.bot.activateBlock(waterBlock);
        }
      }
    } catch {
      // Pickup failed - not critical
    }

    this.pickupAttempted = true;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.state === MLGState.FINISHED ||
           this.state === MLGState.FAILED;
  }

  isFailed(): boolean {
    return this.state === MLGState.FAILED;
  }

  // ---- Helper methods ----

  private hasWaterBucket(): boolean {
    return this.bot.inventory.items().some(item => item.name === 'water_bucket');
  }

  private getHeightAboveGround(): number {
    const pos = this.bot.entity.position;

    for (let y = Math.floor(pos.y) - 1; y >= 0; y--) {
      const block = this.bot.blockAt(new Vec3(Math.floor(pos.x), y, Math.floor(pos.z)));
      if (block && block.boundingBox === 'block') {
        return pos.y - (y + 1);
      }
    }

    return pos.y; // No ground found
  }

  private getGroundBlock(): Block | null {
    const pos = this.bot.entity.position;

    for (let y = Math.floor(pos.y) - 1; y >= 0; y--) {
      const block = this.bot.blockAt(new Vec3(Math.floor(pos.x), y, Math.floor(pos.z)));
      if (block && block.boundingBox === 'block') {
        return block;
      }
    }

    return null;
  }

  private isInWater(): boolean {
    const pos = this.bot.entity.position.floored();
    const block = this.bot.blockAt(pos);
    return block !== null && block.name === 'water';
  }

  private getCurrentDimension(): Dimension {
    const dimensionName = (this.bot as any).game?.dimension ?? 'minecraft:overworld';
    if (dimensionName.includes('nether')) return Dimension.NETHER;
    if (dimensionName.includes('end')) return Dimension.END;
    return Dimension.OVERWORLD;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof MLGBucketTask;
  }
}

/**
 * Helper to create MLG bucket task
 */
export function mlgBucket(bot: Bot): MLGBucketTask {
  return new MLGBucketTask(bot);
}

/**
 * Check if MLG bucket should be attempted right now
 */
export function shouldMLG(bot: Bot, minFallDistance: number = 4): boolean {
  // Check velocity
  const velocity = bot.entity.velocity;
  if (velocity.y >= 0) return false;

  // Check if we have water bucket
  const hasWater = bot.inventory.items().some(item => item.name === 'water_bucket');
  if (!hasWater) return false;

  // Check dimension
  const dimensionName = (bot as any).game?.dimension ?? 'minecraft:overworld';
  if (dimensionName.includes('nether')) return false;

  // Check height above ground
  const pos = bot.entity.position;
  let groundY = 0;

  for (let y = Math.floor(pos.y) - 1; y >= 0; y--) {
    const block = bot.blockAt(new Vec3(Math.floor(pos.x), y, Math.floor(pos.z)));
    if (block && block.boundingBox === 'block') {
      groundY = y + 1;
      break;
    }
  }

  const heightAboveGround = pos.y - groundY;
  return heightAboveGround > minFallDistance && heightAboveGround < 10;
}
