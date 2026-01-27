/**
 * ItemStorageTracker - Inventory and Container Tracking
 * Based on AltoClef's ItemStorageTracker.java
 *
 * Tracks:
 * - Player inventory contents
 * - Open container contents
 * - Known container locations and cached contents
 * - Conversion slots (crafting grids, furnaces)
 *
 * Uses event-driven caching - containers are cached on close.
 */

import type { Bot } from 'mineflayer';
import type { Item } from 'prismarine-item';
import type { Window } from 'prismarine-windows';
import { Vec3 } from 'vec3';
import { Tracker } from './Tracker';
import { ItemTarget } from '../utils/ItemTarget';

/**
 * Cached container contents
 */
export interface ContainerCache {
  position: Vec3;
  dimension: string;
  items: CachedItem[];
  lastAccessed: number;
  containerType: ContainerType;
}

/**
 * Cached item info
 */
export interface CachedItem {
  name: string;
  count: number;
  slot: number;
}

/**
 * Container types by slot count
 */
export enum ContainerType {
  UNKNOWN = 'unknown',
  CHEST_SINGLE = 'chest_single',
  CHEST_DOUBLE = 'chest_double',
  CRAFTING_TABLE = 'crafting_table',
  FURNACE = 'furnace',
  DISPENSER = 'dispenser',
  DROPPER = 'dropper',
  HOPPER = 'hopper',
  BREWING_STAND = 'brewing_stand',
  ENCHANTING_TABLE = 'enchanting_table',
  ANVIL = 'anvil',
  BARREL = 'barrel',
  SHULKER_BOX = 'shulker_box',
}

/**
 * Determine container type from slot count
 */
function getContainerType(slotCount: number): ContainerType {
  switch (slotCount) {
    case 27: return ContainerType.CHEST_SINGLE;
    case 54: return ContainerType.CHEST_DOUBLE;
    case 10: return ContainerType.CRAFTING_TABLE;
    case 3: return ContainerType.FURNACE;
    case 9: return ContainerType.DISPENSER;
    case 5: return ContainerType.HOPPER;
    case 5: return ContainerType.BREWING_STAND;
    default: return ContainerType.UNKNOWN;
  }
}

/**
 * Configuration for ItemStorageTracker
 */
export interface StorageTrackerConfig {
  /** Maximum cached containers (default: 100) */
  maxCachedContainers: number;
  /** Container cache expiry in ms (default: 5 minutes) */
  cacheExpiryMs: number;
  /** Maximum distance to consider containers (default: 64) */
  maxContainerDistance: number;
}

const DEFAULT_CONFIG: StorageTrackerConfig = {
  maxCachedContainers: 100,
  cacheExpiryMs: 5 * 60 * 1000,
  maxContainerDistance: 64,
};

/**
 * ItemStorageTracker - Tracks inventory and container contents
 */
export class ItemStorageTracker extends Tracker {
  readonly displayName = 'ItemStorageTracker';

  private config: StorageTrackerConfig;

  // Container cache by position key
  private containerCache: Map<string, ContainerCache> = new Map();

  // Currently open container
  private currentContainer: {
    position: Vec3 | null;
    window: Window | null;
  } = { position: null, window: null };

  // Last interacted block (for container detection)
  private lastInteractedBlock: Vec3 | null = null;

  constructor(bot: Bot, config: Partial<StorageTrackerConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Set up event listeners
    this.setupListeners();
  }

  private setupListeners(): void {
    // Track block interactions for container detection
    this.bot.on('blockInteract' as any, (block: any, face: any) => {
      this.lastInteractedBlock = block.position.clone();
    });

    // Track window open/close
    this.bot.on('windowOpen', (window: Window) => {
      this.onWindowOpen(window);
    });

    this.bot.on('windowClose', (window: Window) => {
      this.onWindowClose(window);
    });

    // Track chunk unloads to invalidate cache
    this.bot.on('chunkColumnUnload', (point: { x: number; z: number }) => {
      this.invalidateChunk(point.x, point.z);
    });
  }

  /**
   * Handle window opening
   */
  private onWindowOpen(window: Window): void {
    this.currentContainer = {
      position: this.lastInteractedBlock?.clone() ?? null,
      window,
    };
  }

  /**
   * Handle window closing - cache the container contents
   */
  private onWindowClose(window: Window): void {
    if (this.currentContainer.position && this.currentContainer.window) {
      // Snapshot current contents
      const items: CachedItem[] = [];
      const slots = this.currentContainer.window.slots;

      // Get container slots (exclude player inventory at the end)
      const containerSlotCount = this.getContainerSlotCount(window);
      for (let i = 0; i < containerSlotCount; i++) {
        const item = slots[i];
        if (item) {
          items.push({
            name: item.name,
            count: item.count,
            slot: i,
          });
        }
      }

      // Cache the container
      const cache: ContainerCache = {
        position: this.currentContainer.position,
        dimension: this.bot.game?.dimension ?? 'overworld',
        items,
        lastAccessed: Date.now(),
        containerType: getContainerType(containerSlotCount),
      };

      const key = this.posKey(this.currentContainer.position);
      this.containerCache.set(key, cache);

      // Trim cache if too large
      this.trimCache();
    }

    this.currentContainer = { position: null, window: null };
  }

  /**
   * Get container slot count from window
   */
  private getContainerSlotCount(window: Window): number {
    // Total slots minus player inventory (36 slots)
    const total = window.slots.length;
    return Math.max(0, total - 36);
  }

  // ---- Query Methods ----

  /**
   * Get total count of an item across inventory and cached containers
   */
  getItemCount(...itemNames: string[]): number {
    this.ensureUpdated();

    let count = this.getInventoryCount(...itemNames);

    // Add from cached containers in current dimension
    const dimension = this.bot.game?.dimension ?? 'overworld';
    const playerPos = this.bot.entity.position;

    for (const cache of this.containerCache.values()) {
      if (cache.dimension !== dimension) continue;
      if (cache.position.distanceTo(playerPos) > this.config.maxContainerDistance) continue;

      for (const item of cache.items) {
        if (itemNames.includes(item.name)) {
          count += item.count;
        }
      }
    }

    return count;
  }

  /**
   * Get count of items in player inventory only
   */
  getInventoryCount(...itemNames: string[]): number {
    let count = 0;

    for (const item of this.bot.inventory.items()) {
      if (itemNames.includes(item.name)) {
        count += item.count;
      }
    }

    // Also check cursor
    const cursor = (this.bot.inventory as any).cursor;
    if (cursor && itemNames.includes(cursor.name)) {
      count += cursor.count;
    }

    return count;
  }

  /**
   * Check if we have an item (anywhere)
   */
  hasItem(...itemNames: string[]): boolean {
    return this.getItemCount(...itemNames) > 0;
  }

  /**
   * Check if we have an item in inventory only
   */
  hasItemInInventory(...itemNames: string[]): boolean {
    return this.getInventoryCount(...itemNames) > 0;
  }

  /**
   * Check if item targets are met in inventory
   */
  itemTargetsMet(targets: ItemTarget[]): boolean {
    for (const target of targets) {
      const count = this.getInventoryCount(...target.getItemNames());
      if (!target.isMet(count)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get containers with a specific item
   */
  getContainersWithItem(...itemNames: string[]): ContainerCache[] {
    this.ensureUpdated();

    const dimension = this.bot.game?.dimension ?? 'overworld';
    const playerPos = this.bot.entity.position;
    const result: ContainerCache[] = [];

    for (const cache of this.containerCache.values()) {
      if (cache.dimension !== dimension) continue;
      if (cache.position.distanceTo(playerPos) > this.config.maxContainerDistance) continue;

      const hasItem = cache.items.some(item => itemNames.includes(item.name));
      if (hasItem) {
        result.push(cache);
      }
    }

    // Sort by distance
    result.sort((a, b) =>
      a.position.distanceTo(playerPos) - b.position.distanceTo(playerPos)
    );

    return result;
  }

  /**
   * Get the closest container with an item
   */
  getClosestContainerWithItem(...itemNames: string[]): ContainerCache | null {
    const containers = this.getContainersWithItem(...itemNames);
    return containers[0] ?? null;
  }

  /**
   * Get all known containers in current dimension
   */
  getKnownContainers(): ContainerCache[] {
    const dimension = this.bot.game?.dimension ?? 'overworld';
    return Array.from(this.containerCache.values())
      .filter(c => c.dimension === dimension);
  }

  /**
   * Get cached container at position
   */
  getContainerAt(pos: Vec3): ContainerCache | null {
    const key = this.posKey(pos);
    return this.containerCache.get(key) ?? null;
  }

  /**
   * Invalidate container at position
   */
  invalidateContainer(pos: Vec3): void {
    const key = this.posKey(pos);
    this.containerCache.delete(key);
  }

  /**
   * Invalidate all containers in a chunk
   */
  private invalidateChunk(chunkX: number, chunkZ: number): void {
    const keysToDelete: string[] = [];

    for (const [key, cache] of this.containerCache) {
      const cx = Math.floor(cache.position.x / 16);
      const cz = Math.floor(cache.position.z / 16);
      if (cx === chunkX && cz === chunkZ) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.containerCache.delete(key);
    }
  }

  /**
   * Get items in currently open container
   */
  getCurrentContainerItems(): Item[] {
    if (!this.currentContainer.window) return [];

    const items: Item[] = [];
    const containerSlotCount = this.getContainerSlotCount(this.currentContainer.window);

    for (let i = 0; i < containerSlotCount; i++) {
      const item = this.currentContainer.window.slots[i];
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Check if a container is currently open
   */
  isContainerOpen(): boolean {
    return this.currentContainer.window !== null;
  }

  /**
   * Get position of currently open container
   */
  getCurrentContainerPosition(): Vec3 | null {
    return this.currentContainer.position?.clone() ?? null;
  }

  // ---- Cache Management ----

  /**
   * Trim cache to max size
   */
  private trimCache(): void {
    if (this.containerCache.size <= this.config.maxCachedContainers) {
      return;
    }

    // Remove oldest entries
    const entries = Array.from(this.containerCache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toRemove = entries.slice(0, entries.length - this.config.maxCachedContainers);
    for (const [key] of toRemove) {
      this.containerCache.delete(key);
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpired(): void {
    const now = Date.now();

    for (const [key, cache] of this.containerCache) {
      if (now - cache.lastAccessed > this.config.cacheExpiryMs) {
        this.containerCache.delete(key);
      }
    }
  }

  private posKey(pos: Vec3): string {
    return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
  }

  // ---- Tracker Implementation ----

  protected updateState(): void {
    this.cleanExpired();
  }

  reset(): void {
    this.containerCache.clear();
    this.currentContainer = { position: null, window: null };
    this.lastInteractedBlock = null;
  }

  // ---- Debug ----

  getDebugInfo(): string {
    this.ensureUpdated();
    const dimension = this.bot.game?.dimension ?? 'overworld';
    const containers = this.getKnownContainers();

    return [
      `ItemStorageTracker`,
      `  Cached containers: ${this.containerCache.size}`,
      `  In dimension: ${containers.length}`,
      `  Container open: ${this.isContainerOpen()}`,
    ].join('\n');
  }
}
