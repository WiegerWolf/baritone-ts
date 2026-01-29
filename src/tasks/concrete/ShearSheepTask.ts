/**
 * ShearSheepTask - Shear Sheep for Wool
 * Based on BaritonePlus ShearSheepTask.java
 *
 * Intent: Find and shear sheep to collect wool. Handles:
 * - Finding shearable sheep (not already sheared)
 * - Equipping shears
 * - Interacting with the sheep to shear it
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { AbstractDoToEntityTask, EntityTaskConfig } from './EntityTask';
import { GoToNearTask } from './GoToNearTask';
import { LookHelper } from '../../utils/LookHelper';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for ShearSheepTask
 */
enum ShearState {
  FINDING_SHEEP,
  APPROACHING,
  EQUIPPING_SHEARS,
  SHEARING,
  FINISHED,
  FAILED,
}

/**
 * Wool color type
 */
export type WoolColor = 'white' | 'orange' | 'magenta' | 'light_blue' | 'yellow' |
                        'lime' | 'pink' | 'gray' | 'light_gray' | 'cyan' |
                        'purple' | 'blue' | 'brown' | 'green' | 'red' | 'black' | 'any';

/**
 * Configuration for ShearSheepTask
 */
export interface ShearSheepConfig {
  /** Maximum search range for sheep */
  searchRange: number;
  /** Preferred wool colors (empty = any) */
  preferredColors: string[];
  /** Maximum sheep to shear (0 = unlimited) */
  maxSheepToShear: number;
  /** Overall timeout for the task (seconds) */
  stuckTimeout: number;
  /** Per-sheep approach timeout (seconds) */
  approachTimeout: number;
}

const DEFAULT_CONFIG: ShearSheepConfig = {
  searchRange: 32,
  preferredColors: [],
  maxSheepToShear: 0,
  stuckTimeout: 60,
  approachTimeout: 5,
};

/**
 * ShearSheepTask - Find and shear sheep
 *
 * This task finds nearby shearable sheep, approaches them,
 * equips shears, and shears them to collect wool.
 */
export class ShearSheepTask extends Task {
  private config: ShearSheepConfig;
  private state: ShearState = ShearState.FINDING_SHEEP;
  private targetSheep: Entity | null = null;
  private lookHelper: LookHelper;
  private cooldown: TimerGame;
  private sheepSheared: number = 0;
  /** Track sheep we've already tried to avoid retry loops */
  private shearedEntities: Set<number> = new Set();
  /** Overall timeout - give up if stuck too long */
  private stuckTimer: TimerGame;
  /** Per-sheep approach timeout - skip unreachable sheep */
  private approachTimer: TimerGame;

  constructor(bot: Bot, config: Partial<ShearSheepConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lookHelper = new LookHelper(bot);
    this.cooldown = new TimerGame(bot, 0.5);
    this.stuckTimer = new TimerGame(bot, this.config.stuckTimeout);
    this.approachTimer = new TimerGame(bot, this.config.approachTimeout);
  }

  get displayName(): string {
    return 'ShearSheep';
  }

  onStart(): void {
    this.state = ShearState.FINDING_SHEEP;
    this.targetSheep = null;
    this.sheepSheared = 0;
    this.cooldown.reset();
    this.stuckTimer.reset();
    this.approachTimer.reset();
    this.shearedEntities.clear();
  }

  onTick(): Task | null {
    // Check if done shearing enough sheep
    if (this.config.maxSheepToShear > 0 && this.sheepSheared >= this.config.maxSheepToShear) {
      this.state = ShearState.FINISHED;
      return null;
    }

    switch (this.state) {
      case ShearState.FINDING_SHEEP:
        return this.handleFindingSheep();

      case ShearState.APPROACHING:
        return this.handleApproaching();

      case ShearState.EQUIPPING_SHEARS:
        return this.handleEquippingShears();

      case ShearState.SHEARING:
        return this.handleShearing();

      default:
        return null;
    }
  }

  private handleFindingSheep(): Task | null {
    // Check overall timeout
    if (this.stuckTimer.elapsed()) {
      this.state = ShearState.FAILED;
      return null;
    }

    // Check if we have shears
    if (!this.hasShears()) {
      this.state = ShearState.FAILED;
      return null;
    }

    // Find a shearable sheep
    this.targetSheep = this.findShearableSheep();

    if (!this.targetSheep) {
      // No sheep found
      this.state = ShearState.FINISHED;
      return null;
    }

    // Reset approach timer for new target
    this.approachTimer.reset();
    this.state = ShearState.APPROACHING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.targetSheep || !this.isValidTarget(this.targetSheep)) {
      this.targetSheep = null;
      this.state = ShearState.FINDING_SHEEP;
      return null;
    }

    // Check approach timeout - skip unreachable sheep
    if (this.approachTimer.elapsed()) {
      this.shearedEntities.add(this.targetSheep.id);
      this.targetSheep = null;
      this.state = ShearState.FINDING_SHEEP;
      return null;
    }

    const playerPos = this.bot.entity.position;
    const sheepPos = this.targetSheep.position;
    const dist = playerPos.distanceTo(sheepPos);

    // Check if close enough to shear
    if (dist <= 3.5) {
      this.state = ShearState.EQUIPPING_SHEARS;
      return null;
    }

    // Navigate to sheep
    return new GoToNearTask(
      this.bot,
      Math.floor(sheepPos.x),
      Math.floor(sheepPos.y),
      Math.floor(sheepPos.z),
      2
    );
  }

  private handleEquippingShears(): Task | null {
    if (!this.cooldown.elapsed()) {
      return null;
    }

    // Find and equip shears
    const shears = this.bot.inventory.items().find(item => item.name === 'shears');
    if (!shears) {
      this.state = ShearState.FAILED;
      return null;
    }

    const heldItem = this.bot.heldItem;
    if (heldItem?.name === 'shears') {
      this.state = ShearState.SHEARING;
      return null;
    }

    // Equip shears
    this.bot.equip(shears, 'hand').then(() => {
      this.state = ShearState.SHEARING;
    }).catch(() => {
      // Retry
      this.cooldown.reset();
    });

    return null;
  }

  private handleShearing(): Task | null {
    if (!this.targetSheep || !this.isValidTarget(this.targetSheep)) {
      this.targetSheep = null;
      this.state = ShearState.FINDING_SHEEP;
      return null;
    }

    // Look at the sheep
    this.lookHelper.startLookingAt(this.targetSheep.position.offset(0, 0.5, 0));

    if (!this.cooldown.elapsed()) {
      return null;
    }

    // Shear the sheep (right-click interact)
    try {
      this.bot.useOn(this.targetSheep);
      this.sheepSheared++;
      this.shearedEntities.add(this.targetSheep.id);
      this.cooldown.reset();

      // Find next sheep
      this.targetSheep = null;
      this.state = ShearState.FINDING_SHEEP;
    } catch (err) {
      // Mark as attempted and move on
      if (this.targetSheep) {
        this.shearedEntities.add(this.targetSheep.id);
      }
      this.targetSheep = null;
      this.state = ShearState.FINDING_SHEEP;
      this.cooldown.reset();
    }

    return null;
  }

  // ---- Helper methods ----

  private hasShears(): boolean {
    return this.bot.inventory.items().some(item => item.name === 'shears');
  }

  private findShearableSheep(): Entity | null {
    const playerPos = this.bot.entity.position;
    let closest: Entity | null = null;
    let closestDist = this.config.searchRange;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.name !== 'sheep') continue;
      if (!this.isValidTarget(entity)) continue;

      // Skip sheep we've already tried (unreachable or failed)
      if (this.shearedEntities.has(entity.id)) continue;

      // Check color preference
      if (this.config.preferredColors.length > 0) {
        const color = this.getSheepColor(entity);
        if (color && !this.config.preferredColors.includes(color)) {
          continue;
        }
      }

      const dist = playerPos.distanceTo(entity.position);
      if (dist < closestDist) {
        closestDist = dist;
        closest = entity;
      }
    }

    return closest;
  }

  private isValidTarget(entity: Entity): boolean {
    if (!entity || entity.isValid === false) return false;
    if (entity.name !== 'sheep') return false;

    // Check if sheep is shearable (has wool)
    // In mineflayer, we check metadata
    const metadata = entity.metadata;
    if (!metadata) return true; // Assume shearable if no metadata

    // Sheep metadata index 17 contains sheared state (bit 4 of byte)
    // This varies by Minecraft version
    const sheepFlags = (metadata as any)[17];
    if (typeof sheepFlags === 'number') {
      // Bit 4 (0x10) indicates sheared
      const isSheared = (sheepFlags & 0x10) !== 0;
      return !isSheared;
    }

    // Alternative check - some versions use different index
    const sheepData = (metadata as any)[16];
    if (typeof sheepData === 'number') {
      const isSheared = (sheepData & 0x10) !== 0;
      return !isSheared;
    }

    return true; // Assume shearable
  }

  private getSheepColor(entity: Entity): string | null {
    const metadata = entity.metadata;
    if (!metadata) return null;

    // Color is in lower 4 bits of sheep metadata
    const sheepData = (metadata as any)[17] ?? (metadata as any)[16];
    if (typeof sheepData === 'number') {
      const colorIndex = sheepData & 0x0F;
      const colors = [
        'white', 'orange', 'magenta', 'light_blue',
        'yellow', 'lime', 'pink', 'gray',
        'light_gray', 'cyan', 'purple', 'blue',
        'brown', 'green', 'red', 'black'
      ];
      return colors[colorIndex] ?? null;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.lookHelper.stopLooking();
  }

  isFinished(): boolean {
    return this.state === ShearState.FINISHED || this.state === ShearState.FAILED;
  }

  isFailed(): boolean {
    return this.state === ShearState.FAILED;
  }

  /**
   * Get number of sheep sheared
   */
  getSheepSheared(): number {
    return this.sheepSheared;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof ShearSheepTask)) return false;
    return this.config.maxSheepToShear === other.config.maxSheepToShear;
  }
}

/**
 * Factory function
 */
export function shearSheep(bot: Bot, count: number = 0): ShearSheepTask {
  return new ShearSheepTask(bot, { maxSheepToShear: count });
}

/**
 * Shear sheep of specific color
 */
export function shearSheepOfColor(bot: Bot, color: string, count: number = 0): ShearSheepTask {
  return new ShearSheepTask(bot, {
    preferredColors: [color],
    maxSheepToShear: count,
  });
}

export default {
  ShearSheepTask,
  shearSheep,
  shearSheepOfColor,
};
