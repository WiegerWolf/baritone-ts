/**
 * MLGBucketChain - Fall Damage Prevention
 * Based on AltoClef's MLGBucketFallChain.java and MLGBucketTask.java
 *
 * Automatically places water bucket to prevent fall damage.
 * Uses physics-based calculations and cone casting for accurate timing.
 *
 * Priority: 100 when falling (can interrupt grounded tasks)
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import type { Block } from 'prismarine-block';
import { SingleTaskChain, ChainPriority } from '../tasks/TaskChain';
import { Task } from '../tasks/Task';
import { TimerGame } from '../utils/timers/TimerGame';

/**
 * Physics constants for fall prediction
 */
const GRAVITY = 0.08; // blocks/tick²
const DRAG = 0.02; // air resistance per tick
const HORIZONTAL_SPEED = 0.25; // conservative horizontal movement blocks/tick
const TERMINAL_VELOCITY = 3.92; // max fall speed blocks/tick

/**
 * MLG configuration
 */
export interface MLGBucketConfig {
  /** Minimum fall velocity to trigger MLG (default: -0.7) */
  triggerVelocity: number;
  /** Maximum look ahead distance for landing prediction (default: 40) */
  lookAheadBlocks: number;
  /** Cone pitch angle for landing search (default: 25 degrees) */
  conePitchAngle: number;
  /** Yaw divisions for cone cast (default: 12) */
  coneYawDivisions: number;
  /** Time between bucket attempts (default: 0.25 seconds) */
  bucketCooldown: number;
}

const DEFAULT_CONFIG: MLGBucketConfig = {
  triggerVelocity: -0.7,
  lookAheadBlocks: 40,
  conePitchAngle: 25,
  coneYawDivisions: 12,
  bucketCooldown: 0.25,
};

/**
 * Landing spot with metadata
 */
interface LandingSpot {
  position: Vec3;
  distanceSq: number;
  canReachInTime: boolean;
  isWater: boolean;
  blockBelow: Block | null;
}

/**
 * Task to perform MLG water bucket
 */
class MLGBucketTask extends Task {
  readonly displayName = 'MLGBucket';

  private config: MLGBucketConfig;
  private bucketTimer: TimerGame;
  private targetSpot: Vec3 | null = null;
  private placed: boolean = false;
  private hasBucket: boolean = false;

  // Marker interface for overriding grounded safety
  readonly overridesGrounded = true;

  constructor(bot: Bot, config: MLGBucketConfig) {
    super(bot);
    this.config = config;
    this.bucketTimer = new TimerGame(bot, config.bucketCooldown);
    this.bucketTimer.forceElapsed();
  }

  onStart(): void {
    this.hasBucket = this.hasWaterBucket();
    this.placed = false;
  }

  onTick(): Task | null {
    if (!this.hasBucket) {
      return null; // No bucket, can't MLG
    }

    // Find best landing spot
    this.targetSpot = this.findBestLandingSpot();
    if (!this.targetSpot) {
      return null;
    }

    // Look at target
    this.lookAtTarget(this.targetSpot);

    // Calculate if we should place now
    const shouldPlace = this.shouldPlaceNow();

    if (shouldPlace && this.bucketTimer.elapsed()) {
      this.placeWater();
      this.bucketTimer.reset();
    }

    // Steer toward target
    this.steerToward(this.targetSpot);

    return null;
  }

  /**
   * Check if we have a water bucket
   */
  private hasWaterBucket(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'water_bucket') {
        return true;
      }
    }
    return false;
  }

  /**
   * Find the best landing spot using cone casting
   */
  private findBestLandingSpot(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const velocity = this.bot.entity.velocity;

    // Calculate predicted landing area
    const fallTime = this.calculateFallTime(playerPos.y, velocity.y);
    const maxHorizontalDist = HORIZONTAL_SPEED * fallTime;

    let bestSpot: LandingSpot | null = null;
    let bestScore = -Infinity;

    // Cone cast from player position
    for (let pitch = this.config.conePitchAngle; pitch <= 90; pitch += 5) {
      const pitchRad = pitch * Math.PI / 180;
      const numYaw = Math.floor(this.config.coneYawDivisions * (90 - pitch) / 90) + 1;

      for (let yawIdx = 0; yawIdx < numYaw; yawIdx++) {
        const yaw = (yawIdx / numYaw) * 360;
        const yawRad = yaw * Math.PI / 180;

        // Calculate ray direction
        const dir = new Vec3(
          Math.sin(yawRad) * Math.cos(pitchRad),
          -Math.sin(pitchRad),
          Math.cos(yawRad) * Math.cos(pitchRad)
        ).normalize();

        // Cast ray to find landing block
        const hit = this.raycast(playerPos, dir, this.config.lookAheadBlocks);
        if (!hit) continue;

        const distSq = hit.distanceSquared(playerPos);
        const horizontalDist = Math.sqrt(
          Math.pow(hit.x - playerPos.x, 2) +
          Math.pow(hit.z - playerPos.z, 2)
        );

        const canReach = horizontalDist <= maxHorizontalDist;
        const blockBelow = this.bot.blockAt(hit.offset(0, -1, 0));
        const isWater = blockBelow?.name === 'water';

        const spot: LandingSpot = {
          position: hit,
          distanceSq: distSq,
          canReachInTime: canReach,
          isWater,
          blockBelow,
        };

        // Score the spot
        const score = this.scoreLandingSpot(spot);
        if (score > bestScore) {
          bestScore = score;
          bestSpot = spot;
        }
      }
    }

    return bestSpot?.position ?? null;
  }

  /**
   * Score a landing spot (higher = better)
   */
  private scoreLandingSpot(spot: LandingSpot): number {
    let score = 0;

    // Strongly prefer spots we can reach
    if (!spot.canReachInTime) {
      return -1000;
    }

    // Prefer water (already safe!)
    if (spot.isWater) {
      return 1000;
    }

    // Prefer closer spots
    score -= spot.distanceSq * 0.01;

    // Prefer solid ground
    if (spot.blockBelow && spot.blockBelow.boundingBox !== 'empty') {
      score += 10;
    }

    // Avoid lava
    if (spot.blockBelow?.name === 'lava') {
      score -= 500;
    }

    return score;
  }

  /**
   * Calculate fall time in ticks
   */
  private calculateFallTime(height: number, initialVelocity: number): number {
    // Simple physics: t = (-v + sqrt(v² + 2gh)) / g
    const g = GRAVITY;
    const v = Math.abs(initialVelocity);
    const h = Math.max(0, height - ((this.bot.game as any)?.minY ?? -64));

    return (-v + Math.sqrt(v * v + 2 * g * h)) / g;
  }

  /**
   * Check if we should place water now
   */
  private shouldPlaceNow(): boolean {
    if (!this.targetSpot) return false;

    const playerPos = this.bot.entity.position;
    const velocity = this.bot.entity.velocity;

    // Calculate distance to target
    const verticalDist = playerPos.y - this.targetSpot.y;
    const horizontalDist = Math.sqrt(
      Math.pow(this.targetSpot.x - playerPos.x, 2) +
      Math.pow(this.targetSpot.z - playerPos.z, 2)
    );

    // Calculate time to impact
    const fallVelocity = Math.abs(velocity.y);
    const ticksToImpact = this.calculateFallTime(verticalDist, velocity.y);

    // Place when we're close and falling fast
    // Account for reaction time (4 ticks) and network latency
    const placeThreshold = Math.min(8, Math.max(3, fallVelocity * 3));

    return verticalDist < placeThreshold && velocity.y < -0.5;
  }

  /**
   * Place water at target location
   */
  private async placeWater(): Promise<void> {
    if (this.placed) return;

    try {
      // Equip water bucket
      const bucket = this.bot.inventory.items().find(i => i.name === 'water_bucket');
      if (!bucket) return;

      await this.bot.equip(bucket, 'hand');

      // Use bucket (right click)
      this.bot.activateItem();
      this.placed = true;

      // Pick up water after landing (wait a bit)
      setTimeout(() => {
        this.pickUpWater();
      }, 500);
    } catch (err) {
      // Failed to place
    }
  }

  /**
   * Pick up the placed water
   */
  private async pickUpWater(): Promise<void> {
    try {
      const bucket = this.bot.inventory.items().find(i => i.name === 'bucket');
      if (!bucket) return;

      await this.bot.equip(bucket, 'hand');
      this.bot.activateItem();
    } catch (err) {
      // Failed to pick up
    }
  }

  /**
   * Look at target position
   */
  private lookAtTarget(target: Vec3): void {
    const delta = target.minus(this.bot.entity.position);
    const yaw = Math.atan2(-delta.x, delta.z);
    const pitch = Math.atan2(delta.y, Math.sqrt(delta.x * delta.x + delta.z * delta.z));

    this.bot.look(yaw, pitch, true);
  }

  /**
   * Steer toward target using movement controls
   */
  private steerToward(target: Vec3): void {
    const playerPos = this.bot.entity.position;
    const velocity = this.bot.entity.velocity;

    // Calculate desired direction
    const toTarget = target.minus(playerPos);
    const horizontalTarget = new Vec3(toTarget.x, 0, toTarget.z).normalize();

    // Current horizontal velocity
    const horizontalVel = new Vec3(velocity.x, 0, velocity.z);

    // Calculate steering
    const forward = horizontalTarget.dot(horizontalVel) < 0.5;
    const right = horizontalTarget.cross(new Vec3(0, 1, 0)).dot(horizontalVel);

    this.bot.setControlState('forward', forward);
    this.bot.setControlState('sprint', true);
    this.bot.setControlState('left', right > 0.1);
    this.bot.setControlState('right', right < -0.1);
  }

  /**
   * Simple raycast for finding landing blocks
   */
  private raycast(start: Vec3, dir: Vec3, maxDist: number): Vec3 | null {
    const step = 0.5;
    const steps = Math.ceil(maxDist / step);

    for (let i = 1; i <= steps; i++) {
      const pos = start.plus(dir.scaled(i * step));
      const block = this.bot.blockAt(pos);

      if (block && block.boundingBox !== 'empty') {
        return pos;
      }

      // Stop at world bottom
      if (pos.y < ((this.bot.game as any)?.minY ?? -64)) {
        return null;
      }
    }

    return null;
  }

  onStop(): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    // Finished when on ground or in water
    return this.bot.entity.onGround || (this.bot.entity as any).isInWater;
  }
}

/**
 * MLGBucketChain - Automatic fall damage prevention
 */
export class MLGBucketChain extends SingleTaskChain {
  readonly displayName = 'MLGBucketChain';

  private config: MLGBucketConfig;

  constructor(bot: Bot, config: Partial<MLGBucketConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getPriority(): number {
    if (this.isFalling()) {
      return ChainPriority.DANGER;
    }
    return ChainPriority.INACTIVE;
  }

  isActive(): boolean {
    return this.isFalling() && this.hasWaterBucket() && this.wouldDieFromFall();
  }

  protected getTaskForTick(): Task | null {
    if (!this.isActive()) return null;
    return new MLGBucketTask(this.bot, this.config);
  }

  /**
   * Check if player is falling fast enough to trigger MLG
   */
  isFalling(): boolean {
    const velocity = this.bot.entity.velocity;
    return velocity.y < this.config.triggerVelocity;
  }

  /**
   * Check if player has a water bucket
   */
  hasWaterBucket(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'water_bucket') {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if the fall would be fatal
   */
  wouldDieFromFall(): boolean {
    const playerPos = this.bot.entity.position;
    const velocity = this.bot.entity.velocity;
    const health = this.bot.health;

    // Find ground below
    let groundY = (this.bot.game as any)?.minY ?? -64;
    for (let dy = 0; dy < 100; dy++) {
      const pos = playerPos.offset(0, -dy, 0);
      const block = this.bot.blockAt(pos);
      if (block && block.boundingBox !== 'empty') {
        groundY = pos.y + 1;
        break;
      }
    }

    // Calculate fall distance
    const fallDistance = playerPos.y - groundY;
    if (fallDistance < 4) return false; // Safe fall

    // Calculate damage (1 heart per block above 3)
    const damage = Math.max(0, fallDistance - 3);

    return damage >= health;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<MLGBucketConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---- Debug ----

  getDebugInfo(): string {
    return [
      `MLGBucketChain`,
      `  Falling: ${this.isFalling()}`,
      `  Has bucket: ${this.hasWaterBucket()}`,
      `  Would die: ${this.wouldDieFromFall()}`,
      `  Velocity Y: ${this.bot.entity.velocity.y.toFixed(2)}`,
    ].join('\n');
  }
}
