/**
 * ItemTarget - "Any of These Items" Pattern
 * Based on AltoClef's ItemTarget.java
 *
 * Represents a target quantity of items that can be satisfied by
 * multiple item types. For example, "10 planks of any type" or
 * "1 of any pickaxe".
 *
 * Used by ResourceTask and other item acquisition tasks.
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';

/**
 * ItemTarget - Represents a quantity of items to acquire
 */
export class ItemTarget {
  /** Items that can satisfy this target */
  private itemMatches: string[];

  /** Number of items needed */
  private targetCount: number;

  /** If true, collect as many as possible */
  private infinite: boolean = false;

  /**
   * Create an item target
   * @param items Item name(s) that satisfy this target
   * @param count Number of items needed (default: 1)
   */
  constructor(items: string | string[], count: number = 1) {
    this.itemMatches = Array.isArray(items) ? items : [items];
    this.targetCount = count;
  }

  /**
   * Create an infinite target (collect as many as possible)
   */
  static infinite(items: string | string[]): ItemTarget {
    const target = new ItemTarget(items, Number.MAX_SAFE_INTEGER);
    target.infinite = true;
    return target;
  }

  /**
   * Create targets from an object mapping item names to counts
   */
  static fromObject(items: Record<string, number>): ItemTarget[] {
    return Object.entries(items).map(
      ([name, count]) => new ItemTarget(name, count)
    );
  }

  /**
   * Check if an item matches this target
   */
  matches(item: Item | string): boolean {
    const name = typeof item === 'string' ? item : item.name;
    return this.itemMatches.includes(name);
  }

  /**
   * Get the target count
   */
  getTargetCount(): number {
    return this.targetCount;
  }

  /**
   * Check if this is an infinite target
   */
  isInfinite(): boolean {
    return this.infinite;
  }

  /**
   * Get the item names that can satisfy this target
   */
  getItemNames(): readonly string[] {
    return this.itemMatches;
  }

  /**
   * Check if the target is met given a count
   */
  isMet(currentCount: number): boolean {
    return currentCount >= this.targetCount;
  }

  /**
   * Get remaining count needed
   */
  getRemainingCount(currentCount: number): number {
    return Math.max(0, this.targetCount - currentCount);
  }

  /**
   * Count how many items in an array match this target
   */
  countMatching(items: Item[]): number {
    let count = 0;
    for (const item of items) {
      if (this.matches(item)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Check if inventory satisfies this target
   */
  isMetInInventory(bot: Bot): boolean {
    const count = this.countMatching(bot.inventory.items());
    return this.isMet(count);
  }

  /**
   * Get remaining count from inventory
   */
  getRemainingFromInventory(bot: Bot): number {
    const count = this.countMatching(bot.inventory.items());
    return this.getRemainingCount(count);
  }

  /**
   * Combine multiple item targets
   */
  static combine(targets: ItemTarget[]): ItemTarget[] {
    const combined: Map<string, ItemTarget> = new Map();

    for (const target of targets) {
      const key = target.itemMatches.sort().join(',');
      const existing = combined.get(key);

      if (existing) {
        // Add counts together
        combined.set(key, new ItemTarget(
          target.itemMatches,
          existing.targetCount + target.targetCount
        ));
      } else {
        combined.set(key, target);
      }
    }

    return Array.from(combined.values());
  }

  /**
   * Create a readable string representation
   */
  toString(): string {
    const items = this.itemMatches.join(' or ');
    const count = this.infinite ? 'infinite' : this.targetCount;
    return `${count} x (${items})`;
  }
}

/**
 * ItemTargetResult - Result of checking item targets against inventory
 */
export interface ItemTargetResult {
  /** All targets met? */
  satisfied: boolean;
  /** Count of items for each target */
  counts: Map<ItemTarget, number>;
  /** Remaining needed for each target */
  remaining: Map<ItemTarget, number>;
  /** Total items needed */
  totalRemaining: number;
}

/**
 * Check multiple item targets against inventory
 */
export function checkItemTargets(
  bot: Bot,
  targets: ItemTarget[]
): ItemTargetResult {
  const items = bot.inventory.items();
  const counts = new Map<ItemTarget, number>();
  const remaining = new Map<ItemTarget, number>();

  let totalRemaining = 0;
  let allSatisfied = true;

  for (const target of targets) {
    const count = target.countMatching(items);
    const rem = target.getRemainingCount(count);

    counts.set(target, count);
    remaining.set(target, rem);

    if (rem > 0) {
      allSatisfied = false;
      totalRemaining += rem;
    }
  }

  return {
    satisfied: allSatisfied,
    counts,
    remaining,
    totalRemaining,
  };
}

/**
 * Common item target presets
 */
export const ItemTargets = {
  // Wood
  logs: (count: number) => new ItemTarget([
    'oak_log', 'birch_log', 'spruce_log', 'jungle_log',
    'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log',
  ], count),

  planks: (count: number) => new ItemTarget([
    'oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks',
    'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks',
    'crimson_planks', 'warped_planks',
  ], count),

  // Stone
  cobblestone: (count: number) => new ItemTarget([
    'cobblestone', 'cobbled_deepslate',
  ], count),

  // Tools
  pickaxe: (count: number = 1) => new ItemTarget([
    'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe',
    'golden_pickaxe', 'diamond_pickaxe', 'netherite_pickaxe',
  ], count),

  axe: (count: number = 1) => new ItemTarget([
    'wooden_axe', 'stone_axe', 'iron_axe',
    'golden_axe', 'diamond_axe', 'netherite_axe',
  ], count),

  shovel: (count: number = 1) => new ItemTarget([
    'wooden_shovel', 'stone_shovel', 'iron_shovel',
    'golden_shovel', 'diamond_shovel', 'netherite_shovel',
  ], count),

  sword: (count: number = 1) => new ItemTarget([
    'wooden_sword', 'stone_sword', 'iron_sword',
    'golden_sword', 'diamond_sword', 'netherite_sword',
  ], count),

  // Armor
  helmet: (count: number = 1) => new ItemTarget([
    'leather_helmet', 'chainmail_helmet', 'iron_helmet',
    'golden_helmet', 'diamond_helmet', 'netherite_helmet', 'turtle_helmet',
  ], count),

  chestplate: (count: number = 1) => new ItemTarget([
    'leather_chestplate', 'chainmail_chestplate', 'iron_chestplate',
    'golden_chestplate', 'diamond_chestplate', 'netherite_chestplate',
  ], count),

  leggings: (count: number = 1) => new ItemTarget([
    'leather_leggings', 'chainmail_leggings', 'iron_leggings',
    'golden_leggings', 'diamond_leggings', 'netherite_leggings',
  ], count),

  boots: (count: number = 1) => new ItemTarget([
    'leather_boots', 'chainmail_boots', 'iron_boots',
    'golden_boots', 'diamond_boots', 'netherite_boots',
  ], count),

  // Food
  cookedMeat: (count: number) => new ItemTarget([
    'cooked_beef', 'cooked_porkchop', 'cooked_mutton',
    'cooked_chicken', 'cooked_rabbit', 'cooked_cod', 'cooked_salmon',
  ], count),

  food: (count: number) => new ItemTarget([
    'cooked_beef', 'cooked_porkchop', 'cooked_mutton', 'cooked_chicken',
    'bread', 'baked_potato', 'golden_carrot', 'golden_apple',
    'apple', 'carrot', 'melon_slice',
  ], count),

  // Ores
  ironOre: (count: number) => new ItemTarget([
    'iron_ore', 'deepslate_iron_ore', 'raw_iron',
  ], count),

  goldOre: (count: number) => new ItemTarget([
    'gold_ore', 'deepslate_gold_ore', 'raw_gold', 'nether_gold_ore',
  ], count),

  diamondOre: (count: number) => new ItemTarget([
    'diamond_ore', 'deepslate_diamond_ore',
  ], count),

  coal: (count: number) => new ItemTarget([
    'coal', 'charcoal',
  ], count),
};
