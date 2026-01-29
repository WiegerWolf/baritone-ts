import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { BaseProcess, ProcessPriority, ProcessTickResult, ProcessState } from './Process';
import { Goal } from '../types';
import { GoalNear, GoalBlock } from '../goals';

/**
 * GatherProcess handles collecting dropped items
 * Based on Baritone's item collection behavior
 *
 * Features:
 * - Find and collect dropped items by name
 * - Priority-based item selection
 * - Configurable search radius
 * - Auto-continue to next item
 */

/**
 * Gather configuration
 */
export interface GatherConfig {
  // Item names to collect (empty = all items)
  itemNames: string[];
  // Maximum search radius
  searchRadius: number;
  // Maximum items to collect (0 = unlimited)
  maxItems: number;
  // Prioritize closer items
  prioritizeClosest: boolean;
  // Collect items while moving to destination
  collectOnPath: boolean;
}

const DEFAULT_CONFIG: GatherConfig = {
  itemNames: [],
  searchRadius: 32,
  maxItems: 0,
  prioritizeClosest: true,
  collectOnPath: true
};

export class GatherProcess extends BaseProcess {
  readonly displayName = 'Gather';

  private config: GatherConfig;
  private targetItems: Entity[] = [];
  private currentTarget: Entity | null = null;
  private itemsCollected: number = 0;
  private lastSearchTime: number = 0;
  private searchCooldown: number = 1000; // ms between searches

  constructor(bot: Bot, pathfinder: any, config: Partial<GatherConfig> = {}) {
    super(bot, pathfinder, ProcessPriority.NORMAL);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set items to collect
   */
  setItems(itemNames: string[]): void {
    this.config.itemNames = itemNames;
    this.targetItems = [];
    this.currentTarget = null;
  }

  /**
   * Add an item type to collect
   */
  addItem(itemName: string): void {
    if (!this.config.itemNames.includes(itemName)) {
      this.config.itemNames.push(itemName);
    }
  }

  /**
   * Remove an item type from collection
   */
  removeItem(itemName: string): void {
    const index = this.config.itemNames.indexOf(itemName);
    if (index !== -1) {
      this.config.itemNames.splice(index, 1);
    }
  }

  /**
   * Set search radius
   */
  setSearchRadius(radius: number): void {
    this.config.searchRadius = radius;
  }

  /**
   * Set max items to collect
   */
  setMaxItems(max: number): void {
    this.config.maxItems = max;
  }

  onActivate(): void {
    super.onActivate();
    this.itemsCollected = 0;
    this.findTargetItems();
  }

  onDeactivate(): void {
    super.onDeactivate();
    this.currentTarget = null;
    this.targetItems = [];
  }

  tick(): ProcessTickResult {
    // Check if we've reached max items
    if (this.config.maxItems > 0 && this.itemsCollected >= this.config.maxItems) {
      return this.completeResult(`Collected ${this.itemsCollected} items`);
    }

    // Refresh item list periodically
    const now = Date.now();
    if (now - this.lastSearchTime > this.searchCooldown) {
      this.findTargetItems();
      this.lastSearchTime = now;
    }

    // Check if current target is still valid
    if (this.currentTarget) {
      if (!this.currentTarget.isValid || this.isItemCollected(this.currentTarget)) {
        // Item was collected or despawned
        this.itemsCollected++;
        this.currentTarget = null;
        // Remove from list
        this.targetItems = this.targetItems.filter(e => e.isValid);
      }
    }

    // Find new target if needed
    if (!this.currentTarget) {
      this.currentTarget = this.selectBestTarget();

      if (!this.currentTarget) {
        // No items found
        if (this.targetItems.length === 0) {
          if (this.itemsCollected > 0) {
            return this.completeResult(`Collected ${this.itemsCollected} items, no more found`);
          }
          return this.failedResult('No items found to collect');
        }
        return this.waitResult('Searching for items...');
      }
    }

    // Create goal to get to the item
    const pos = this.currentTarget.position;
    const goal = new GoalNear(pos.x, pos.y, pos.z, 0.5);

    return this.newGoalResult(goal, `Collecting ${this.getItemName(this.currentTarget)}`);
  }

  /**
   * Find all target items in range
   */
  private findTargetItems(): void {
    this.targetItems = [];
    const botPos = this.bot.entity.position;
    const radiusSq = this.config.searchRadius * this.config.searchRadius;

    // Get all item entities
    for (const entity of Object.values(this.bot.entities)) {
      const isItem = entity.name === 'item' ||
                     (entity as any).displayName === 'Item';
      if (!isItem) {
        continue;
      }

      // Check distance
      const distSq = entity.position.distanceSquared(botPos);
      if (distSq > radiusSq) {
        continue;
      }

      // Check item name if filter is set
      if (this.config.itemNames.length > 0) {
        const itemName = this.getItemName(entity);
        if (!this.config.itemNames.includes(itemName)) {
          continue;
        }
      }

      this.targetItems.push(entity);
    }

    // Sort by distance if configured
    if (this.config.prioritizeClosest) {
      this.targetItems.sort((a, b) => {
        const distA = a.position.distanceSquared(botPos);
        const distB = b.position.distanceSquared(botPos);
        return distA - distB;
      });
    }
  }

  /**
   * Select the best target item
   */
  private selectBestTarget(): Entity | null {
    // Filter valid items
    const validItems = this.targetItems.filter(e => e.isValid);

    if (validItems.length === 0) {
      return null;
    }

    return validItems[0] || null;
  }

  /**
   * Get item name from entity
   */
  private getItemName(entity: Entity): string {
    // Try to get item info from metadata
    const metadata = (entity as any).metadata;
    if (metadata) {
      for (const entry of metadata) {
        if (entry && typeof entry === 'object' && 'itemId' in entry) {
          return String(entry.itemId);
        }
        if (entry && typeof entry === 'object' && 'name' in entry) {
          return String(entry.name);
        }
      }
    }

    // Fallback to entity name
    return entity.name || 'unknown_item';
  }

  /**
   * Check if item has been collected (is now in inventory)
   */
  private isItemCollected(entity: Entity): boolean {
    // Item entities that are collected become invalid
    return !entity.isValid;
  }

  /**
   * Get number of items collected
   */
  getItemsCollected(): number {
    return this.itemsCollected;
  }

  /**
   * Get current target item
   */
  getCurrentTarget(): Entity | null {
    return this.currentTarget;
  }

  /**
   * Get all found target items
   */
  getTargetItems(): Entity[] {
    return [...this.targetItems];
  }
}
