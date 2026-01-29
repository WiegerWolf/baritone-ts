/**
 * RepairTask - Item Repair Automation
 * Based on AltoClef's repair system
 *
 * Handles repairing items using anvils or grindstones,
 * combining items, and managing repair materials.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from '../concrete/GetToBlockTask';
import { InteractBlockTask } from '../concrete/InteractTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Repair method
 */
export enum RepairMethod {
  ANVIL,      // Repair with materials or combine items
  GRINDSTONE, // Remove enchantments and repair
  COMBINE,    // Combine two damaged items
}

/**
 * State for repair operation
 */
enum RepairState {
  FINDING_STATION,
  APPROACHING,
  OPENING_STATION,
  PLACING_ITEMS,
  REPAIRING,
  RETRIEVING,
  CLOSING,
  FINISHED,
  FAILED
}

/**
 * Configuration for repair
 */
export interface RepairConfig {
  /** Item to repair */
  itemToRepair: string;
  /** Repair method to use */
  method: RepairMethod;
  /** Material for anvil repair (optional) */
  repairMaterial?: string;
  /** Search radius for repair station */
  searchRadius: number;
  /** Minimum durability percentage to trigger repair */
  minDurabilityPercent: number;
}

const DEFAULT_CONFIG: RepairConfig = {
  itemToRepair: '',
  method: RepairMethod.ANVIL,
  searchRadius: 32,
  minDurabilityPercent: 20,
};

/**
 * Repair materials for common tools
 */
const REPAIR_MATERIALS: Record<string, string> = {
  'diamond_sword': 'diamond',
  'diamond_pickaxe': 'diamond',
  'diamond_axe': 'diamond',
  'diamond_shovel': 'diamond',
  'diamond_hoe': 'diamond',
  'diamond_helmet': 'diamond',
  'diamond_chestplate': 'diamond',
  'diamond_leggings': 'diamond',
  'diamond_boots': 'diamond',
  'iron_sword': 'iron_ingot',
  'iron_pickaxe': 'iron_ingot',
  'iron_axe': 'iron_ingot',
  'iron_shovel': 'iron_ingot',
  'iron_hoe': 'iron_ingot',
  'iron_helmet': 'iron_ingot',
  'iron_chestplate': 'iron_ingot',
  'iron_leggings': 'iron_ingot',
  'iron_boots': 'iron_ingot',
  'golden_sword': 'gold_ingot',
  'golden_pickaxe': 'gold_ingot',
  'golden_axe': 'gold_ingot',
  'golden_shovel': 'gold_ingot',
  'golden_hoe': 'gold_ingot',
  'netherite_sword': 'netherite_ingot',
  'netherite_pickaxe': 'netherite_ingot',
  'netherite_axe': 'netherite_ingot',
  'netherite_shovel': 'netherite_ingot',
  'netherite_hoe': 'netherite_ingot',
  'bow': 'string',
  'crossbow': 'string',
  'fishing_rod': 'string',
  'elytra': 'phantom_membrane',
  'shield': 'oak_planks',
  'turtle_helmet': 'scute',
};

/**
 * Task for repairing items
 */
export class RepairTask extends Task {
  private config: RepairConfig;
  private state: RepairState = RepairState.FINDING_STATION;
  private repairStation: Block | null = null;
  private repairTimer: TimerGame;
  private windowOpen: boolean = false;

  constructor(bot: Bot, config: Partial<RepairConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.repairTimer = new TimerGame(bot, 0.5);
  }

  get displayName(): string {
    return `Repair(${this.config.itemToRepair || 'any'}, ${RepairMethod[this.config.method]})`;
  }

  onStart(): void {
    this.state = RepairState.FINDING_STATION;
    this.repairStation = null;
    this.windowOpen = false;
  }

  onTick(): Task | null {
    switch (this.state) {
      case RepairState.FINDING_STATION:
        return this.handleFindingStation();

      case RepairState.APPROACHING:
        return this.handleApproaching();

      case RepairState.OPENING_STATION:
        return this.handleOpeningStation();

      case RepairState.PLACING_ITEMS:
        return this.handlePlacingItems();

      case RepairState.REPAIRING:
        return this.handleRepairing();

      case RepairState.RETRIEVING:
        return this.handleRetrieving();

      case RepairState.CLOSING:
        return this.handleClosing();

      default:
        return null;
    }
  }

  private handleFindingStation(): Task | null {
    this.repairStation = this.findRepairStation();
    if (!this.repairStation) {
      this.state = RepairState.FAILED;
      return null;
    }

    this.state = RepairState.APPROACHING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.repairStation) {
      this.state = RepairState.FINDING_STATION;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.repairStation.position);
    if (dist <= 4.0) {
      this.state = RepairState.OPENING_STATION;
      return null;
    }

    return new GetToBlockTask(
      this.bot,
      Math.floor(this.repairStation.position.x),
      Math.floor(this.repairStation.position.y),
      Math.floor(this.repairStation.position.z)
    );
  }

  private handleOpeningStation(): Task | null {
    if (!this.repairStation) {
      this.state = RepairState.FINDING_STATION;
      return null;
    }

    const window = (this.bot as any).currentWindow;
    const expectedType = this.config.method === RepairMethod.GRINDSTONE
      ? 'minecraft:grindstone'
      : 'minecraft:anvil';

    if (window && (window.type === expectedType || window.type?.includes('anvil') || window.type?.includes('grindstone'))) {
      this.windowOpen = true;
      this.state = RepairState.PLACING_ITEMS;
      return null;
    }

    return new InteractBlockTask(
      this.bot,
      Math.floor(this.repairStation.position.x),
      Math.floor(this.repairStation.position.y),
      Math.floor(this.repairStation.position.z)
    );
  }

  private handlePlacingItems(): Task | null {
    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.windowOpen = false;
      this.state = RepairState.OPENING_STATION;
      return null;
    }

    // Find item to repair
    const itemToRepair = this.findItemToRepair();
    if (!itemToRepair) {
      this.state = RepairState.FAILED;
      return null;
    }

    // Check first slot
    const slot0 = window.slots[0];
    if (!slot0 || slot0.name !== itemToRepair.name) {
      // Place item in first slot
      try {
        this.bot.clickWindow(itemToRepair.slot, 0, 0);
        this.bot.clickWindow(0, 0, 0);
      } catch {
        // Will retry
      }
      return null;
    }

    // For anvil repair with materials
    if (this.config.method === RepairMethod.ANVIL) {
      const material = this.config.repairMaterial || REPAIR_MATERIALS[itemToRepair.name];
      if (material) {
        const slot1 = window.slots[1];
        if (!slot1 || slot1.name !== material) {
          const materialItem = this.findItem(material);
          if (materialItem) {
            try {
              this.bot.clickWindow(materialItem.slot, 0, 0);
              this.bot.clickWindow(1, 0, 0);
            } catch {
              // Will retry
            }
            return null;
          }
        }
      }
    }

    // For combine repair
    if (this.config.method === RepairMethod.COMBINE) {
      const slot1 = window.slots[1];
      if (!slot1 || slot1.name !== itemToRepair.name) {
        const secondItem = this.findSecondItemToRepair(itemToRepair.slot);
        if (secondItem) {
          try {
            this.bot.clickWindow(secondItem.slot, 0, 0);
            this.bot.clickWindow(1, 0, 0);
          } catch {
            // Will retry
          }
          return null;
        }
      }
    }

    this.state = RepairState.REPAIRING;
    this.repairTimer.reset();
    return null;
  }

  private handleRepairing(): Task | null {
    if (!this.repairTimer.elapsed()) {
      return null;
    }

    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = RepairState.OPENING_STATION;
      return null;
    }

    // Check output slot (slot 2 for anvil/grindstone)
    const outputSlot = window.slots[2];
    if (outputSlot) {
      // Click to take output
      try {
        this.bot.clickWindow(2, 0, 1); // Shift-click to inventory
      } catch {
        // Will retry
      }
      this.state = RepairState.RETRIEVING;
    }

    this.repairTimer.reset();
    return null;
  }

  private handleRetrieving(): Task | null {
    if (!this.repairTimer.elapsed()) {
      return null;
    }

    const window = (this.bot as any).currentWindow;
    if (!window) {
      this.state = RepairState.FINISHED;
      return null;
    }

    // Check if output was taken
    const outputSlot = window.slots[2];
    if (!outputSlot) {
      this.state = RepairState.CLOSING;
    }

    this.repairTimer.reset();
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
    this.state = RepairState.FINISHED;
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
    this.repairStation = null;
    this.windowOpen = false;
  }

  isFinished(): boolean {
    return this.state === RepairState.FINISHED || this.state === RepairState.FAILED;
  }

  isFailed(): boolean {
    return this.state === RepairState.FAILED;
  }

  // ---- Helper Methods ----

  private findRepairStation(): Block | null {
    const playerPos = this.bot.entity.position;
    let nearest: Block | null = null;
    let nearestDist = Infinity;

    const targetBlock = this.config.method === RepairMethod.GRINDSTONE
      ? 'grindstone'
      : 'anvil';

    for (let x = -this.config.searchRadius; x <= this.config.searchRadius; x += 2) {
      for (let z = -this.config.searchRadius; z <= this.config.searchRadius; z += 2) {
        for (let y = -10; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block) continue;

          // Check for anvil variants or grindstone
          const isAnvil = block.name === 'anvil' ||
                          block.name === 'chipped_anvil' ||
                          block.name === 'damaged_anvil';
          const isGrindstone = block.name === 'grindstone';

          if ((targetBlock === 'anvil' && isAnvil) ||
              (targetBlock === 'grindstone' && isGrindstone)) {
            const dist = playerPos.distanceTo(pos);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = block;
            }
          }
        }
      }
    }

    return nearest;
  }

  private findItemToRepair(): any | null {
    for (const item of this.bot.inventory.items()) {
      // Check if matches target
      if (this.config.itemToRepair && item.name !== this.config.itemToRepair) {
        continue;
      }

      // Check if item has durability and is damaged
      if (item.durabilityUsed !== undefined && item.maxDurability !== undefined) {
        const durabilityPercent = ((item.maxDurability - item.durabilityUsed) / item.maxDurability) * 100;
        if (durabilityPercent <= this.config.minDurabilityPercent) {
          return item;
        }
      }

      // Also check for items that might need repair (tools, armor, etc.)
      if (this.isRepairableItem(item.name)) {
        return item;
      }
    }
    return null;
  }

  private findSecondItemToRepair(excludeSlot: number): any | null {
    for (const item of this.bot.inventory.items()) {
      if (item.slot === excludeSlot) continue;

      if (this.config.itemToRepair && item.name === this.config.itemToRepair) {
        return item;
      }
    }
    return null;
  }

  private findItem(itemName: string): any | null {
    return this.bot.inventory.items().find(item => item.name === itemName) ?? null;
  }

  private isRepairableItem(itemName: string): boolean {
    return itemName in REPAIR_MATERIALS ||
           itemName.includes('sword') ||
           itemName.includes('pickaxe') ||
           itemName.includes('axe') ||
           itemName.includes('shovel') ||
           itemName.includes('hoe') ||
           itemName.includes('helmet') ||
           itemName.includes('chestplate') ||
           itemName.includes('leggings') ||
           itemName.includes('boots') ||
           itemName === 'bow' ||
           itemName === 'crossbow' ||
           itemName === 'elytra' ||
           itemName === 'shield' ||
           itemName === 'fishing_rod' ||
           itemName === 'trident';
  }

  /**
   * Get repair material for an item
   */
  static getRepairMaterial(itemName: string): string | undefined {
    return REPAIR_MATERIALS[itemName];
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RepairTask)) return false;

    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Convenience functions
 */
export function repairWithAnvil(bot: Bot, itemName?: string): RepairTask {
  return new RepairTask(bot, {
    itemToRepair: itemName || '',
    method: RepairMethod.ANVIL,
  });
}

export function repairWithGrindstone(bot: Bot, itemName?: string): RepairTask {
  return new RepairTask(bot, {
    itemToRepair: itemName || '',
    method: RepairMethod.GRINDSTONE,
  });
}

export function combineItems(bot: Bot, itemName: string): RepairTask {
  return new RepairTask(bot, {
    itemToRepair: itemName,
    method: RepairMethod.COMBINE,
  });
}

export function repairDamagedItems(bot: Bot, minDurabilityPercent: number = 20): RepairTask {
  return new RepairTask(bot, {
    method: RepairMethod.ANVIL,
    minDurabilityPercent,
  });
}
