/**
 * EquipArmorTask - Equip Best Available Armor
 * Based on BaritonePlus's EquipArmorTask.java
 *
 * WHY: Armor is essential for survival - it reduces damage from mobs,
 * falls, and other hazards. This task handles finding armor in inventory
 * and equipping it to the correct slots.
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';

/**
 * Armor slot types
 */
export enum ArmorSlot {
  HELMET = 'head',
  CHESTPLATE = 'torso',
  LEGGINGS = 'legs',
  BOOTS = 'feet',
}

/**
 * Armor material tiers (higher = better)
 */
export enum ArmorMaterial {
  LEATHER = 1,
  GOLD = 2,
  CHAINMAIL = 3,
  IRON = 4,
  DIAMOND = 5,
  NETHERITE = 6,
}

/**
 * Armor piece definition
 */
export interface ArmorPiece {
  slot: ArmorSlot;
  itemNames: string[];
}

/**
 * State for armor equip task
 */
enum EquipArmorState {
  CHECKING_INVENTORY,
  EQUIPPING,
  FINISHED,
  FAILED
}

/**
 * Configuration for EquipArmorTask
 */
export interface EquipArmorConfig {
  /** Specific armor items to equip (if not specified, equips best available) */
  targetArmor?: ArmorPiece[];
  /** Whether to equip best available armor */
  equipBestAvailable: boolean;
  /** Include shield in offhand */
  equipShield: boolean;
}

const DEFAULT_CONFIG: EquipArmorConfig = {
  equipBestAvailable: true,
  equipShield: true,
};

/**
 * Armor items by slot and material
 */
const ARMOR_ITEMS: Record<ArmorSlot, string[]> = {
  [ArmorSlot.HELMET]: [
    'netherite_helmet', 'diamond_helmet', 'iron_helmet',
    'chainmail_helmet', 'golden_helmet', 'leather_helmet', 'turtle_helmet'
  ],
  [ArmorSlot.CHESTPLATE]: [
    'netherite_chestplate', 'diamond_chestplate', 'iron_chestplate',
    'chainmail_chestplate', 'golden_chestplate', 'leather_chestplate', 'elytra'
  ],
  [ArmorSlot.LEGGINGS]: [
    'netherite_leggings', 'diamond_leggings', 'iron_leggings',
    'chainmail_leggings', 'golden_leggings', 'leather_leggings'
  ],
  [ArmorSlot.BOOTS]: [
    'netherite_boots', 'diamond_boots', 'iron_boots',
    'chainmail_boots', 'golden_boots', 'leather_boots'
  ],
};

/**
 * Task to equip armor from inventory.
 *
 * WHY: Wearing armor significantly reduces damage taken. This task
 * checks what armor is available and equips the best pieces to
 * each slot, improving the player's survivability.
 *
 * Based on BaritonePlus EquipArmorTask.java
 */
export class EquipArmorTask extends Task {
  private config: EquipArmorConfig;
  private state: EquipArmorState = EquipArmorState.CHECKING_INVENTORY;
  private slotsToEquip: ArmorSlot[] = [];
  private currentSlotIndex: number = 0;

  constructor(bot: Bot, config: Partial<EquipArmorConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get displayName(): string {
    return 'EquipArmor';
  }

  onStart(): void {
    this.state = EquipArmorState.CHECKING_INVENTORY;
    this.slotsToEquip = [];
    this.currentSlotIndex = 0;
  }

  onTick(): Task | null {
    switch (this.state) {
      case EquipArmorState.CHECKING_INVENTORY:
        return this.handleCheckingInventory();

      case EquipArmorState.EQUIPPING:
        return this.handleEquipping();

      default:
        return null;
    }
  }

  private handleCheckingInventory(): Task | null {
    // Determine which slots need armor
    this.slotsToEquip = [];

    for (const slot of Object.values(ArmorSlot)) {
      const currentArmor = this.getEquippedArmor(slot);
      const bestAvailable = this.findBestArmorForSlot(slot);

      if (!currentArmor && bestAvailable) {
        // No armor equipped, have one available
        this.slotsToEquip.push(slot);
      } else if (currentArmor && bestAvailable) {
        // Check if available armor is better
        const currentTier = this.getArmorTier(currentArmor);
        const availableTier = this.getArmorTier(bestAvailable);
        if (availableTier > currentTier) {
          this.slotsToEquip.push(slot);
        }
      }
    }

    if (this.slotsToEquip.length === 0) {
      // Already wearing best available armor
      this.state = EquipArmorState.FINISHED;
      return null;
    }

    this.currentSlotIndex = 0;
    this.state = EquipArmorState.EQUIPPING;
    return null;
  }

  private handleEquipping(): Task | null {
    if (this.currentSlotIndex >= this.slotsToEquip.length) {
      this.state = EquipArmorState.FINISHED;
      return null;
    }

    const slot = this.slotsToEquip[this.currentSlotIndex];
    const bestArmor = this.findBestArmorForSlot(slot);

    if (!bestArmor) {
      // No armor available for this slot anymore
      this.currentSlotIndex++;
      return null;
    }

    // Find the item in inventory
    const items = this.bot.inventory.items();
    const armorItem = items.find(item => item.name === bestArmor);

    if (!armorItem) {
      this.currentSlotIndex++;
      return null;
    }

    // Equip the armor
    try {
      const equipSlot = this.getEquipDestination(slot);
      this.bot.equip(armorItem, equipSlot as any);
      this.currentSlotIndex++;
    } catch {
      // Equip failed, try next slot
      this.currentSlotIndex++;
    }

    return null;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.state === EquipArmorState.FINISHED ||
           this.state === EquipArmorState.FAILED;
  }

  isFailed(): boolean {
    return this.state === EquipArmorState.FAILED;
  }

  // ---- Helper methods ----

  private getEquippedArmor(slot: ArmorSlot): string | null {
    const equipSlot = this.getEquipDestination(slot);
    const item = (this.bot.inventory as any)[equipSlot];
    return item ? item.name : null;
  }

  private getEquipDestination(slot: ArmorSlot): string {
    switch (slot) {
      case ArmorSlot.HELMET: return 'head';
      case ArmorSlot.CHESTPLATE: return 'torso';
      case ArmorSlot.LEGGINGS: return 'legs';
      case ArmorSlot.BOOTS: return 'feet';
    }
  }

  private findBestArmorForSlot(slot: ArmorSlot): string | null {
    const armorItems = ARMOR_ITEMS[slot];
    const inventoryItems = this.bot.inventory.items();

    // Check in order of best to worst
    for (const armorName of armorItems) {
      if (inventoryItems.some(item => item.name === armorName)) {
        return armorName;
      }
    }

    return null;
  }

  private getArmorTier(armorName: string): number {
    if (armorName.includes('netherite')) return ArmorMaterial.NETHERITE;
    if (armorName.includes('diamond')) return ArmorMaterial.DIAMOND;
    if (armorName.includes('iron')) return ArmorMaterial.IRON;
    if (armorName.includes('chainmail')) return ArmorMaterial.CHAINMAIL;
    if (armorName.includes('golden') || armorName.includes('gold')) return ArmorMaterial.GOLD;
    if (armorName.includes('leather')) return ArmorMaterial.LEATHER;
    if (armorName === 'turtle_helmet') return ArmorMaterial.IRON; // Between iron and diamond
    if (armorName === 'elytra') return 0; // Special case - no protection
    return 0;
  }

  /**
   * Check if all armor slots are equipped with armor
   */
  isFullyArmored(): boolean {
    for (const slot of Object.values(ArmorSlot)) {
      if (!this.getEquippedArmor(slot)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get total armor value
   */
  getTotalArmorValue(): number {
    let total = 0;
    for (const slot of Object.values(ArmorSlot)) {
      const armor = this.getEquippedArmor(slot);
      if (armor) {
        total += this.getArmorTier(armor);
      }
    }
    return total;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof EquipArmorTask)) return false;
    return true; // All armor tasks are effectively equal
  }
}

/**
 * Helper to equip best available armor
 */
export function equipBestArmor(bot: Bot): EquipArmorTask {
  return new EquipArmorTask(bot);
}
