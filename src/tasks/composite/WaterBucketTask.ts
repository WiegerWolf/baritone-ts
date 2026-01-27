/**
 * WaterBucketTask - MLG Water Bucket Automation
 * Based on AltoClef MLGBucketTask patterns
 *
 * Handles placing water bucket to prevent fall damage,
 * with physics-based timing and landing prediction.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for water bucket placement
 */
enum WaterBucketState {
  MONITORING,
  FALLING,
  PREPARING,
  PLACING,
  COLLECTING,
  FINISHED,
  FAILED
}

/**
 * Configuration for water bucket task
 */
export interface WaterBucketConfig {
  /** Minimum fall velocity to trigger (blocks/tick) */
  triggerVelocity: number;
  /** Minimum height to trigger (blocks) */
  minHeight: number;
  /** Whether to collect water after landing */
  collectWater: boolean;
  /** Time to wait before collecting (seconds) */
  collectDelay: number;
}

const DEFAULT_CONFIG: WaterBucketConfig = {
  triggerVelocity: -0.7,
  minHeight: 4,
  collectWater: true,
  collectDelay: 0.5,
};

/**
 * Physics constants
 */
const GRAVITY = 0.08; // blocks/tick^2
const TERMINAL_VELOCITY = -3.92; // blocks/tick

/**
 * Task for MLG water bucket placement
 */
export class WaterBucketTask extends Task {
  private config: WaterBucketConfig;
  private state: WaterBucketState = WaterBucketState.MONITORING;
  private landingPosition: Vec3 | null = null;
  private placedWaterAt: Vec3 | null = null;
  private collectTimer: TimerGame;
  private placeTimer: TimerGame;
  private startY: number = 0;

  constructor(bot: Bot, config: Partial<WaterBucketConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.collectTimer = new TimerGame(bot, this.config.collectDelay);
    this.placeTimer = new TimerGame(bot, 0.25);
  }

  get displayName(): string {
    return `WaterBucket(${WaterBucketState[this.state]})`;
  }

  onStart(): void {
    this.state = WaterBucketState.MONITORING;
    this.landingPosition = null;
    this.placedWaterAt = null;
    this.startY = this.bot.entity.position.y;
  }

  onTick(): Task | null {
    switch (this.state) {
      case WaterBucketState.MONITORING:
        return this.handleMonitoring();

      case WaterBucketState.FALLING:
        return this.handleFalling();

      case WaterBucketState.PREPARING:
        return this.handlePreparing();

      case WaterBucketState.PLACING:
        return this.handlePlacing();

      case WaterBucketState.COLLECTING:
        return this.handleCollecting();

      default:
        return null;
    }
  }

  private handleMonitoring(): Task | null {
    const velocity = this.bot.entity.velocity;

    // Check if falling fast enough
    if (velocity.y < this.config.triggerVelocity) {
      // Check height above ground
      const heightAboveGround = this.getHeightAboveGround();
      if (heightAboveGround >= this.config.minHeight) {
        this.state = WaterBucketState.FALLING;
        this.startY = this.bot.entity.position.y;
      }
    }

    return null;
  }

  private handleFalling(): Task | null {
    // Calculate landing position
    this.landingPosition = this.predictLandingPosition();

    if (!this.landingPosition) {
      // Can't determine landing, abort
      this.state = WaterBucketState.FAILED;
      return null;
    }

    // Check if we have water bucket
    if (!this.hasWaterBucket()) {
      this.state = WaterBucketState.FAILED;
      return null;
    }

    this.state = WaterBucketState.PREPARING;
    return null;
  }

  private handlePreparing(): Task | null {
    // Equip water bucket
    if (!this.equipWaterBucket()) {
      this.state = WaterBucketState.FAILED;
      return null;
    }

    // Look at landing position
    if (this.landingPosition) {
      const pos = this.bot.entity.position;
      const dx = this.landingPosition.x - pos.x;
      const dy = this.landingPosition.y - pos.y;
      const dz = this.landingPosition.z - pos.z;
      const yaw = Math.atan2(-dx, dz);
      const dist = Math.sqrt(dx * dx + dz * dz);
      const pitch = Math.atan2(-dy, dist);
      this.bot.look(yaw, pitch, true);
    }

    this.state = WaterBucketState.PLACING;
    this.placeTimer.reset();
    return null;
  }

  private handlePlacing(): Task | null {
    // Calculate when to place water
    const heightAboveGround = this.getHeightAboveGround();
    const velocity = this.bot.entity.velocity;

    // Place water when close to ground (3-4 blocks)
    if (heightAboveGround <= 3.5 && heightAboveGround > 0) {
      this.placeWater();
      this.placedWaterAt = this.landingPosition?.clone() ?? null;
      this.state = WaterBucketState.COLLECTING;
      this.collectTimer.reset();
    }

    // Check if we landed without placing
    if (this.bot.entity.onGround) {
      if (this.placedWaterAt) {
        this.state = WaterBucketState.COLLECTING;
        this.collectTimer.reset();
      } else {
        // Didn't place water, check if we took damage
        this.state = WaterBucketState.FINISHED;
      }
    }

    return null;
  }

  private handleCollecting(): Task | null {
    if (!this.config.collectWater || !this.placedWaterAt) {
      this.state = WaterBucketState.FINISHED;
      return null;
    }

    // Wait for collect delay
    if (!this.collectTimer.elapsed()) {
      return null;
    }

    // Collect the water
    this.collectWater();
    this.state = WaterBucketState.FINISHED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.landingPosition = null;
    this.placedWaterAt = null;
  }

  isFinished(): boolean {
    return this.state === WaterBucketState.FINISHED || this.state === WaterBucketState.FAILED;
  }

  isFailed(): boolean {
    return this.state === WaterBucketState.FAILED;
  }

  // ---- Helper Methods ----

  private getHeightAboveGround(): number {
    const pos = this.bot.entity.position;

    for (let dy = 0; dy <= 60; dy++) {
      const checkPos = new Vec3(
        Math.floor(pos.x),
        Math.floor(pos.y) - dy,
        Math.floor(pos.z)
      );
      const block = this.bot.blockAt(checkPos);

      if (block && block.boundingBox !== 'empty') {
        return pos.y - checkPos.y - 1;
      }
    }

    return 60; // No ground found
  }

  private predictLandingPosition(): Vec3 | null {
    const pos = this.bot.entity.position;
    const velocity = this.bot.entity.velocity;

    // Simple prediction: current XZ, find ground Y
    let predictedY = pos.y;
    let currentVelocityY = velocity.y;

    for (let ticks = 0; ticks < 200; ticks++) {
      currentVelocityY = Math.max(currentVelocityY - GRAVITY, TERMINAL_VELOCITY);
      predictedY += currentVelocityY;

      const checkPos = new Vec3(
        Math.floor(pos.x),
        Math.floor(predictedY),
        Math.floor(pos.z)
      );
      const block = this.bot.blockAt(checkPos);

      if (block && block.boundingBox !== 'empty') {
        return new Vec3(
          Math.floor(pos.x) + 0.5,
          Math.floor(predictedY) + 1,
          Math.floor(pos.z) + 0.5
        );
      }
    }

    return null;
  }

  private hasWaterBucket(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'water_bucket') {
        return true;
      }
    }
    return false;
  }

  private equipWaterBucket(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'water_bucket') {
        try {
          this.bot.equip(item, 'hand');
          return true;
        } catch {
          // May fail
        }
      }
    }
    return false;
  }

  private placeWater(): void {
    try {
      this.bot.activateItem();
    } catch {
      // May fail
    }
  }

  private collectWater(): void {
    // Need empty bucket equipped
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'bucket') {
        try {
          this.bot.equip(item, 'hand');
          this.bot.activateItem();
        } catch {
          // May fail
        }
        break;
      }
    }
  }

  /**
   * Get current state
   */
  getCurrentState(): WaterBucketState {
    return this.state;
  }

  /**
   * Get landing position
   */
  getLandingPosition(): Vec3 | null {
    return this.landingPosition;
  }

  /**
   * Check if water was placed
   */
  wasWaterPlaced(): boolean {
    return this.placedWaterAt !== null;
  }

  /**
   * Manually trigger MLG
   */
  triggerMLG(): void {
    this.state = WaterBucketState.FALLING;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof WaterBucketTask;
  }
}

/**
 * Convenience functions
 */
export function mlgWaterBucket(bot: Bot): WaterBucketTask {
  return new WaterBucketTask(bot);
}

export function mlgWithCollect(bot: Bot): WaterBucketTask {
  return new WaterBucketTask(bot, { collectWater: true });
}

export function mlgNoCollect(bot: Bot): WaterBucketTask {
  return new WaterBucketTask(bot, { collectWater: false });
}

export function mlgSensitive(bot: Bot): WaterBucketTask {
  return new WaterBucketTask(bot, {
    triggerVelocity: -0.5,
    minHeight: 3,
  });
}
