/**
 * FoodChain - Automatic Food Management
 * Based on AltoClef's FoodChain.java
 *
 * Automatically eats food when the player is hungry.
 * Uses a scoring algorithm to select the best food to eat,
 * optimizing for saturation and minimizing waste.
 *
 * Priority: 55 (higher than user tasks, lower than danger)
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';
import { SingleTaskChain, ChainPriority } from '../tasks/TaskChain';
import { Task } from '../tasks/Task';
import { TimerGame } from '../utils/timers/TimerGame';

/**
 * Food data for scoring
 */
interface FoodData {
  hunger: number;
  saturation: number;
}

/**
 * Known food values (hunger points and saturation)
 */
const FOOD_VALUES: Record<string, FoodData> = {
  // Meats (cooked)
  'cooked_beef': { hunger: 8, saturation: 12.8 },
  'cooked_porkchop': { hunger: 8, saturation: 12.8 },
  'cooked_mutton': { hunger: 6, saturation: 9.6 },
  'cooked_chicken': { hunger: 6, saturation: 7.2 },
  'cooked_rabbit': { hunger: 5, saturation: 6 },
  'cooked_cod': { hunger: 5, saturation: 6 },
  'cooked_salmon': { hunger: 6, saturation: 9.6 },

  // Meats (raw)
  'beef': { hunger: 3, saturation: 1.8 },
  'porkchop': { hunger: 3, saturation: 1.8 },
  'mutton': { hunger: 2, saturation: 1.2 },
  'chicken': { hunger: 2, saturation: 1.2 },
  'rabbit': { hunger: 3, saturation: 1.8 },
  'cod': { hunger: 2, saturation: 0.4 },
  'salmon': { hunger: 2, saturation: 0.4 },

  // Crops
  'bread': { hunger: 5, saturation: 6 },
  'baked_potato': { hunger: 5, saturation: 6 },
  'potato': { hunger: 1, saturation: 0.6 },
  'carrot': { hunger: 3, saturation: 3.6 },
  'beetroot': { hunger: 1, saturation: 1.2 },
  'melon_slice': { hunger: 2, saturation: 1.2 },
  'sweet_berries': { hunger: 2, saturation: 0.4 },
  'glow_berries': { hunger: 2, saturation: 0.4 },

  // Crafted foods
  'golden_carrot': { hunger: 6, saturation: 14.4 },
  'golden_apple': { hunger: 4, saturation: 9.6 },
  'enchanted_golden_apple': { hunger: 4, saturation: 9.6 },
  'pumpkin_pie': { hunger: 8, saturation: 4.8 },
  'cake': { hunger: 2, saturation: 0.4 }, // Per slice
  'cookie': { hunger: 2, saturation: 0.4 },
  'mushroom_stew': { hunger: 6, saturation: 7.2 },
  'rabbit_stew': { hunger: 10, saturation: 12 },
  'beetroot_soup': { hunger: 6, saturation: 7.2 },
  'suspicious_stew': { hunger: 6, saturation: 7.2 },

  // Special
  'apple': { hunger: 4, saturation: 2.4 },
  'dried_kelp': { hunger: 1, saturation: 0.6 },

  // Risky foods
  'rotten_flesh': { hunger: 4, saturation: 0.8 },
  'spider_eye': { hunger: 2, saturation: 3.2 },
  'poisonous_potato': { hunger: 2, saturation: 1.2 },
  'pufferfish': { hunger: 1, saturation: 0.2 },
  'chorus_fruit': { hunger: 4, saturation: 2.4 },
};

/**
 * Foods that have negative effects
 */
const RISKY_FOODS = new Set([
  'rotten_flesh', 'spider_eye', 'poisonous_potato', 'pufferfish', 'chorus_fruit',
]);

/**
 * Foods that shouldn't be eaten normally
 */
const NEVER_EAT = new Set([
  'pufferfish', 'poisonous_potato', 'chorus_fruit',
]);

/**
 * Configuration for FoodChain
 */
export interface FoodChainConfig {
  /** Hunger level to start eating (default: 14) */
  eatWhenHunger: number;
  /** Allow eating rotten flesh (default: false) */
  eatRottenFlesh: boolean;
  /** Penalty for rotten flesh in scoring (default: 5) */
  rottenFleshPenalty: number;
  /** Multiplier for saturation in scoring (default: 1.0) */
  saturationMultiplier: number;
  /** Multiplier for waste penalty in scoring (default: 0.5) */
  wastePenalty: number;
  /** Minimum delay between eat attempts in seconds (default: 1) */
  eatCooldown: number;
}

const DEFAULT_CONFIG: FoodChainConfig = {
  eatWhenHunger: 14,
  eatRottenFlesh: false,
  rottenFleshPenalty: 5,
  saturationMultiplier: 1.0,
  wastePenalty: 0.5,
  eatCooldown: 1,
};

/**
 * Task that eats a specific food item
 */
class EatFoodTask extends Task {
  readonly displayName = 'EatFood';
  private foodItem: Item;
  private started: boolean = false;
  private finished: boolean = false;

  constructor(bot: Bot, foodItem: Item) {
    super(bot);
    this.foodItem = foodItem;
  }

  onStart(): void {
    this.started = false;
    this.finished = false;
  }

  onTick(): Task | null {
    // Start eating if not already
    if (!this.started) {
      this.startEating();
      this.started = true;
      return null;
    }

    // Check if done eating
    if (!this.bot.player?.isUsingItem) {
      this.finished = true;
    }

    return null;
  }

  private async startEating(): Promise<void> {
    try {
      // Equip the food item
      await this.bot.equip(this.foodItem, 'hand');

      // Activate eating (hold right click)
      this.bot.activateItem();
    } catch (err) {
      // Failed to equip or eat
      this.finished = true;
    }
  }

  onStop(): void {
    // Stop eating if interrupted
    if (this.bot.player?.isUsingItem) {
      this.bot.deactivateItem();
    }
  }

  isFinished(): boolean {
    return this.finished;
  }

  isEqual(other: Task | null): boolean {
    if (!(other instanceof EatFoodTask)) return false;
    return other.foodItem.slot === this.foodItem.slot;
  }
}

/**
 * FoodChain - Automatic food management
 */
export class FoodChain extends SingleTaskChain {
  readonly displayName = 'FoodChain';

  private config: FoodChainConfig;
  private eatCooldown: TimerGame;
  private lastAteTime: number = 0;

  constructor(bot: Bot, config: Partial<FoodChainConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eatCooldown = new TimerGame(bot, this.config.eatCooldown);
    this.eatCooldown.forceElapsed(); // Allow immediate eating
  }

  getPriority(): number {
    if (this.needsToEat()) {
      return ChainPriority.FOOD;
    }
    return ChainPriority.INACTIVE;
  }

  isActive(): boolean {
    return this.needsToEat() && this.eatCooldown.elapsed();
  }

  protected getTaskForTick(): Task | null {
    if (!this.needsToEat()) return null;
    if (!this.eatCooldown.elapsed()) return null;

    const food = this.selectBestFood();
    if (!food) return null;

    this.eatCooldown.reset();
    return new EatFoodTask(this.bot, food);
  }

  /**
   * Check if the bot needs to eat
   */
  needsToEat(): boolean {
    // Don't eat if dead
    if (this.bot.health <= 0) return false;

    // Don't eat if food is full
    const hunger = this.bot.food;
    if (hunger >= 20) return false;

    // Eat when hunger drops below threshold
    return hunger <= this.config.eatWhenHunger;
  }

  /**
   * Check if we should urgently eat (very hungry or low health)
   */
  urgentlyNeedsFood(): boolean {
    // Very hungry
    if (this.bot.food <= 6) return true;

    // Low health and not regenerating (need food for regen)
    if (this.bot.health < 10 && this.bot.food < 18) return true;

    return false;
  }

  /**
   * Select the best food item to eat
   */
  selectBestFood(): Item | null {
    const foods = this.getAvailableFoods();
    if (foods.length === 0) return null;

    let bestFood: Item | null = null;
    let bestScore = -Infinity;

    for (const food of foods) {
      const score = this.calculateFoodScore(food);
      if (score > bestScore) {
        bestScore = score;
        bestFood = food;
      }
    }

    return bestFood;
  }

  /**
   * Get all food items in inventory
   */
  getAvailableFoods(): Item[] {
    const foods: Item[] = [];

    for (const item of this.bot.inventory.items()) {
      if (this.isFood(item)) {
        foods.push(item);
      }
    }

    return foods;
  }

  /**
   * Check if an item is food
   */
  isFood(item: Item): boolean {
    const name = item.name;

    // Check if in known foods
    if (FOOD_VALUES[name]) {
      // Filter out never-eat items
      if (NEVER_EAT.has(name)) return false;

      // Filter out rotten flesh if not allowed
      if (name === 'rotten_flesh' && !this.config.eatRottenFlesh) {
        return false;
      }

      return true;
    }

    return false;
  }

  /**
   * Calculate score for a food item
   * Higher score = better choice
   */
  calculateFoodScore(item: Item): number {
    const name = item.name;
    const foodData = FOOD_VALUES[name];
    if (!foodData) return -1000;

    const currentHunger = this.bot.food;
    const currentSaturation = this.bot.foodSaturation ?? 0;

    const hungerRestored = foodData.hunger;
    const saturationRestored = foodData.saturation;

    // Calculate waste
    const hungerWasted = Math.max(0, (currentHunger + hungerRestored) - 20);
    const saturationWasted = Math.max(0, (currentSaturation + saturationRestored) - 20);

    // Base score = saturation value
    let score = saturationRestored * this.config.saturationMultiplier;

    // Subtract waste
    score -= hungerWasted * this.config.wastePenalty;
    score -= saturationWasted * this.config.wastePenalty * 0.5;

    // Apply penalties for risky foods
    if (RISKY_FOODS.has(name)) {
      if (name === 'rotten_flesh') {
        score -= this.config.rottenFleshPenalty;
      } else if (name === 'spider_eye') {
        score -= 10; // Poison
      }
    }

    // Bonus for not wasting good food when nearly full
    if (hungerWasted === 0 && currentHunger >= 17) {
      score += 2; // Reward efficient eating
    }

    // Slight preference for high saturation when health is low
    if (this.bot.health < 10) {
      score += saturationRestored * 0.5;
    }

    return score;
  }

  /**
   * Get food data for an item
   */
  getFoodData(itemName: string): FoodData | null {
    return FOOD_VALUES[itemName] ?? null;
  }

  /**
   * Check if we have any food
   */
  hasFood(): boolean {
    return this.getAvailableFoods().length > 0;
  }

  /**
   * Get total hunger points of available food
   */
  getTotalFoodValue(): number {
    let total = 0;
    for (const food of this.getAvailableFoods()) {
      const data = FOOD_VALUES[food.name];
      if (data) {
        total += data.hunger * food.count;
      }
    }
    return total;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<FoodChainConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.eatCooldown !== undefined) {
      this.eatCooldown.setInterval(config.eatCooldown);
    }
  }

  // ---- Debug ----

  getDebugInfo(): string {
    const foods = this.getAvailableFoods();
    const best = this.selectBestFood();
    return [
      `FoodChain`,
      `  Hunger: ${this.bot.food}/20`,
      `  Saturation: ${(this.bot.foodSaturation ?? 0).toFixed(1)}`,
      `  Available foods: ${foods.length}`,
      `  Best choice: ${best?.name ?? 'none'}`,
      `  Needs to eat: ${this.needsToEat()}`,
    ].join('\n');
  }
}
