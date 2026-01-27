/**
 * LookHelper - Rotation Calculations
 * Based on AltoClef's LookHelper.java
 *
 * Provides utilities for:
 * - Calculating look angles to positions/entities
 * - Smooth rotation interpolation
 * - Look prediction for moving targets
 * - Random look offsets for human-like behavior
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';

/**
 * Rotation angles (yaw and pitch)
 */
export interface LookRotation {
  yaw: number;   // Horizontal angle (0-360 degrees)
  pitch: number; // Vertical angle (-90 to 90 degrees)
}

/**
 * Configuration for look behavior
 */
export interface LookConfig {
  /** Maximum yaw change per tick (degrees) */
  maxYawSpeed: number;
  /** Maximum pitch change per tick (degrees) */
  maxPitchSpeed: number;
  /** Random offset range for human-like looking */
  humanizeOffset: number;
  /** Enable smooth interpolation */
  smoothLook: boolean;
}

const DEFAULT_CONFIG: LookConfig = {
  maxYawSpeed: 45,   // 45 degrees per tick = ~900 deg/sec
  maxPitchSpeed: 30, // 30 degrees per tick
  humanizeOffset: 2, // +/- 2 degrees random offset
  smoothLook: true,
};

/**
 * LookHelper - Rotation utility class
 */
export class LookHelper {
  private bot: Bot;
  private config: LookConfig;
  private targetRotation: LookRotation | null = null;
  private lookingAt: Vec3 | Entity | null = null;

  constructor(bot: Bot, config: Partial<LookConfig> = {}) {
    this.bot = bot;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get rotation needed to look at a position
   */
  getRotationTo(target: Vec3): LookRotation {
    const eyePos = this.getEyePosition();
    return this.calculateRotation(eyePos, target);
  }

  /**
   * Get rotation needed to look at an entity
   */
  getRotationToEntity(entity: Entity): LookRotation {
    const eyePos = this.getEyePosition();
    const targetPos = this.getEntityEyePosition(entity);
    return this.calculateRotation(eyePos, targetPos);
  }

  /**
   * Get rotation to entity with velocity prediction
   */
  getRotationToEntityPredicted(entity: Entity, ticksAhead: number = 3): LookRotation {
    const eyePos = this.getEyePosition();
    let targetPos = this.getEntityEyePosition(entity);

    // Add velocity prediction
    if (entity.velocity) {
      targetPos = targetPos.offset(
        entity.velocity.x * ticksAhead,
        entity.velocity.y * ticksAhead,
        entity.velocity.z * ticksAhead
      );
    }

    return this.calculateRotation(eyePos, targetPos);
  }

  /**
   * Calculate rotation from source to target position
   */
  calculateRotation(from: Vec3, to: Vec3): LookRotation {
    const delta = to.minus(from);
    const horizontalDist = Math.sqrt(delta.x * delta.x + delta.z * delta.z);

    // Calculate yaw (horizontal angle)
    // Minecraft yaw: 0 = south, 90 = west, 180 = north, -90 = east
    const yaw = -Math.atan2(delta.x, delta.z) * (180 / Math.PI);

    // Calculate pitch (vertical angle)
    // Negative = look up, positive = look down
    const pitch = -Math.atan2(delta.y, horizontalDist) * (180 / Math.PI);

    return { yaw: this.normalizeAngle(yaw), pitch };
  }

  /**
   * Get current bot rotation
   */
  getCurrentRotation(): LookRotation {
    return {
      yaw: this.bot.entity.yaw * (180 / Math.PI),
      pitch: this.bot.entity.pitch * (180 / Math.PI),
    };
  }

  /**
   * Look at a position instantly
   */
  async lookAt(target: Vec3): Promise<void> {
    await this.bot.lookAt(target);
  }

  /**
   * Look at an entity instantly
   */
  async lookAtEntity(entity: Entity): Promise<void> {
    const targetPos = this.getEntityEyePosition(entity);
    await this.bot.lookAt(targetPos);
  }

  /**
   * Start smoothly looking at a position
   */
  startLookingAt(target: Vec3 | Entity): void {
    this.lookingAt = target;
    this.updateTargetRotation();
  }

  /**
   * Stop smooth looking
   */
  stopLooking(): void {
    this.lookingAt = null;
    this.targetRotation = null;
  }

  /**
   * Update smooth look (call each tick)
   */
  async tick(): Promise<void> {
    if (!this.lookingAt) return;

    // Update target rotation
    this.updateTargetRotation();
    if (!this.targetRotation) return;

    // Get current rotation
    const current = this.getCurrentRotation();

    // Calculate interpolated rotation
    const newRotation = this.config.smoothLook
      ? this.interpolateRotation(current, this.targetRotation)
      : this.targetRotation;

    // Apply rotation
    await this.setRotation(newRotation);
  }

  /**
   * Set bot rotation directly
   */
  async setRotation(rotation: LookRotation): Promise<void> {
    const yawRad = rotation.yaw * (Math.PI / 180);
    const pitchRad = rotation.pitch * (Math.PI / 180);
    await this.bot.look(yawRad, pitchRad);
  }

  /**
   * Check if looking at a position (within tolerance)
   */
  isLookingAt(target: Vec3, tolerance: number = 5): boolean {
    const targetRotation = this.getRotationTo(target);
    const current = this.getCurrentRotation();
    return this.rotationWithin(current, targetRotation, tolerance);
  }

  /**
   * Check if looking at an entity (within tolerance)
   */
  isLookingAtEntity(entity: Entity, tolerance: number = 10): boolean {
    const targetRotation = this.getRotationToEntity(entity);
    const current = this.getCurrentRotation();
    return this.rotationWithin(current, targetRotation, tolerance);
  }

  /**
   * Get angle difference between current and target rotation
   */
  getAngleDifference(target: Vec3): number {
    const targetRotation = this.getRotationTo(target);
    const current = this.getCurrentRotation();
    return this.getRotationDifference(current, targetRotation);
  }

  /**
   * Add random human-like offset to rotation
   */
  humanize(rotation: LookRotation): LookRotation {
    const offset = this.config.humanizeOffset;
    return {
      yaw: rotation.yaw + (Math.random() - 0.5) * offset * 2,
      pitch: Math.max(-90, Math.min(90, rotation.pitch + (Math.random() - 0.5) * offset * 2)),
    };
  }

  /**
   * Get position bot is looking at (ray cast)
   */
  getLookedAtPosition(maxDistance: number = 6): Vec3 | null {
    const eyePos = this.getEyePosition();
    const direction = this.getLookDirection();
    return eyePos.offset(
      direction.x * maxDistance,
      direction.y * maxDistance,
      direction.z * maxDistance
    );
  }

  /**
   * Get normalized look direction vector
   */
  getLookDirection(): Vec3 {
    const yawRad = this.bot.entity.yaw;
    const pitchRad = this.bot.entity.pitch;

    // Minecraft coordinate system
    const x = -Math.sin(yawRad) * Math.cos(pitchRad);
    const y = -Math.sin(pitchRad);
    const z = Math.cos(yawRad) * Math.cos(pitchRad);

    return new Vec3(x, y, z);
  }

  // ---- Private Methods ----

  /**
   * Get bot's eye position
   */
  private getEyePosition(): Vec3 {
    const pos = this.bot.entity.position;
    const height = this.bot.entity.height ?? 1.62;
    return pos.offset(0, height, 0);
  }

  /**
   * Get entity's eye position
   */
  private getEntityEyePosition(entity: Entity): Vec3 {
    const height = entity.height ?? 1.8;
    return entity.position.offset(0, height * 0.85, 0); // Slightly below head
  }

  /**
   * Update target rotation based on lookingAt
   */
  private updateTargetRotation(): void {
    if (!this.lookingAt) {
      this.targetRotation = null;
      return;
    }

    if (this.lookingAt instanceof Vec3) {
      this.targetRotation = this.getRotationTo(this.lookingAt);
    } else {
      this.targetRotation = this.getRotationToEntity(this.lookingAt as Entity);
    }

    // Add humanization if enabled
    if (this.config.humanizeOffset > 0) {
      this.targetRotation = this.humanize(this.targetRotation);
    }
  }

  /**
   * Interpolate between two rotations
   */
  private interpolateRotation(from: LookRotation, to: LookRotation): LookRotation {
    // Calculate yaw difference (handle wrap-around)
    let yawDiff = this.normalizeAngle(to.yaw - from.yaw);
    if (yawDiff > 180) yawDiff -= 360;
    if (yawDiff < -180) yawDiff += 360;

    // Clamp to max speed
    const yawChange = Math.max(-this.config.maxYawSpeed, Math.min(this.config.maxYawSpeed, yawDiff));
    const pitchDiff = to.pitch - from.pitch;
    const pitchChange = Math.max(-this.config.maxPitchSpeed, Math.min(this.config.maxPitchSpeed, pitchDiff));

    return {
      yaw: this.normalizeAngle(from.yaw + yawChange),
      pitch: Math.max(-90, Math.min(90, from.pitch + pitchChange)),
    };
  }

  /**
   * Check if two rotations are within tolerance
   */
  private rotationWithin(a: LookRotation, b: LookRotation, tolerance: number): boolean {
    const diff = this.getRotationDifference(a, b);
    return diff <= tolerance;
  }

  /**
   * Get total angle difference between rotations
   */
  private getRotationDifference(a: LookRotation, b: LookRotation): number {
    let yawDiff = Math.abs(this.normalizeAngle(a.yaw - b.yaw));
    if (yawDiff > 180) yawDiff = 360 - yawDiff;
    const pitchDiff = Math.abs(a.pitch - b.pitch);
    return Math.sqrt(yawDiff * yawDiff + pitchDiff * pitchDiff);
  }

  /**
   * Normalize angle to 0-360 range
   */
  private normalizeAngle(angle: number): number {
    angle = angle % 360;
    if (angle < 0) angle += 360;
    return angle;
  }
}

/**
 * Create a look helper for a bot
 */
export function createLookHelper(bot: Bot, config?: Partial<LookConfig>): LookHelper {
  return new LookHelper(bot, config);
}

/**
 * Calculate rotation from one position to another (standalone function)
 */
export function calculateLookRotation(from: Vec3, to: Vec3): LookRotation {
  const delta = to.minus(from);
  const horizontalDist = Math.sqrt(delta.x * delta.x + delta.z * delta.z);

  const yaw = -Math.atan2(delta.x, delta.z) * (180 / Math.PI);
  const pitch = -Math.atan2(delta.y, horizontalDist) * (180 / Math.PI);

  let normalizedYaw = yaw % 360;
  if (normalizedYaw < 0) normalizedYaw += 360;

  return { yaw: normalizedYaw, pitch };
}

/**
 * Get distance from eye position to target
 */
export function getEyeDistance(bot: Bot, target: Vec3): number {
  const eyePos = bot.entity.position.offset(0, bot.entity.height ?? 1.62, 0);
  return eyePos.distanceTo(target);
}
