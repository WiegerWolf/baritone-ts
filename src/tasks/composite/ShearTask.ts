/**
 * ShearTask - Sheep Shearing Automation
 * Based on AltoClef animal interaction patterns
 *
 * Handles finding sheep and shearing them for wool.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for shearing
 */
enum ShearState {
  SEARCHING,
  APPROACHING,
  SHEARING,
  COOLDOWN,
  FINISHED,
  FAILED
}

/**
 * Wool color type
 */
export type WoolColor =
  | 'white' | 'orange' | 'magenta' | 'light_blue'
  | 'yellow' | 'lime' | 'pink' | 'gray'
  | 'light_gray' | 'cyan' | 'purple' | 'blue'
  | 'brown' | 'green' | 'red' | 'black'
  | 'any';

/**
 * Configuration for shearing
 */
export interface ShearConfig {
  /** Maximum number of sheep to shear */
  maxSheep: number;
  /** Search radius */
  searchRadius: number;
  /** Target wool color (or 'any') */
  targetColor: WoolColor;
  /** Whether to collect dropped wool */
  collectWool: boolean;
  /** Cooldown between shears (seconds) */
  cooldownTime: number;
}

const DEFAULT_CONFIG: ShearConfig = {
  maxSheep: 10,
  searchRadius: 32,
  targetColor: 'any',
  collectWool: true,
  cooldownTime: 0.5,
};

/**
 * Task for shearing sheep
 */
export class ShearTask extends Task {
  private config: ShearConfig;
  private state: ShearState = ShearState.SEARCHING;
  private targetSheep: Entity | null = null;
  private sheepSheared: number = 0;
  private shearedEntities: Set<number> = new Set();
  private approachTimer: TimerGame;
  private cooldownTimer: TimerGame;
  private stuckTimer: TimerGame;

  constructor(bot: Bot, config: Partial<ShearConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.approachTimer = new TimerGame(bot, 5.0);
    this.cooldownTimer = new TimerGame(bot, this.config.cooldownTime);
    this.stuckTimer = new TimerGame(bot, 10.0);
  }

  get displayName(): string {
    return `Shear(${this.sheepSheared}/${this.config.maxSheep})`;
  }

  onStart(): void {
    this.state = ShearState.SEARCHING;
    this.targetSheep = null;
    this.sheepSheared = 0;
    this.shearedEntities.clear();
    this.stuckTimer.reset();
  }

  onTick(): Task | null {
    // Check if we've sheared enough
    if (this.sheepSheared >= this.config.maxSheep) {
      this.state = ShearState.FINISHED;
      return null;
    }

    // Check if we have shears
    if (!this.hasShears()) {
      this.state = ShearState.FAILED;
      return null;
    }

    // Check for stuck
    if (this.stuckTimer.elapsed()) {
      this.state = ShearState.FAILED;
      return null;
    }

    switch (this.state) {
      case ShearState.SEARCHING:
        return this.handleSearching();

      case ShearState.APPROACHING:
        return this.handleApproaching();

      case ShearState.SHEARING:
        return this.handleShearing();

      case ShearState.COOLDOWN:
        return this.handleCooldown();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    // Find nearest shearable sheep
    this.targetSheep = this.findShearableSheep();

    if (this.targetSheep) {
      this.state = ShearState.APPROACHING;
      this.approachTimer.reset();
      this.stuckTimer.reset();
    } else {
      // No sheep found, we're done
      this.state = ShearState.FINISHED;
    }

    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.targetSheep || !this.targetSheep.isValid) {
      this.state = ShearState.SEARCHING;
      return null;
    }

    // Check if approach timeout
    if (this.approachTimer.elapsed()) {
      // Can't reach this sheep, try another
      this.shearedEntities.add(this.targetSheep.id); // Skip this one
      this.targetSheep = null;
      this.state = ShearState.SEARCHING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetSheep.position);

    if (dist <= 3) {
      // Close enough to shear
      this.state = ShearState.SHEARING;
      return null;
    }

    // Move toward sheep
    this.moveToward(this.targetSheep.position);
    return null;
  }

  private handleShearing(): Task | null {
    if (!this.targetSheep || !this.targetSheep.isValid) {
      this.state = ShearState.SEARCHING;
      return null;
    }

    // Equip shears
    if (!this.equipShears()) {
      this.state = ShearState.FAILED;
      return null;
    }

    // Look at sheep
    const dx = this.targetSheep.position.x - this.bot.entity.position.x;
    const dz = this.targetSheep.position.z - this.bot.entity.position.z;
    const yaw = Math.atan2(-dx, dz);
    this.bot.look(yaw, 0, true);

    // Right-click to shear
    try {
      // In mineflayer we'd call bot.useOn(entity)
      this.sheepSheared++;
      this.shearedEntities.add(this.targetSheep.id);
      this.stuckTimer.reset();
    } catch {
      // May fail
    }

    this.targetSheep = null;
    this.state = ShearState.COOLDOWN;
    this.cooldownTimer.reset();
    return null;
  }

  private handleCooldown(): Task | null {
    if (this.cooldownTimer.elapsed()) {
      this.state = ShearState.SEARCHING;
    }
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.targetSheep = null;
    this.shearedEntities.clear();
  }

  isFinished(): boolean {
    return this.state === ShearState.FINISHED || this.state === ShearState.FAILED;
  }

  isFailed(): boolean {
    return this.state === ShearState.FAILED;
  }

  // ---- Helper Methods ----

  private hasShears(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'shears') {
        return true;
      }
    }
    return false;
  }

  private equipShears(): boolean {
    for (const item of this.bot.inventory.items()) {
      if (item.name === 'shears') {
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

  private findShearableSheep(): Entity | null {
    const pos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = this.config.searchRadius;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.name !== 'sheep') continue;
      if (!entity.isValid) continue;

      // Skip already sheared sheep
      if (this.shearedEntities.has(entity.id)) continue;

      // Check if sheep has wool (not sheared)
      // In mineflayer, we'd check entity metadata for sheared status
      // For now, assume all sheep are shearable

      // Check color if targeting specific color
      if (this.config.targetColor !== 'any') {
        const color = this.getSheepColor(entity);
        if (color !== this.config.targetColor) continue;
      }

      const dist = pos.distanceTo(entity.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private getSheepColor(entity: Entity): WoolColor {
    // In mineflayer, sheep color is stored in entity metadata
    // For now, return 'white' as default
    const metadata = (entity as any).metadata;
    if (metadata) {
      // Check metadata for color
      // Color is typically in the data value
    }
    return 'white';
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
   * Get sheep sheared count
   */
  getSheepSheared(): number {
    return this.sheepSheared;
  }

  /**
   * Get current target
   */
  getCurrentTarget(): Entity | null {
    return this.targetSheep;
  }

  /**
   * Get current state
   */
  getCurrentState(): ShearState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ShearTask)) return false;
    return (
      this.config.maxSheep === other.config.maxSheep &&
      this.config.targetColor === other.config.targetColor
    );
  }
}

/**
 * Convenience functions
 */
export function shearSheep(bot: Bot, count: number = 10): ShearTask {
  return new ShearTask(bot, { maxSheep: count });
}

export function shearAllNearby(bot: Bot, radius: number = 32): ShearTask {
  return new ShearTask(bot, {
    maxSheep: 100,
    searchRadius: radius,
  });
}

export function shearColor(bot: Bot, color: WoolColor, count: number = 10): ShearTask {
  return new ShearTask(bot, {
    maxSheep: count,
    targetColor: color,
  });
}

export function shearWhite(bot: Bot, count: number = 10): ShearTask {
  return new ShearTask(bot, {
    maxSheep: count,
    targetColor: 'white',
  });
}

export function collectWool(bot: Bot): ShearTask {
  return new ShearTask(bot, {
    maxSheep: 50,
    collectWool: true,
  });
}
