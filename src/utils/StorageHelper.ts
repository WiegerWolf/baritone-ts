/**
 * StorageHelper - Inventory Query Utilities
 * Based on AltoClef's StorageHelper.java
 *
 * Provides utility functions for:
 * - Item counting and finding
 * - Slot management
 * - Tool selection
 * - Armor management
 * - Garbage/throwaway item selection
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';
import { ItemTarget } from './ItemTarget';

/**
 * Slot types for inventory operations
 */
export enum SlotType {
  MAIN = 'main',
  HOTBAR = 'hotbar',
  ARMOR = 'armor',
  OFFHAND = 'offhand',
  CRAFTING = 'crafting',
}

/**
 * Window slot mappings
 */
export const SLOT_MAPPINGS = {
  // Hotbar: inventory 0-8 → window 36-44
  hotbarToWindow: (slot: number) => slot + 36,
  windowToHotbar: (slot: number) => slot - 36,

  // Main inventory: inventory 9-35 → window 9-35
  mainToWindow: (slot: number) => slot,
  windowToMain: (slot: number) => slot,

  // Armor slots
  HELMET: 5,
  CHESTPLATE: 6,
  LEGGINGS: 7,
  BOOTS: 8,
  OFFHAND: 45,

  // Crafting in inventory
  CRAFTING_OUTPUT: 0,
  CRAFTING_GRID: [1, 2, 3, 4],
};

/**
 * Tool materials in order of quality
 */
const TOOL_TIERS = ['wooden', 'stone', 'golden', 'iron', 'diamond', 'netherite'];

/**
 * Default throwaway items (safe to discard)
 */
const DEFAULT_THROWAWAY = new Set([
  'cobblestone', 'cobbled_deepslate', 'dirt', 'gravel', 'sand',
  'netherrack', 'andesite', 'diorite', 'granite', 'tuff',
  'rotten_flesh', 'poisonous_potato', 'spider_eye',
  'bone', 'string', 'gunpowder', 'slime_ball',
]);

/**
 * StorageHelper - Utility class for inventory operations
 */
export class StorageHelper {
  private bot: Bot;
  private throwawayItems: Set<string>;

  constructor(bot: Bot, throwawayItems: string[] = Array.from(DEFAULT_THROWAWAY)) {
    this.bot = bot;
    this.throwawayItems = new Set(throwawayItems);
  }

  // ---- Item Counting ----

  /**
   * Count items in inventory
   */
  getItemCount(...itemNames: string[]): number {
    let count = 0;

    for (const item of this.bot.inventory.items()) {
      if (itemNames.includes(item.name)) {
        count += item.count;
      }
    }

    return count;
  }

  /**
   * Check if inventory has item
   */
  hasItem(...itemNames: string[]): boolean {
    return this.getItemCount(...itemNames) > 0;
  }

  /**
   * Check if ItemTargets are met
   */
  itemTargetsMet(targets: ItemTarget[]): boolean {
    for (const target of targets) {
      const count = this.getItemCount(...target.getItemNames());
      if (!target.isMet(count)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get items in inventory matching names
   */
  getItems(...itemNames: string[]): Item[] {
    return this.bot.inventory.items().filter(item =>
      itemNames.includes(item.name)
    );
  }

  // ---- Slot Finding ----

  /**
   * Find slot with item
   */
  findSlotWithItem(...itemNames: string[]): number | null {
    for (const item of this.bot.inventory.items()) {
      if (itemNames.includes(item.name)) {
        return item.slot;
      }
    }
    return null;
  }

  /**
   * Find item object by name
   */
  findItem(...itemNames: string[]): Item | null {
    for (const item of this.bot.inventory.items()) {
      if (itemNames.includes(item.name)) {
        return item;
      }
    }
    return null;
  }

  /**
   * Find empty slot in inventory
   */
  findEmptySlot(): number | null {
    // Check main inventory (9-35)
    for (let i = 9; i < 36; i++) {
      if (!this.bot.inventory.slots[i]) {
        return i;
      }
    }

    // Check hotbar (36-44 in window, 0-8 in inventory)
    for (let i = 36; i < 45; i++) {
      if (!this.bot.inventory.slots[i]) {
        return i;
      }
    }

    return null;
  }

  /**
   * Find best slot for an item (for merging or empty)
   */
  findBestSlotFor(itemName: string, count: number): number | null {
    // First try to merge with existing stack
    for (const item of this.bot.inventory.items()) {
      if (item.name === itemName && item.count + count <= item.stackSize) {
        return item.slot;
      }
    }

    // Otherwise find empty slot
    return this.findEmptySlot();
  }

  // ---- Tool Selection ----

  /**
   * Get best tool for breaking a block
   */
  getBestToolFor(blockName: string): Item | null {
    const tools: Item[] = [];

    for (const item of this.bot.inventory.items()) {
      if (this.isToolForBlock(item, blockName)) {
        tools.push(item);
      }
    }

    if (tools.length === 0) return null;

    // Sort by tier (best first)
    tools.sort((a, b) => this.getToolTier(b) - this.getToolTier(a));

    return tools[0];
  }

  /**
   * Check if a tool is appropriate for a block
   */
  private isToolForBlock(item: Item, blockName: string): boolean {
    const name = item.name;

    // Pickaxe for stone, ores, etc.
    if (name.includes('pickaxe')) {
      if (blockName.includes('stone') || blockName.includes('ore') ||
          blockName.includes('brick') || blockName.includes('cobble') ||
          blockName.includes('deepslate') || blockName.includes('iron') ||
          blockName.includes('gold') || blockName.includes('diamond') ||
          blockName.includes('netherite') || blockName.includes('obsidian')) {
        return true;
      }
    }

    // Axe for wood
    if (name.includes('axe') && !name.includes('pickaxe')) {
      if (blockName.includes('log') || blockName.includes('wood') ||
          blockName.includes('plank') || blockName.includes('fence') ||
          blockName.includes('door') || blockName.includes('chest') ||
          blockName.includes('crafting')) {
        return true;
      }
    }

    // Shovel for dirt, sand, gravel
    if (name.includes('shovel')) {
      if (blockName.includes('dirt') || blockName.includes('sand') ||
          blockName.includes('gravel') || blockName.includes('clay') ||
          blockName.includes('soul') || blockName.includes('snow')) {
        return true;
      }
    }

    // Shears for wool, leaves
    if (name === 'shears') {
      if (blockName.includes('wool') || blockName.includes('leaves') ||
          blockName.includes('cobweb') || blockName.includes('vine')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get tool tier (higher = better)
   */
  private getToolTier(item: Item): number {
    for (let i = 0; i < TOOL_TIERS.length; i++) {
      if (item.name.includes(TOOL_TIERS[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get best sword
   */
  getBestSword(): Item | null {
    const swords = this.bot.inventory.items()
      .filter(item => item.name.includes('sword'))
      .sort((a, b) => this.getToolTier(b) - this.getToolTier(a));

    return swords[0] ?? null;
  }

  /**
   * Get best pickaxe
   */
  getBestPickaxe(): Item | null {
    const pickaxes = this.bot.inventory.items()
      .filter(item => item.name.includes('pickaxe'))
      .sort((a, b) => this.getToolTier(b) - this.getToolTier(a));

    return pickaxes[0] ?? null;
  }

  // ---- Armor ----

  /**
   * Check if armor slot is equipped
   */
  isArmorEquipped(slot: 'helmet' | 'chestplate' | 'leggings' | 'boots'): boolean {
    const slotIndex = {
      helmet: SLOT_MAPPINGS.HELMET,
      chestplate: SLOT_MAPPINGS.CHESTPLATE,
      leggings: SLOT_MAPPINGS.LEGGINGS,
      boots: SLOT_MAPPINGS.BOOTS,
    }[slot];

    return this.bot.inventory.slots[slotIndex] !== null;
  }

  /**
   * Get equipped armor piece
   */
  getEquippedArmor(slot: 'helmet' | 'chestplate' | 'leggings' | 'boots'): Item | null {
    const slotIndex = {
      helmet: SLOT_MAPPINGS.HELMET,
      chestplate: SLOT_MAPPINGS.CHESTPLATE,
      leggings: SLOT_MAPPINGS.LEGGINGS,
      boots: SLOT_MAPPINGS.BOOTS,
    }[slot];

    return this.bot.inventory.slots[slotIndex] ?? null;
  }

  /**
   * Find best armor piece in inventory
   */
  findBestArmor(type: 'helmet' | 'chestplate' | 'leggings' | 'boots'): Item | null {
    const armor = this.bot.inventory.items()
      .filter(item => item.name.includes(type))
      .sort((a, b) => this.getArmorTier(b) - this.getArmorTier(a));

    return armor[0] ?? null;
  }

  /**
   * Get armor tier
   */
  private getArmorTier(item: Item): number {
    const tiers = ['leather', 'golden', 'chainmail', 'iron', 'diamond', 'netherite'];
    for (let i = 0; i < tiers.length; i++) {
      if (item.name.includes(tiers[i])) {
        return i;
      }
    }
    return -1;
  }

  // ---- Garbage Selection ----

  /**
   * Set throwaway items
   */
  setThrowawayItems(items: string[]): void {
    this.throwawayItems = new Set(items);
  }

  /**
   * Add throwaway item
   */
  addThrowawayItem(item: string): void {
    this.throwawayItems.add(item);
  }

  /**
   * Check if item is throwaway
   */
  isThrowaway(item: Item | string): boolean {
    const name = typeof item === 'string' ? item : item.name;
    return this.throwawayItems.has(name);
  }

  /**
   * Get garbage slot (item to throw away to make space)
   */
  getGarbageSlot(): number | null {
    // Priority 1: Throwaway items
    for (const item of this.bot.inventory.items()) {
      if (this.isThrowaway(item)) {
        return item.slot;
      }
    }

    // Priority 2: Worst tools
    const worstTool = this.findWorstTool();
    if (worstTool) {
      return worstTool.slot;
    }

    // Priority 3: Smallest stack (least valuable)
    const smallest = this.findSmallestStack();
    if (smallest) {
      return smallest.slot;
    }

    return null;
  }

  /**
   * Find worst tool (for discarding)
   */
  private findWorstTool(): Item | null {
    const tools = this.bot.inventory.items()
      .filter(item =>
        item.name.includes('pickaxe') ||
        item.name.includes('axe') ||
        item.name.includes('shovel') ||
        item.name.includes('hoe')
      )
      .sort((a, b) => this.getToolTier(a) - this.getToolTier(b));

    // Only return if we have duplicate tiers
    if (tools.length >= 2 && this.getToolTier(tools[0]) === this.getToolTier(tools[1])) {
      return tools[0];
    }

    return null;
  }

  /**
   * Find smallest stack
   */
  private findSmallestStack(): Item | null {
    const items = this.bot.inventory.items()
      .filter(item => !this.isValuable(item))
      .sort((a, b) => a.count - b.count);

    return items[0] ?? null;
  }

  /**
   * Check if an item is valuable (shouldn't be discarded)
   */
  private isValuable(item: Item): boolean {
    const valuable = [
      'diamond', 'emerald', 'netherite', 'enchanted',
      'totem', 'elytra', 'trident', 'beacon',
      'nether_star', 'heart_of_the_sea',
    ];

    return valuable.some(v => item.name.includes(v));
  }

  // ---- Inventory State ----

  /**
   * Check if inventory is full
   */
  isInventoryFull(): boolean {
    return this.findEmptySlot() === null;
  }

  /**
   * Get number of empty slots
   */
  getEmptySlotCount(): number {
    let count = 0;

    for (let i = 9; i < 45; i++) {
      if (!this.bot.inventory.slots[i]) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get cursor item (item held by mouse in GUI)
   */
  getCursorItem(): Item | null {
    return this.bot.inventory.cursor ?? null;
  }

  /**
   * Check if cursor has an item
   */
  hasCursorItem(): boolean {
    return this.bot.inventory.cursor !== null;
  }
}
