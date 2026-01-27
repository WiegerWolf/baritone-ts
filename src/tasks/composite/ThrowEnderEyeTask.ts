/**
 * ThrowEnderEyeTask - Ender Eye Throwing Automation
 * Based on AltoClef stronghold-finding patterns
 *
 * Handles throwing ender eyes and tracking their trajectory
 * to determine stronghold direction.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for throwing ender eye
 */
enum ThrowState {
  PREPARING,
  EQUIPPING,
  LOOKING_UP,
  THROWING,
  TRACKING,
  COLLECTING,
  FINISHED,
  FAILED
}

/**
 * Result of eye throw
 */
export interface EyeThrowResult {
  /** Starting position */
  startPos: Vec3;
  /** Direction the eye traveled */
  direction: Vec3;
  /** Whether eye was collected */
  collected: boolean;
  /** Whether eye shattered */
  shattered: boolean;
}

/**
 * Configuration for ender eye throwing
 */
export interface ThrowEnderEyeConfig {
  /** Look upward before throwing (degrees) */
  throwPitch: number;
  /** Time to track eye (seconds) */
  trackingTime: number;
  /** Whether to try collecting the eye */
  collectEye: boolean;
  /** Maximum distance to track */
  maxTrackDistance: number;
}

const DEFAULT_CONFIG: ThrowEnderEyeConfig = {
  throwPitch: -30,
  trackingTime: 5,
  collectEye: true,
  maxTrackDistance: 100,
};

/**
 * Task for throwing ender eyes
 */
export class ThrowEnderEyeTask extends Task {
  private config: ThrowEnderEyeConfig;
  private state: ThrowState = ThrowState.PREPARING;
  private thrownEye: Entity | null = null;
  private startPosition: Vec3 | null = null;
  private eyePositions: Vec3[] = [];
  private result: EyeThrowResult | null = null;
  private throwTimer: TimerGame;
  private trackTimer: TimerGame;

  constructor(bot: Bot, config: Partial<ThrowEnderEyeConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.throwTimer = new TimerGame(bot, 0.5);
    this.trackTimer = new TimerGame(bot, this.config.trackingTime);
  }

  get displayName(): string {
    return `ThrowEnderEye(${ThrowState[this.state]})`;
  }

  onStart(): void {
    this.state = ThrowState.PREPARING;
    this.thrownEye = null;
    this.startPosition = this.bot.entity.position.clone();
    this.eyePositions = [];
    this.result = null;
  }

  onTick(): Task | null {
    switch (this.state) {
      case ThrowState.PREPARING:
        return this.handlePreparing();

      case ThrowState.EQUIPPING:
        return this.handleEquipping();

      case ThrowState.LOOKING_UP:
        return this.handleLookingUp();

      case ThrowState.THROWING:
        return this.handleThrowing();

      case ThrowState.TRACKING:
        return this.handleTracking();

      case ThrowState.COLLECTING:
        return this.handleCollecting();

      default:
        return null;
    }
  }

  private handlePreparing(): Task | null {
    // Check if we have ender eyes
    if (!this.hasEnderEye()) {
      this.state = ThrowState.FAILED;
      return null;
    }

    this.state = ThrowState.EQUIPPING;
    return null;
  }

  private handleEquipping(): Task | null {
    if (this.equipEnderEye()) {
      this.state = ThrowState.LOOKING_UP;
      this.throwTimer.reset();
    } else {
      this.state = ThrowState.FAILED;
    }
    return null;
  }

  private handleLookingUp(): Task | null {
    // Look up at configured pitch
    const yaw = this.bot.entity.yaw;
    const pitch = (this.config.throwPitch * Math.PI) / 180;
    this.bot.look(yaw, pitch, true);

    if (this.throwTimer.elapsed()) {
      this.state = ThrowState.THROWING;
    }

    return null;
  }

  private handleThrowing(): Task | null {
    // Throw the ender eye
    try {
      this.bot.activateItem();
    } catch {
      // May fail
    }

    this.startPosition = this.bot.entity.position.clone();
    this.state = ThrowState.TRACKING;
    this.trackTimer.reset();

    return null;
  }

  private handleTracking(): Task | null {
    // Find the eye entity
    this.findThrownEye();

    if (this.thrownEye) {
      // Track position
      this.eyePositions.push(this.thrownEye.position.clone());

      // Check if eye has stopped or shattered
      if (!this.thrownEye.isValid) {
        // Eye is gone - either collected or shattered
        this.calculateResult(true);
        this.state = ThrowState.FINISHED;
        return null;
      }
    }

    // Timeout
    if (this.trackTimer.elapsed()) {
      this.calculateResult(false);

      if (this.config.collectEye && this.thrownEye) {
        this.state = ThrowState.COLLECTING;
      } else {
        this.state = ThrowState.FINISHED;
      }
    }

    return null;
  }

  private handleCollecting(): Task | null {
    // Try to pick up the eye
    // Eyes drop after a few seconds of flight
    if (!this.thrownEye || !this.thrownEye.isValid) {
      this.state = ThrowState.FINISHED;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.thrownEye.position);

    if (dist <= 2) {
      // Close enough to collect
      this.result!.collected = true;
      this.state = ThrowState.FINISHED;
      return null;
    }

    // Move toward eye
    this.moveToward(this.thrownEye.position);
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.thrownEye = null;
    this.eyePositions = [];
  }

  isFinished(): boolean {
    return this.state === ThrowState.FINISHED || this.state === ThrowState.FAILED;
  }

  isFailed(): boolean {
    return this.state === ThrowState.FAILED;
  }

  // ---- Helper Methods ----

  private hasEnderEye(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'ender_eye') {
        return true;
      }
    }
    return false;
  }

  private equipEnderEye(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'ender_eye') {
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

  private findThrownEye(): void {
    if (this.thrownEye && this.thrownEye.isValid) {
      return; // Already tracking
    }

    // Look for ender eye entity
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;

      const name = entity.name ?? '';
      if (name === 'eye_of_ender' || name === 'ender_eye') {
        // Check if near our throw position
        const dist = entity.position.distanceTo(this.startPosition!);
        if (dist < 50) {
          this.thrownEye = entity;
          return;
        }
      }
    }
  }

  private calculateResult(eyeGone: boolean): void {
    let direction = new Vec3(0, 0, 1); // Default direction

    if (this.eyePositions.length >= 2) {
      // Calculate direction from first and last positions
      const first = this.eyePositions[0];
      const last = this.eyePositions[this.eyePositions.length - 1];

      direction = last.minus(first);
      const len = Math.sqrt(direction.x ** 2 + direction.z ** 2);
      if (len > 0.1) {
        direction = new Vec3(direction.x / len, 0, direction.z / len);
      }
    } else if (this.thrownEye) {
      // Use current eye position
      const eyePos = this.thrownEye.position;
      direction = eyePos.minus(this.startPosition!);
      const len = Math.sqrt(direction.x ** 2 + direction.z ** 2);
      if (len > 0.1) {
        direction = new Vec3(direction.x / len, 0, direction.z / len);
      }
    }

    this.result = {
      startPos: this.startPosition!.clone(),
      direction,
      collected: false,
      shattered: eyeGone && !this.config.collectEye,
    };
  }

  private moveToward(target: Vec3): void {
    const pos = this.bot.entity.position;
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const yaw = Math.atan2(-dx, dz);

    this.bot.look(yaw, 0, true);
    this.bot.setControlState('forward', true);
  }

  /**
   * Get throw result
   */
  getResult(): EyeThrowResult | null {
    return this.result;
  }

  /**
   * Get direction to stronghold (normalized XZ)
   */
  getDirection(): Vec3 | null {
    return this.result?.direction ?? null;
  }

  /**
   * Get eye positions tracked
   */
  getEyePositions(): Vec3[] {
    return [...this.eyePositions];
  }

  /**
   * Get current state
   */
  getCurrentState(): ThrowState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof ThrowEnderEyeTask;
  }
}

/**
 * Convenience functions
 */
export function throwEnderEye(bot: Bot): ThrowEnderEyeTask {
  return new ThrowEnderEyeTask(bot);
}

export function throwAndTrack(bot: Bot): ThrowEnderEyeTask {
  return new ThrowEnderEyeTask(bot, { collectEye: false });
}

export function throwAndCollect(bot: Bot): ThrowEnderEyeTask {
  return new ThrowEnderEyeTask(bot, { collectEye: true });
}

export function throwWithPitch(bot: Bot, pitch: number): ThrowEnderEyeTask {
  return new ThrowEnderEyeTask(bot, { throwPitch: pitch });
}
