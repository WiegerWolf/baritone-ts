import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

/**
 * RotationHelper provides smooth, human-like rotation for anti-detection
 * Based on Baritone's RotationUtils and rotation smoothing
 *
 * Key features:
 * - Smooth interpolation between rotations
 * - Speed limits based on human reaction time
 * - Optional randomization for more natural movement
 * - Server packet timing awareness
 */

/**
 * Rotation state
 */
export interface Rotation {
  yaw: number;   // Horizontal rotation (-180 to 180)
  pitch: number; // Vertical rotation (-90 to 90)
}

/**
 * Rotation target with priority
 */
interface RotationTarget {
  rotation: Rotation;
  priority: number;
  forceInstant: boolean;
  callback?: () => void;
}

/**
 * Configuration for rotation smoothing
 */
export interface RotationConfig {
  // Maximum degrees per tick for yaw
  maxYawSpeed: number;
  // Maximum degrees per tick for pitch
  maxPitchSpeed: number;
  // Add random variation to speed
  randomization: boolean;
  // Random variation range (0-1, percentage of max speed)
  randomizationAmount: number;
  // Minimum movement to apply (prevents micro-jitters)
  minMovement: number;
  // Snap to target when within this range
  snapThreshold: number;
}

const DEFAULT_CONFIG: RotationConfig = {
  maxYawSpeed: 20,        // 20 degrees per tick (realistic human)
  maxPitchSpeed: 15,      // 15 degrees per tick
  randomization: true,
  randomizationAmount: 0.2,
  minMovement: 0.1,
  snapThreshold: 0.5
};

export class RotationHelper {
  private bot: Bot;
  private config: RotationConfig;

  // Current rotation state
  private currentYaw: number = 0;
  private currentPitch: number = 0;

  // Target rotation
  private target: RotationTarget | null = null;

  // Rotation queue for sequential rotations
  private queue: RotationTarget[] = [];

  // Is rotation currently in progress
  private rotating: boolean = false;

  constructor(bot: Bot, config: Partial<RotationConfig> = {}) {
    this.bot = bot;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize from bot's current rotation
    this.currentYaw = bot.entity?.yaw ?? 0;
    this.currentPitch = bot.entity?.pitch ?? 0;
  }

  /**
   * Normalize angle to -180 to 180 range
   */
  private normalizeAngle(angle: number): number {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
  }

  /**
   * Calculate shortest angle difference
   */
  private angleDifference(from: number, to: number): number {
    const diff = this.normalizeAngle(to - from);
    return diff;
  }

  /**
   * Calculate rotation to look at a position
   */
  calculateRotationToPosition(position: Vec3): Rotation {
    const botPos = this.bot.entity.position.offset(0, this.bot.entity.height * 0.85, 0);
    const delta = position.minus(botPos);

    const yaw = Math.atan2(-delta.x, -delta.z) * (180 / Math.PI);
    const groundDistance = Math.sqrt(delta.x * delta.x + delta.z * delta.z);
    const pitch = Math.atan2(-delta.y, groundDistance) * (180 / Math.PI);

    return { yaw: this.normalizeAngle(yaw), pitch };
  }

  /**
   * Calculate rotation to look at a block
   */
  calculateRotationToBlock(x: number, y: number, z: number, face?: Vec3): Rotation {
    const target = new Vec3(x + 0.5, y + 0.5, z + 0.5);
    if (face) {
      target.add(face.scaled(0.5));
    }
    return this.calculateRotationToPosition(target);
  }

  /**
   * Set target rotation with smooth interpolation
   */
  setRotation(rotation: Rotation, priority: number = 0, forceInstant: boolean = false): void {
    const newTarget: RotationTarget = {
      rotation: {
        yaw: this.normalizeAngle(rotation.yaw),
        pitch: Math.max(-90, Math.min(90, rotation.pitch))
      },
      priority,
      forceInstant
    };

    if (!this.target || priority >= this.target.priority) {
      this.target = newTarget;
      this.rotating = true;
    }
  }

  /**
   * Set target rotation with callback on completion
   */
  setRotationWithCallback(rotation: Rotation, callback: () => void, priority: number = 0): void {
    const newTarget: RotationTarget = {
      rotation: {
        yaw: this.normalizeAngle(rotation.yaw),
        pitch: Math.max(-90, Math.min(90, rotation.pitch))
      },
      priority,
      forceInstant: false,
      callback
    };

    if (!this.target || priority >= this.target.priority) {
      this.target = newTarget;
      this.rotating = true;
    }
  }

  /**
   * Look at a position smoothly
   */
  lookAt(position: Vec3, priority: number = 0, forceInstant: boolean = false): void {
    const rotation = this.calculateRotationToPosition(position);
    this.setRotation(rotation, priority, forceInstant);
  }

  /**
   * Look at a block smoothly
   */
  lookAtBlock(x: number, y: number, z: number, face?: Vec3, priority: number = 0): void {
    const rotation = this.calculateRotationToBlock(x, y, z, face);
    this.setRotation(rotation, priority);
  }

  /**
   * Queue a rotation to execute after current completes
   */
  queueRotation(rotation: Rotation, priority: number = 0): void {
    this.queue.push({
      rotation: {
        yaw: this.normalizeAngle(rotation.yaw),
        pitch: Math.max(-90, Math.min(90, rotation.pitch))
      },
      priority,
      forceInstant: false
    });
  }

  /**
   * Tick the rotation helper - call every physics tick
   * Returns true if rotation is complete/idle
   */
  tick(): boolean {
    // Sync current rotation from bot
    this.currentYaw = (this.bot.entity?.yaw ?? 0) * (180 / Math.PI);
    this.currentPitch = (this.bot.entity?.pitch ?? 0) * (180 / Math.PI);

    // No target, check queue
    if (!this.target) {
      if (this.queue.length > 0) {
        this.target = this.queue.shift()!;
        this.rotating = true;
      } else {
        this.rotating = false;
        return true;
      }
    }

    // Handle instant rotation
    if (this.target.forceInstant) {
      this.applyRotation(this.target.rotation.yaw, this.target.rotation.pitch);
      this.completeRotation();
      return true;
    }

    // Calculate smooth rotation
    const targetYaw = this.target.rotation.yaw;
    const targetPitch = this.target.rotation.pitch;

    const yawDiff = this.angleDifference(this.currentYaw, targetYaw);
    const pitchDiff = targetPitch - this.currentPitch;

    // Check if we're close enough to snap
    if (Math.abs(yawDiff) < this.config.snapThreshold &&
        Math.abs(pitchDiff) < this.config.snapThreshold) {
      this.applyRotation(targetYaw, targetPitch);
      this.completeRotation();
      return true;
    }

    // Calculate movement speeds
    let yawSpeed = this.config.maxYawSpeed;
    let pitchSpeed = this.config.maxPitchSpeed;

    // Apply randomization
    if (this.config.randomization) {
      const yawRandom = 1 - (Math.random() * this.config.randomizationAmount);
      const pitchRandom = 1 - (Math.random() * this.config.randomizationAmount);
      yawSpeed *= yawRandom;
      pitchSpeed *= pitchRandom;
    }

    // Calculate movement for this tick
    let yawMove = Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), yawSpeed);
    let pitchMove = Math.sign(pitchDiff) * Math.min(Math.abs(pitchDiff), pitchSpeed);

    // Apply minimum movement threshold
    if (Math.abs(yawMove) < this.config.minMovement && Math.abs(yawDiff) >= this.config.minMovement) {
      yawMove = Math.sign(yawDiff) * this.config.minMovement;
    }
    if (Math.abs(pitchMove) < this.config.minMovement && Math.abs(pitchDiff) >= this.config.minMovement) {
      pitchMove = Math.sign(pitchDiff) * this.config.minMovement;
    }

    // Apply rotation
    const newYaw = this.normalizeAngle(this.currentYaw + yawMove);
    const newPitch = Math.max(-90, Math.min(90, this.currentPitch + pitchMove));

    this.applyRotation(newYaw, newPitch);

    return false;
  }

  /**
   * Apply rotation to the bot
   */
  private applyRotation(yaw: number, pitch: number): void {
    // Convert to radians for mineflayer
    const yawRad = yaw * (Math.PI / 180);
    const pitchRad = pitch * (Math.PI / 180);
    this.bot.look(yawRad, pitchRad, false);
  }

  /**
   * Complete current rotation and process callback
   */
  private completeRotation(): void {
    if (this.target?.callback) {
      this.target.callback();
    }
    this.target = null;
    this.rotating = false;
  }

  /**
   * Cancel current rotation
   */
  cancel(): void {
    this.target = null;
    this.queue = [];
    this.rotating = false;
  }

  /**
   * Check if currently rotating
   */
  isRotating(): boolean {
    return this.rotating;
  }

  /**
   * Get current rotation
   */
  getCurrentRotation(): Rotation {
    return {
      yaw: this.currentYaw,
      pitch: this.currentPitch
    };
  }

  /**
   * Get target rotation (if any)
   */
  getTargetRotation(): Rotation | null {
    return this.target?.rotation ?? null;
  }

  /**
   * Check if looking at a position (within threshold)
   */
  isLookingAt(position: Vec3, threshold: number = 5): boolean {
    const target = this.calculateRotationToPosition(position);
    const yawDiff = Math.abs(this.angleDifference(this.currentYaw, target.yaw));
    const pitchDiff = Math.abs(target.pitch - this.currentPitch);
    return yawDiff < threshold && pitchDiff < threshold;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<RotationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Shared instance cache (one per bot)
 */
const helpers = new WeakMap<any, RotationHelper>();

/**
 * Get or create RotationHelper for a bot
 */
export function getRotationHelper(bot: Bot, config?: Partial<RotationConfig>): RotationHelper {
  let helper = helpers.get(bot);
  if (!helper) {
    helper = new RotationHelper(bot, config);
    helpers.set(bot, helper);
  }
  return helper;
}
