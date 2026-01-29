/**
 * RepairToolTask - Repair Tools with Mending
 * Based on BaritonePlus RepairToolTask.java
 *
 * Intent: Repair tools/armor that have the Mending enchantment by:
 * 1. Finding items with Mending that need repair
 * 2. Collecting XP orbs while holding the item
 * 3. Throwing XP bottles if available
 * 4. Killing mobs for XP as a last resort
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { Item } from 'prismarine-item';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { FollowEntityTask } from './FollowEntityTask';
import { GoToNearTask } from './GoToNearTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { LookHelper } from '../../utils/LookHelper';

/**
 * Tool/armor categories that can have Mending
 */
export const REPAIRABLE_ITEMS = [
  // Netherite gear
  'netherite_helmet', 'netherite_chestplate', 'netherite_leggings', 'netherite_boots',
  'netherite_sword', 'netherite_pickaxe', 'netherite_axe', 'netherite_shovel', 'netherite_hoe',
  // Diamond gear
  'diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots',
  'diamond_sword', 'diamond_pickaxe', 'diamond_axe', 'diamond_shovel', 'diamond_hoe',
  // Iron gear
  'iron_helmet', 'iron_chestplate', 'iron_leggings', 'iron_boots',
  'iron_sword', 'iron_pickaxe', 'iron_axe', 'iron_shovel', 'iron_hoe',
  // Gold gear
  'golden_helmet', 'golden_chestplate', 'golden_leggings', 'golden_boots',
  'golden_sword', 'golden_pickaxe', 'golden_axe', 'golden_shovel', 'golden_hoe',
  // Stone tools
  'stone_sword', 'stone_pickaxe', 'stone_axe', 'stone_shovel', 'stone_hoe',
  // Leather armor
  'leather_helmet', 'leather_chestplate', 'leather_leggings', 'leather_boots',
  // Wooden tools
  'wooden_sword', 'wooden_pickaxe', 'wooden_axe', 'wooden_shovel', 'wooden_hoe',
  // Special items
  'elytra', 'fishing_rod', 'flint_and_steel', 'carrot_on_a_stick',
  'shears', 'bow', 'shield', 'trident', 'crossbow', 'warped_fungus_on_a_stick',
];

/**
 * State for RepairToolTask
 */
enum RepairState {
  FINDING_ITEM,
  EQUIPPING_ITEM,
  COLLECTING_XP,
  THROWING_BOTTLES,
  KILLING_MOBS,
  FINISHED,
  NO_ITEMS_TO_REPAIR,
}

/**
 * Configuration for RepairToolTask
 */
export interface RepairToolConfig {
  /** Specific items to repair (empty = all repairable) */
  itemsToRepair: string[];
  /** Minimum damage percentage to trigger repair */
  minDamagePercent: number;
  /** Whether to throw XP bottles */
  useXpBottles: boolean;
  /** Whether to kill mobs for XP */
  killMobsForXp: boolean;
}

const DEFAULT_CONFIG: RepairToolConfig = {
  itemsToRepair: [],
  minDamagePercent: 10,
  useXpBottles: true,
  killMobsForXp: true,
};

/**
 * RepairToolTask - Repair tools with Mending enchantment
 *
 * This task finds items with Mending that need repair and collects
 * XP while holding them to repair them.
 */
export class RepairToolTask extends Task {
  private config: RepairToolConfig;
  private state: RepairState = RepairState.FINDING_ITEM;
  private targetItem: Item | null = null;
  private throwTimer: TimerGame;
  private lookHelper: LookHelper;

  constructor(bot: Bot, config: Partial<RepairToolConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.throwTimer = new TimerGame(bot, 0.5);
    this.lookHelper = new LookHelper(bot);
  }

  get displayName(): string {
    return 'RepairTool';
  }

  onStart(): void {
    this.state = RepairState.FINDING_ITEM;
    this.targetItem = null;
    this.throwTimer.reset();
  }

  onTick(): Task | null {
    switch (this.state) {
      case RepairState.FINDING_ITEM:
        return this.handleFindingItem();

      case RepairState.EQUIPPING_ITEM:
        return this.handleEquippingItem();

      case RepairState.COLLECTING_XP:
        return this.handleCollectingXp();

      case RepairState.THROWING_BOTTLES:
        return this.handleThrowingBottles();

      case RepairState.KILLING_MOBS:
        return this.handleKillingMobs();

      default:
        return null;
    }
  }

  private handleFindingItem(): Task | null {
    this.targetItem = this.findItemToRepair();

    if (!this.targetItem) {
      this.state = RepairState.NO_ITEMS_TO_REPAIR;
      return null;
    }

    this.state = RepairState.EQUIPPING_ITEM;
    return null;
  }

  private handleEquippingItem(): Task | null {
    if (!this.targetItem) {
      this.state = RepairState.FINDING_ITEM;
      return null;
    }

    // Check if item is still damaged
    if (!this.needsRepair(this.targetItem)) {
      this.targetItem = null;
      this.state = RepairState.FINDING_ITEM;
      return null;
    }

    // Equip the item
    const heldItem = this.bot.heldItem;
    if (heldItem?.slot === this.targetItem.slot) {
      this.state = RepairState.COLLECTING_XP;
      return null;
    }

    this.bot.equip(this.targetItem, 'hand').catch(() => {
      // Will retry
    });

    return null;
  }

  private handleCollectingXp(): Task | null {
    if (!this.targetItem || !this.needsRepair(this.targetItem)) {
      this.targetItem = null;
      this.state = RepairState.FINDING_ITEM;
      return null;
    }

    // Make sure item is equipped
    const heldItem = this.bot.heldItem;
    if (!heldItem || heldItem.slot !== this.targetItem.slot) {
      this.state = RepairState.EQUIPPING_ITEM;
      return null;
    }

    // Look for XP orbs
    const xpOrb = this.findNearestXpOrb();
    if (xpOrb) {
      // Move toward XP orb
      const dist = this.bot.entity.position.distanceTo(xpOrb.position);
      if (dist > 2) {
        return new GoToNearTask(
          this.bot,
          Math.floor(xpOrb.position.x),
          Math.floor(xpOrb.position.y),
          Math.floor(xpOrb.position.z),
          1
        );
      }
      // Close enough - orb should be collected automatically
      return null;
    }

    // No XP orbs - try throwing bottles
    if (this.config.useXpBottles && this.hasXpBottles()) {
      this.state = RepairState.THROWING_BOTTLES;
      return null;
    }

    // No bottles - try killing mobs
    if (this.config.killMobsForXp) {
      this.state = RepairState.KILLING_MOBS;
      return null;
    }

    // Nothing we can do
    this.state = RepairState.FINISHED;
    return null;
  }

  private handleThrowingBottles(): Task | null {
    if (!this.targetItem || !this.needsRepair(this.targetItem)) {
      this.targetItem = null;
      this.state = RepairState.FINDING_ITEM;
      return null;
    }

    if (!this.throwTimer.elapsed()) {
      return null;
    }

    // Check for XP orbs first
    const xpOrb = this.findNearestXpOrb();
    if (xpOrb) {
      this.state = RepairState.COLLECTING_XP;
      return null;
    }

    if (!this.hasXpBottles()) {
      if (this.config.killMobsForXp) {
        this.state = RepairState.KILLING_MOBS;
      } else {
        this.state = RepairState.FINISHED;
      }
      return null;
    }

    // Look down
    this.bot.look(this.bot.entity.yaw, Math.PI / 2, true);

    // Equip XP bottle and throw
    const bottle = this.bot.inventory.items().find(i => i.name === 'experience_bottle');
    if (bottle) {
      const heldItem = this.bot.heldItem;
      if (heldItem?.name !== 'experience_bottle') {
        this.bot.equip(bottle, 'hand').catch(() => {});
      } else {
        // Throw the bottle
        this.bot.activateItem(false);
        this.throwTimer.reset();

        // Re-equip repair item after short delay
        setTimeout(() => {
          if (this.targetItem) {
            this.bot.equip(this.targetItem, 'hand').catch(() => {});
          }
        }, 100);
      }
    }

    return null;
  }

  private handleKillingMobs(): Task | null {
    if (!this.targetItem || !this.needsRepair(this.targetItem)) {
      this.targetItem = null;
      this.state = RepairState.FINDING_ITEM;
      return null;
    }

    // Check for XP orbs first
    const xpOrb = this.findNearestXpOrb();
    if (xpOrb) {
      this.state = RepairState.COLLECTING_XP;
      return null;
    }

    // Find nearest hostile mob
    const mob = this.findNearestMob();
    if (!mob) {
      this.state = RepairState.FINISHED;
      return null;
    }

    // Attack the mob
    const dist = this.bot.entity.position.distanceTo(mob.position);
    if (dist <= 3.5) {
      this.lookHelper.startLookingAt(mob.position.offset(0, mob.height / 2, 0));
      this.bot.attack(mob);
    } else {
      return new FollowEntityTask(this.bot, mob.id, 2);
    }

    return null;
  }

  // ---- Helper methods ----

  private findItemToRepair(): Item | null {
    const items = this.bot.inventory.items();
    const targetNames = this.config.itemsToRepair.length > 0
      ? this.config.itemsToRepair
      : REPAIRABLE_ITEMS;

    for (const item of items) {
      if (!targetNames.includes(item.name)) continue;
      if (!this.needsRepair(item)) continue;
      if (!this.hasMending(item)) continue;

      return item;
    }

    return null;
  }

  private needsRepair(item: Item): boolean {
    // Check if item has durability and is damaged
    if (!item.durabilityUsed || item.durabilityUsed <= 0) {
      return false;
    }

    const maxDurability = item.maxDurability ?? 0;
    if (maxDurability <= 0) return false;

    const damagePercent = (item.durabilityUsed / maxDurability) * 100;
    return damagePercent >= this.config.minDamagePercent;
  }

  private hasMending(item: Item): boolean {
    // Check enchantments for Mending
    const enchants = item.enchants ?? [];
    return enchants.some((e: any) =>
      e.name === 'mending' || e.name === 'minecraft:mending'
    );
  }

  private findNearestXpOrb(): Entity | null {
    const playerPos = this.bot.entity.position;
    let closest: Entity | null = null;
    let closestDist = 16;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.name !== 'experience_orb') continue;
      if (entity.isValid === false) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist < closestDist) {
        closestDist = dist;
        closest = entity;
      }
    }

    return closest;
  }

  private hasXpBottles(): boolean {
    return this.bot.inventory.items().some(i => i.name === 'experience_bottle');
  }

  private findNearestMob(): Entity | null {
    const playerPos = this.bot.entity.position;
    let closest: Entity | null = null;
    let closestDist = 32;

    const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'];

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (!entity.name || !hostileMobs.includes(entity.name)) continue;
      if (entity.isValid === false) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist < closestDist) {
        closestDist = dist;
        closest = entity;
      }
    }

    return closest;
  }

  onStop(interruptTask: ITask | null): void {
    this.lookHelper.stopLooking();
  }

  isFinished(): boolean {
    return this.state === RepairState.FINISHED ||
           this.state === RepairState.NO_ITEMS_TO_REPAIR;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RepairToolTask)) return false;
    return JSON.stringify(this.config.itemsToRepair) ===
           JSON.stringify(other.config.itemsToRepair);
  }
}

/**
 * Check if any items need repair
 */
export function hasItemsNeedingRepair(bot: Bot): boolean {
  const items = bot.inventory.items();

  for (const item of items) {
    if (!REPAIRABLE_ITEMS.includes(item.name)) continue;

    // Check if damaged
    if (!item.durabilityUsed || item.durabilityUsed <= 0) continue;

    // Check for Mending
    const enchants = item.enchants ?? [];
    if (enchants.some((e: any) => e.name === 'mending' || e.name === 'minecraft:mending')) {
      return true;
    }
  }

  return false;
}

/**
 * Factory function
 */
export function repairTools(bot: Bot, items?: string[]): RepairToolTask {
  return new RepairToolTask(bot, items ? { itemsToRepair: items } : {});
}

export default {
  RepairToolTask,
  repairTools,
  hasItemsNeedingRepair,
  REPAIRABLE_ITEMS,
};
