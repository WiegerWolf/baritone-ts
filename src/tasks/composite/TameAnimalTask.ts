/**
 * TameAnimalTask - Animal Taming Automation
 * Based on AltoClef patterns
 *
 * Handles taming wolves, cats, horses, parrots, and other
 * tameable animals.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * State for taming
 */
enum TameState {
  SEARCHING,
  APPROACHING,
  PREPARING,
  TAMING,
  WAITING,
  FINISHED,
  FAILED
}

/**
 * Animal type to tame
 */
export enum TameableAnimal {
  WOLF = 'wolf',
  CAT = 'cat',
  OCELOT = 'ocelot',
  PARROT = 'parrot',
  HORSE = 'horse',
  DONKEY = 'donkey',
  MULE = 'mule',
  LLAMA = 'llama',
  AXOLOTL = 'axolotl',
  ALLAY = 'allay',
  FOX = 'fox',
}

/**
 * Taming items per animal
 */
const TAME_ITEMS: Map<TameableAnimal, string[]> = new Map([
  [TameableAnimal.WOLF, ['bone']],
  [TameableAnimal.CAT, ['cod', 'salmon']],
  [TameableAnimal.OCELOT, ['cod', 'salmon']],
  [TameableAnimal.PARROT, ['wheat_seeds', 'melon_seeds', 'pumpkin_seeds', 'beetroot_seeds']],
  [TameableAnimal.HORSE, []], // No item needed, just mount repeatedly
  [TameableAnimal.DONKEY, []],
  [TameableAnimal.MULE, []],
  [TameableAnimal.LLAMA, []],
  [TameableAnimal.AXOLOTL, ['tropical_fish_bucket']],
  [TameableAnimal.ALLAY, ['amethyst_shard']],
  [TameableAnimal.FOX, ['sweet_berries', 'glow_berries']],
]);

/**
 * Configuration for taming
 */
export interface TameConfig {
  /** Animal type to tame */
  animalType: TameableAnimal;
  /** Search radius */
  searchRadius: number;
  /** Maximum taming attempts */
  maxAttempts: number;
  /** Wait time between attempts (seconds) */
  attemptInterval: number;
  /** Maximum animals to tame */
  maxAnimals: number;
}

const DEFAULT_CONFIG: TameConfig = {
  animalType: TameableAnimal.WOLF,
  searchRadius: 32,
  maxAttempts: 20,
  attemptInterval: 0.5,
  maxAnimals: 1,
};

/**
 * Task for taming animals
 */
export class TameAnimalTask extends Task {
  private config: TameConfig;
  private state: TameState = TameState.SEARCHING;
  private targetAnimal: Entity | null = null;
  private tamedCount: number = 0;
  private attempts: number = 0;
  private tameTimer: TimerGame;
  private searchTimer: TimerGame;

  constructor(bot: Bot, config: Partial<TameConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tameTimer = new TimerGame(bot, this.config.attemptInterval);
    this.searchTimer = new TimerGame(bot, 3.0);
  }

  get displayName(): string {
    return `TameAnimal(${this.config.animalType}, ${this.tamedCount}/${this.config.maxAnimals}, ${TameState[this.state]})`;
  }

  onStart(): void {
    this.state = TameState.SEARCHING;
    this.targetAnimal = null;
    this.tamedCount = 0;
    this.attempts = 0;
  }

  onTick(): Task | null {
    // Check if done
    if (this.tamedCount >= this.config.maxAnimals) {
      this.state = TameState.FINISHED;
      return null;
    }

    // Check for too many attempts
    if (this.attempts >= this.config.maxAttempts) {
      // Try to find another animal
      this.targetAnimal = null;
      this.attempts = 0;
      this.state = TameState.SEARCHING;
    }

    switch (this.state) {
      case TameState.SEARCHING:
        return this.handleSearching();

      case TameState.APPROACHING:
        return this.handleApproaching();

      case TameState.PREPARING:
        return this.handlePreparing();

      case TameState.TAMING:
        return this.handleTaming();

      case TameState.WAITING:
        return this.handleWaiting();

      default:
        return null;
    }
  }

  private handleSearching(): Task | null {
    this.targetAnimal = this.findUntamedAnimal();

    if (this.targetAnimal) {
      this.state = TameState.APPROACHING;
      return null;
    }

    // No animal found after timeout
    if (this.searchTimer.elapsed()) {
      this.state = TameState.FINISHED;
    }

    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.targetAnimal || !this.targetAnimal.isValid) {
      this.state = TameState.SEARCHING;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetAnimal.position);

    if (dist <= 3) {
      this.state = TameState.PREPARING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.targetAnimal.position.x),
      Math.floor(this.targetAnimal.position.y),
      Math.floor(this.targetAnimal.position.z),
      2
    );
  }

  private handlePreparing(): Task | null {
    // Check if we need taming items
    const tameItems = TAME_ITEMS.get(this.config.animalType) ?? [];

    if (tameItems.length > 0) {
      // Need to equip taming item
      const hasItem = this.equipTameItem(tameItems);
      if (!hasItem) {
        this.state = TameState.FAILED;
        return null;
      }
    }

    this.state = TameState.TAMING;
    this.tameTimer.reset();
    return null;
  }

  private handleTaming(): Task | null {
    if (!this.targetAnimal || !this.targetAnimal.isValid) {
      this.state = TameState.SEARCHING;
      return null;
    }

    if (!this.tameTimer.elapsed()) {
      return null;
    }

    // Attempt to tame
    const tameItems = TAME_ITEMS.get(this.config.animalType) ?? [];

    if (tameItems.length === 0) {
      // Horse/donkey/mule - mount and wait
      this.mountAnimal();
    } else {
      // Use item on animal
      this.useItemOnAnimal();
    }

    this.attempts++;
    this.state = TameState.WAITING;
    this.tameTimer.reset();

    return null;
  }

  private handleWaiting(): Task | null {
    if (!this.tameTimer.elapsed()) {
      return null;
    }

    // Check if tamed
    if (this.isAnimalTamed()) {
      this.tamedCount++;
      this.targetAnimal = null;
      this.attempts = 0;
      this.state = TameState.SEARCHING;
    } else {
      // Try again
      this.state = TameState.TAMING;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.targetAnimal = null;
  }

  isFinished(): boolean {
    return this.state === TameState.FINISHED || this.state === TameState.FAILED;
  }

  isFailed(): boolean {
    return this.state === TameState.FAILED;
  }

  // ---- Helper Methods ----

  private findUntamedAnimal(): Entity | null {
    const playerPos = this.bot.entity.position;
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity === this.bot.entity) continue;

      const name = entity.name ?? '';
      if (name !== this.config.animalType) continue;

      // Check if already tamed
      if (this.isEntityTamed(entity)) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist > this.config.searchRadius) continue;

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private isEntityTamed(entity: Entity): boolean {
    // Check metadata for tamed state
    const metadata = (entity as any).metadata;
    if (!metadata) return false;

    // Tameable mobs have tamed flag in metadata
    // Index 17 for wolves/cats, varies by mob
    const flags = metadata[17];
    if (typeof flags === 'number') {
      return (flags & 0x04) !== 0; // Bit 2 = tamed
    }

    return false;
  }

  private isAnimalTamed(): boolean {
    if (!this.targetAnimal) return false;
    return this.isEntityTamed(this.targetAnimal);
  }

  private equipTameItem(items: string[]): boolean {
    for (const itemName of items) {
      for (const item of this.bot.inventory.items()) {
        if (item.name === itemName) {
          try {
            this.bot.equip(item, 'hand');
            return true;
          } catch {
            // May fail
          }
        }
      }
    }
    return false;
  }

  private useItemOnAnimal(): void {
    if (!this.targetAnimal) return;

    try {
      this.bot.useOn(this.targetAnimal);
    } catch {
      // May fail
    }
  }

  private mountAnimal(): void {
    if (!this.targetAnimal) return;

    try {
      this.bot.mount(this.targetAnimal);
    } catch {
      // May fail
    }
  }

  /**
   * Get tamed count
   */
  getTamedCount(): number {
    return this.tamedCount;
  }

  /**
   * Get current state
   */
  getCurrentState(): TameState {
    return this.state;
  }

  /**
   * Get current target
   */
  getTargetAnimal(): Entity | null {
    return this.targetAnimal;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof TameAnimalTask)) return false;

    return this.config.animalType === other.config.animalType &&
           this.config.maxAnimals === other.config.maxAnimals;
  }
}

/**
 * Convenience functions
 */
export function tameWolf(bot: Bot): TameAnimalTask {
  return new TameAnimalTask(bot, { animalType: TameableAnimal.WOLF });
}

export function tameCat(bot: Bot): TameAnimalTask {
  return new TameAnimalTask(bot, { animalType: TameableAnimal.CAT });
}

export function tameParrot(bot: Bot): TameAnimalTask {
  return new TameAnimalTask(bot, { animalType: TameableAnimal.PARROT });
}

export function tameHorse(bot: Bot): TameAnimalTask {
  return new TameAnimalTask(bot, { animalType: TameableAnimal.HORSE });
}

export function tameMultiple(bot: Bot, animal: TameableAnimal, count: number): TameAnimalTask {
  return new TameAnimalTask(bot, { animalType: animal, maxAnimals: count });
}

export function tameWolfPack(bot: Bot, count: number = 3): TameAnimalTask {
  return new TameAnimalTask(bot, { animalType: TameableAnimal.WOLF, maxAnimals: count });
}
