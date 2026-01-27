/**
 * WorldSurvivalChain - Environmental Hazard Escape
 * Based on AltoClef's WorldSurvivalChain.java
 *
 * Automatically escapes from environmental hazards:
 * - Lava: Path out immediately, jump if sinking
 * - Fire: Path to water or roll
 * - Drowning: Swim up
 * - Portal stuck: Random shimmy to unstick
 * - Suffocation: Break block above
 *
 * Priority: 100 when active (highest non-death priority)
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { SingleTaskChain, ChainPriority } from '../tasks/TaskChain';
import { Task } from '../tasks/Task';
import { TimerGame } from '../utils/timers/TimerGame';

/**
 * Hazard types that WorldSurvivalChain handles
 */
export enum HazardType {
  NONE = 'none',
  LAVA = 'lava',
  FIRE = 'fire',
  DROWNING = 'drowning',
  SUFFOCATION = 'suffocation',
  PORTAL_STUCK = 'portal_stuck',
  VOID = 'void',
}

/**
 * Configuration for WorldSurvivalChain
 */
export interface WorldSurvivalConfig {
  /** Air bubble threshold for drowning detection (default: 3) */
  drowningThreshold: number;
  /** Ticks stuck in portal before shimmy (default: 100) */
  portalStuckTicks: number;
  /** Y level considered void (default: -64) */
  voidLevel: number;
}

const DEFAULT_CONFIG: WorldSurvivalConfig = {
  drowningThreshold: 3,
  portalStuckTicks: 100,
  voidLevel: -64,
};

/**
 * Task to escape from lava
 */
class EscapeLavaTask extends Task {
  readonly displayName = 'EscapeLava';
  private jumpTimer: TimerGame;

  constructor(bot: Bot) {
    super(bot);
    this.jumpTimer = new TimerGame(bot, 0.3); // Jump every 0.3 seconds
  }

  onTick(): Task | null {
    // Jump to stay afloat
    if (this.jumpTimer.elapsed()) {
      this.bot.setControlState('jump', true);
      this.jumpTimer.reset();
    } else {
      this.bot.setControlState('jump', false);
    }

    // Try to move toward safe ground
    const safePos = this.findNearestSafeGround();
    if (safePos) {
      this.moveToward(safePos);
    } else {
      // Random movement to try to escape
      this.randomMovement();
    }

    return null;
  }

  private findNearestSafeGround(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const searchRadius = 10;

    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dz = -searchRadius; dz <= searchRadius; dz++) {
          const pos = playerPos.offset(dx, dy, dz);
          const block = this.bot.blockAt(pos);
          const below = this.bot.blockAt(pos.offset(0, -1, 0));

          // Check for safe solid ground that's not in lava
          if (block && block.name === 'air' &&
              below && below.boundingBox !== 'empty' &&
              !this.isLava(below) && !this.isLava(block)) {
            const dist = pos.distanceTo(playerPos);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = pos;
            }
          }
        }
      }
    }

    return nearest;
  }

  private isLava(block: any): boolean {
    if (!block) return false;
    return block.name === 'lava' || block.name === 'flowing_lava';
  }

  private moveToward(target: Vec3): void {
    const playerPos = this.bot.entity.position;
    const delta = target.minus(playerPos);
    const yaw = Math.atan2(-delta.x, delta.z);

    this.bot.entity.yaw = yaw;
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);
  }

  private randomMovement(): void {
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);
    // Random strafe
    const strafeDir = Math.random() > 0.5;
    this.bot.setControlState('left', strafeDir);
    this.bot.setControlState('right', !strafeDir);
  }

  onStop(): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    // Finished when not in lava
    const block = this.bot.blockAt(this.bot.entity.position);
    return !block || !this.isLava(block);
  }
}

/**
 * Task to extinguish fire
 */
class ExtinguishFireTask extends Task {
  readonly displayName = 'ExtinguishFire';
  private waterPos: Vec3 | null = null;

  onTick(): Task | null {
    // Try to find water
    if (!this.waterPos) {
      this.waterPos = this.findNearestWater();
    }

    if (this.waterPos) {
      this.moveToward(this.waterPos);
    } else {
      // No water found, just keep moving
      this.bot.setControlState('forward', true);
    }

    return null;
  }

  private findNearestWater(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const searchRadius = 20;

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -5; dy <= 5; dy++) {
        for (let dz = -searchRadius; dz <= searchRadius; dz++) {
          const pos = playerPos.offset(dx, dy, dz);
          const block = this.bot.blockAt(pos);
          if (block && (block.name === 'water' || block.name === 'flowing_water')) {
            return pos;
          }
        }
      }
    }

    return null;
  }

  private moveToward(target: Vec3): void {
    const playerPos = this.bot.entity.position;
    const delta = target.minus(playerPos);
    const yaw = Math.atan2(-delta.x, delta.z);

    this.bot.entity.yaw = yaw;
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', true);
  }

  onStop(): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.bot.entity.isOnFire !== true;
  }
}

/**
 * Task to swim up to surface
 */
class SwimUpTask extends Task {
  readonly displayName = 'SwimUp';

  onTick(): Task | null {
    // Swim up
    this.bot.setControlState('jump', true);
    this.bot.setControlState('forward', true);

    return null;
  }

  onStop(): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    // Finished when we have enough air
    return (this.bot as any).oxygenLevel > 10 || !this.bot.entity.isInWater;
  }
}

/**
 * Task to shimmy out of portal
 */
class PortalShimmyTask extends Task {
  readonly displayName = 'PortalShimmy';
  private shimmyTimer: TimerGame;
  private direction: number = 0;

  constructor(bot: Bot) {
    super(bot);
    this.shimmyTimer = new TimerGame(bot, 0.5);
  }

  onTick(): Task | null {
    // Change direction periodically
    if (this.shimmyTimer.elapsed()) {
      this.direction = Math.random() * 2 - 1; // -1 to 1
      this.shimmyTimer.reset();
    }

    // Move in random direction
    this.bot.setControlState('forward', this.direction > 0);
    this.bot.setControlState('back', this.direction < 0);
    this.bot.setControlState('left', Math.random() > 0.5);
    this.bot.setControlState('right', Math.random() > 0.5);
    this.bot.setControlState('jump', true);
    this.bot.setControlState('sneak', false);

    return null;
  }

  onStop(): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    // Check if still in portal
    const block = this.bot.blockAt(this.bot.entity.position);
    return !block || block.name !== 'nether_portal';
  }
}

/**
 * Task to break block above when suffocating
 */
class BreakBlockAboveTask extends Task {
  readonly displayName = 'BreakBlockAbove';
  private breaking: boolean = false;

  onTick(): Task | null {
    if (!this.breaking) {
      const headPos = this.bot.entity.position.offset(0, 1.6, 0);
      const block = this.bot.blockAt(headPos);

      if (block && block.boundingBox !== 'empty') {
        this.bot.dig(block).catch(() => {});
        this.breaking = true;
      }
    }

    return null;
  }

  onStop(): void {
    this.bot.stopDigging();
  }

  isFinished(): boolean {
    const headPos = this.bot.entity.position.offset(0, 1.6, 0);
    const block = this.bot.blockAt(headPos);
    return !block || block.boundingBox === 'empty';
  }
}

/**
 * WorldSurvivalChain - Automatic hazard escape
 */
export class WorldSurvivalChain extends SingleTaskChain {
  readonly displayName = 'WorldSurvivalChain';

  private config: WorldSurvivalConfig;
  private portalStuckTimer: TimerGame;
  private lastPortalPos: Vec3 | null = null;

  constructor(bot: Bot, config: Partial<WorldSurvivalConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.portalStuckTimer = new TimerGame(bot, this.config.portalStuckTicks / 20);
  }

  getPriority(): number {
    const hazard = this.detectHazard();
    if (hazard === HazardType.NONE) {
      return ChainPriority.INACTIVE;
    }
    return ChainPriority.DANGER;
  }

  isActive(): boolean {
    return this.detectHazard() !== HazardType.NONE;
  }

  protected getTaskForTick(): Task | null {
    const hazard = this.detectHazard();

    switch (hazard) {
      case HazardType.LAVA:
        return new EscapeLavaTask(this.bot);

      case HazardType.FIRE:
        return new ExtinguishFireTask(this.bot);

      case HazardType.DROWNING:
        return new SwimUpTask(this.bot);

      case HazardType.PORTAL_STUCK:
        return new PortalShimmyTask(this.bot);

      case HazardType.SUFFOCATION:
        return new BreakBlockAboveTask(this.bot);

      default:
        return null;
    }
  }

  /**
   * Detect the current hazard, if any
   */
  detectHazard(): HazardType {
    // Check for lava
    if (this.isInLava()) {
      return HazardType.LAVA;
    }

    // Check for fire
    if (this.isOnFire()) {
      return HazardType.FIRE;
    }

    // Check for drowning
    if (this.isDrowning()) {
      return HazardType.DROWNING;
    }

    // Check for suffocation
    if (this.isSuffocating()) {
      return HazardType.SUFFOCATION;
    }

    // Check for portal stuck
    if (this.isStuckInPortal()) {
      return HazardType.PORTAL_STUCK;
    }

    // Check for void
    if (this.isInVoid()) {
      return HazardType.VOID;
    }

    return HazardType.NONE;
  }

  /**
   * Check if player is in lava
   */
  isInLava(): boolean {
    const block = this.bot.blockAt(this.bot.entity.position);
    if (!block) return false;
    return block.name === 'lava' || block.name === 'flowing_lava';
  }

  /**
   * Check if player is on fire
   */
  isOnFire(): boolean {
    return this.bot.entity.isOnFire === true;
  }

  /**
   * Check if player is drowning
   */
  isDrowning(): boolean {
    if (!this.bot.entity.isInWater) return false;
    const oxygen = (this.bot as any).oxygenLevel ?? 20;
    return oxygen <= this.config.drowningThreshold;
  }

  /**
   * Check if player is suffocating
   */
  isSuffocating(): boolean {
    const headPos = this.bot.entity.position.offset(0, 1.6, 0);
    const block = this.bot.blockAt(headPos);
    if (!block) return false;

    // Check if head is in a solid block
    return block.boundingBox !== 'empty' &&
           block.name !== 'water' &&
           block.name !== 'lava';
  }

  /**
   * Check if player is stuck in a portal
   */
  isStuckInPortal(): boolean {
    const block = this.bot.blockAt(this.bot.entity.position);
    if (!block || block.name !== 'nether_portal') {
      this.lastPortalPos = null;
      this.portalStuckTimer.reset();
      return false;
    }

    const currentPos = this.bot.entity.position;

    // Check if position hasn't changed
    if (this.lastPortalPos &&
        currentPos.distanceTo(this.lastPortalPos) < 0.1) {
      // In portal and not moving
      if (this.portalStuckTimer.elapsed()) {
        return true;
      }
    } else {
      this.portalStuckTimer.reset();
    }

    this.lastPortalPos = currentPos.clone();
    return false;
  }

  /**
   * Check if player is in the void
   */
  isInVoid(): boolean {
    return this.bot.entity.position.y < this.config.voidLevel;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<WorldSurvivalConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---- Debug ----

  getDebugInfo(): string {
    const hazard = this.detectHazard();
    return [
      `WorldSurvivalChain`,
      `  Current hazard: ${hazard}`,
      `  In lava: ${this.isInLava()}`,
      `  On fire: ${this.isOnFire()}`,
      `  Drowning: ${this.isDrowning()}`,
      `  Suffocating: ${this.isSuffocating()}`,
      `  Portal stuck: ${this.isStuckInPortal()}`,
    ].join('\n');
  }
}
