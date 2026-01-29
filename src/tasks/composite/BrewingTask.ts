/**
 * BrewingTask - Potion Brewing Automation
 * Based on AltoClef's brewing behavior
 *
 * Handles finding brewing stands, placing ingredients,
 * and managing the brewing process.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from '../concrete/GetToBlockTask';
import { InteractBlockTask } from '../concrete/InteractBlockTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Potion ingredient information
 */
interface PotionIngredient {
  name: string;
  effect: string;
}

/**
 * Common potion ingredients
 */
const POTION_INGREDIENTS: Record<string, PotionIngredient> = {
  'nether_wart': { name: 'nether_wart', effect: 'awkward' },
  'sugar': { name: 'sugar', effect: 'speed' },
  'rabbit_foot': { name: 'rabbit_foot', effect: 'jump_boost' },
  'blaze_powder': { name: 'blaze_powder', effect: 'strength' },
  'glistering_melon_slice': { name: 'glistering_melon_slice', effect: 'healing' },
  'spider_eye': { name: 'spider_eye', effect: 'poison' },
  'ghast_tear': { name: 'ghast_tear', effect: 'regeneration' },
  'magma_cream': { name: 'magma_cream', effect: 'fire_resistance' },
  'pufferfish': { name: 'pufferfish', effect: 'water_breathing' },
  'golden_carrot': { name: 'golden_carrot', effect: 'night_vision' },
  'phantom_membrane': { name: 'phantom_membrane', effect: 'slow_falling' },
  'turtle_shell': { name: 'turtle_shell', effect: 'turtle_master' },
  'fermented_spider_eye': { name: 'fermented_spider_eye', effect: 'modifier' },
  'redstone': { name: 'redstone', effect: 'duration' },
  'glowstone_dust': { name: 'glowstone_dust', effect: 'potency' },
  'gunpowder': { name: 'gunpowder', effect: 'splash' },
  'dragon_breath': { name: 'dragon_breath', effect: 'lingering' },
};

/**
 * State for brewing
 */
enum BrewingState {
  FINDING_STAND,
  APPROACHING,
  OPENING_STAND,
  PLACING_BOTTLES,
  PLACING_FUEL,
  PLACING_INGREDIENT,
  BREWING,
  RETRIEVING,
  CLOSING,
  FINISHED,
  FAILED
}

/**
 * Configuration for brewing
 */
export interface BrewingConfig {
  /** Target potion effect to brew */
  targetEffect: string;
  /** Number of potions to brew */
  count: number;
  /** Search radius for brewing stand */
  searchRadius: number;
  /** Wait for brewing to complete */
  waitForBrewing: boolean;
  /** Auto-supply blaze powder fuel */
  autoFuel: boolean;
}

const DEFAULT_CONFIG: BrewingConfig = {
  targetEffect: '',
  count: 3,
  searchRadius: 32,
  waitForBrewing: true,
  autoFuel: true,
};

/**
 * Task for brewing potions
 */
export class BrewingTask extends Task {
  private config: BrewingConfig;
  private state: BrewingState = BrewingState.FINDING_STAND;
  private brewingStand: Block | null = null;
  private brewTimer: TimerGame;
  private windowOpen: boolean = false;
  private brewedCount: number = 0;

  constructor(bot: Bot, config: Partial<BrewingConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.brewTimer = new TimerGame(bot, 20.0); // Brewing takes ~20 seconds
  }

  get displayName(): string {
    return `Brew(${this.config.targetEffect || 'any'}, ${this.brewedCount}/${this.config.count})`;
  }

  onStart(): void {
    this.state = BrewingState.FINDING_STAND;
    this.brewingStand = null;
    this.windowOpen = false;
    this.brewedCount = 0;
  }

  onTick(): Task | null {
    switch (this.state) {
      case BrewingState.FINDING_STAND:
        return this.handleFindingStand();

      case BrewingState.APPROACHING:
        return this.handleApproaching();

      case BrewingState.OPENING_STAND:
        return this.handleOpeningStand();

      case BrewingState.PLACING_BOTTLES:
        return this.handlePlacingBottles();

      case BrewingState.PLACING_FUEL:
        return this.handlePlacingFuel();

      case BrewingState.PLACING_INGREDIENT:
        return this.handlePlacingIngredient();

      case BrewingState.BREWING:
        return this.handleBrewing();

      case BrewingState.RETRIEVING:
        return this.handleRetrieving();

      case BrewingState.CLOSING:
        return this.handleClosing();

      default:
        return null;
    }
  }

  private handleFindingStand(): Task | null {
    this.brewingStand = this.findBrewingStand();
    if (!this.brewingStand) {
      this.state = BrewingState.FAILED;
      return null;
    }

    this.state = BrewingState.APPROACHING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.brewingStand) {
      this.state = BrewingState.FINDING_STAND;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.brewingStand.position);
    if (dist <= 4.0) {
      this.state = BrewingState.OPENING_STAND;
      return null;
    }

    return new GetToBlockTask(
      this.bot,
      Math.floor(this.brewingStand.position.x),
      Math.floor(this.brewingStand.position.y),
      Math.floor(this.brewingStand.position.z)
    );
  }

  private handleOpeningStand(): Task | null {
    if (!this.brewingStand) {
      this.state = BrewingState.FINDING_STAND;
      return null;
    }

    // Check if brewing window is already open
    const window = (this.bot as any).currentWindow;
    if (window && window.type === 'minecraft:brewing_stand') {
      this.windowOpen = true;
      this.state = BrewingState.PLACING_BOTTLES;
      return null;
    }

    // Right-click brewing stand
    return new InteractBlockTask(
      this.bot,
      Math.floor(this.brewingStand.position.x),
      Math.floor(this.brewingStand.position.y),
      Math.floor(this.brewingStand.position.z)
    );
  }

  private handlePlacingBottles(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (!window || window.type !== 'minecraft:brewing_stand') {
      this.windowOpen = false;
      this.state = BrewingState.OPENING_STAND;
      return null;
    }

    // Check bottle slots (0, 1, 2)
    const bottleCount = this.countBottlesInStand(window);
    if (bottleCount >= Math.min(3, this.config.count - this.brewedCount)) {
      this.state = BrewingState.PLACING_FUEL;
      return null;
    }

    // Find bottles in inventory
    const bottle = this.findItem('glass_bottle') ?? this.findItem('potion');
    if (!bottle) {
      this.state = BrewingState.FAILED;
      return null;
    }

    // Place bottle in empty slot
    const emptySlot = this.findEmptyBottleSlot(window);
    if (emptySlot === -1) {
      this.state = BrewingState.PLACING_FUEL;
      return null;
    }

    try {
      this.bot.clickWindow(bottle.slot, 0, 0); // Pick up
      this.bot.clickWindow(emptySlot, 0, 0); // Place in brewing slot
    } catch {
      // Will retry
    }

    return null;
  }

  private handlePlacingFuel(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = BrewingState.OPENING_STAND;
      return null;
    }

    // Check fuel slot (slot 4)
    const fuelSlot = window.slots[4];
    if (fuelSlot && fuelSlot.name === 'blaze_powder' && fuelSlot.count > 0) {
      this.state = BrewingState.PLACING_INGREDIENT;
      return null;
    }

    if (!this.config.autoFuel) {
      this.state = BrewingState.PLACING_INGREDIENT;
      return null;
    }

    // Find blaze powder
    const blazePowder = this.findItem('blaze_powder');
    if (!blazePowder) {
      // No fuel, but try brewing anyway
      this.state = BrewingState.PLACING_INGREDIENT;
      return null;
    }

    try {
      this.bot.clickWindow(blazePowder.slot, 0, 0); // Pick up
      this.bot.clickWindow(4, 0, 0); // Place in fuel slot
    } catch {
      // Will retry
    }

    return null;
  }

  private handlePlacingIngredient(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = BrewingState.OPENING_STAND;
      return null;
    }

    // Check ingredient slot (slot 3)
    const ingredientSlot = window.slots[3];
    if (ingredientSlot) {
      // Already has ingredient
      this.state = BrewingState.BREWING;
      this.brewTimer.reset();
      return null;
    }

    // Find the required ingredient
    const ingredient = this.findIngredientForEffect(this.config.targetEffect);
    if (!ingredient) {
      this.state = BrewingState.FAILED;
      return null;
    }

    try {
      this.bot.clickWindow(ingredient.slot, 0, 0); // Pick up
      this.bot.clickWindow(3, 0, 0); // Place in ingredient slot
    } catch {
      // Will retry
    }

    return null;
  }

  private handleBrewing(): Task | null {
    if (!this.config.waitForBrewing) {
      this.state = BrewingState.RETRIEVING;
      return null;
    }

    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = BrewingState.OPENING_STAND;
      return null;
    }

    // Check if brewing is complete (ingredient slot empty)
    const ingredientSlot = window.slots[3];
    if (!ingredientSlot) {
      // Brewing complete
      this.state = BrewingState.RETRIEVING;
      return null;
    }

    // Wait for brewing timer
    if (this.brewTimer.elapsed()) {
      // Should be done by now
      this.state = BrewingState.RETRIEVING;
    }

    return null;
  }

  private handleRetrieving(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = BrewingState.FINISHED;
      return null;
    }

    // Retrieve potions from slots 0, 1, 2
    for (let slot = 0; slot <= 2; slot++) {
      const item = window.slots[slot];
      if (item && item.name === 'potion') {
        try {
          this.bot.clickWindow(slot, 0, 1); // Shift-click to inventory
          this.brewedCount++;
        } catch {
          // Will retry
        }
      }
    }

    // Check if we need to brew more
    if (this.brewedCount < this.config.count) {
      this.state = BrewingState.PLACING_BOTTLES;
      return null;
    }

    this.state = BrewingState.CLOSING;
    return null;
  }

  private handleClosing(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
    }

    this.windowOpen = false;
    this.state = BrewingState.FINISHED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
    }
    this.brewingStand = null;
    this.windowOpen = false;
  }

  isFinished(): boolean {
    return this.state === BrewingState.FINISHED || this.state === BrewingState.FAILED;
  }

  isFailed(): boolean {
    return this.state === BrewingState.FAILED;
  }

  // ---- Helper Methods ----

  private findBrewingStand(): Block | null {
    const playerPos = this.bot.entity.position;
    let nearest: Block | null = null;
    let nearestDist = Infinity;

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 2) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 2) {
        for (let y = -10; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || block.name !== 'brewing_stand') continue;

          const dist = playerPos.distanceTo(pos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = block;
          }
        }
      }
    }

    return nearest;
  }

  private countBottlesInStand(window: any): number {
    let count = 0;
    for (let slot = 0; slot <= 2; slot++) {
      const item = window.slots[slot];
      if (item && (item.name === 'glass_bottle' || item.name === 'potion')) {
        count++;
      }
    }
    return count;
  }

  private findEmptyBottleSlot(window: any): number {
    for (let slot = 0; slot <= 2; slot++) {
      if (!window.slots[slot]) {
        return slot;
      }
    }
    return -1;
  }

  private findItem(itemName: string): any | null {
    return this.bot.inventory.items().find(item => item.name === itemName) ?? null;
  }

  private findIngredientForEffect(effect: string): any | null {
    // Find ingredient based on target effect
    for (const [itemName, info] of Object.entries(POTION_INGREDIENTS)) {
      if (info.effect === effect) {
        const item = this.findItem(itemName);
        if (item) return item;
      }
    }

    // If no specific effect, try nether wart for awkward potion base
    if (!effect) {
      return this.findItem('nether_wart');
    }

    return null;
  }

  /**
   * Get count of brewed potions
   */
  getBrewedCount(): number {
    return this.brewedCount;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof BrewingTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function brewPotion(bot: Bot, effect: string): BrewingTask {
  return new BrewingTask(bot, { targetEffect: effect });
}

export function brewHealingPotions(bot: Bot, count: number = 3): BrewingTask {
  return new BrewingTask(bot, { targetEffect: 'healing', count });
}

export function brewStrengthPotions(bot: Bot, count: number = 3): BrewingTask {
  return new BrewingTask(bot, { targetEffect: 'strength', count });
}

export function brewFireResistance(bot: Bot, count: number = 3): BrewingTask {
  return new BrewingTask(bot, { targetEffect: 'fire_resistance', count });
}

export function brewSpeedPotions(bot: Bot, count: number = 3): BrewingTask {
  return new BrewingTask(bot, { targetEffect: 'speed', count });
}
