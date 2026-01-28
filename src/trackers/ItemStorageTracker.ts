/**
 * ItemStorageTracker - Inventory and Container Tracking
 * Based on AltoClef's ItemStorageTracker.java
 *
 * Combines functionality from:
 * - InventorySubTracker (player inventory slot tracking)
 * - ContainerSubTracker (world container caching)
 *
 * Tracks:
 * - Player inventory contents with slot-level detail
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

  // ---- Slot-Based Queries (from InventorySubTracker) ----

  /**
   * Get slots containing specific items in player inventory
   * @param includeCraftArmorOffhand Include non-normal slots (armor, crafting, offhand)
   * @param itemNames Item names to search for
   */
  getSlotsWithItemPlayerInventory(
    includeCraftArmorOffhand: boolean,
    ...itemNames: string[]
  ): number[] {
    const slots: number[] = [];
    const nameSet = new Set(itemNames);

    for (const item of this.bot.inventory.items()) {
      if (!nameSet.has(item.name)) continue;

      // Filter out armor/crafting/offhand if not included
      if (!includeCraftArmorOffhand) {
        // Player inventory normal slots are 9-44
        if (item.slot < 9 || item.slot > 44) continue;
      }

      slots.push(item.slot);
    }

    return slots;
  }

  /**
   * Get slots containing specific items in open container
   * @param itemNames Item names to search for
   */
  getSlotsWithItemContainer(...itemNames: string[]): number[] {
    if (!this.currentContainer.window) return [];

    const slots: number[] = [];
    const nameSet = new Set(itemNames);
    const containerSlotCount = this.getContainerSlotCount(this.currentContainer.window);

    for (let i = 0; i < containerSlotCount; i++) {
      const item = this.currentContainer.window.slots[i];
      if (item && nameSet.has(item.name)) {
        slots.push(i);
      }
    }

    return slots;
  }

  /**
   * Get slots containing items on current screen (player + container if open)
   * @param itemNames Item names to search for
   */
  getSlotsWithItemScreen(...itemNames: string[]): number[] {
    const playerSlots = this.getSlotsWithItemPlayerInventory(false, ...itemNames);
    const containerSlots = this.getSlotsWithItemContainer(...itemNames);
    return [...containerSlots, ...playerSlots];
  }

  /**
   * Get empty slots in player inventory
   * @param includeCraftArmorOffhand Include non-normal slots
   */
  getEmptySlotsPlayerInventory(includeCraftArmorOffhand: boolean = false): number[] {
    const slots: number[] = [];
    const startSlot = includeCraftArmorOffhand ? 0 : 9;
    const endSlot = includeCraftArmorOffhand ? 45 : 44;

    for (let i = startSlot; i <= endSlot; i++) {
      if (!this.bot.inventory.slots[i]) {
        slots.push(i);
      }
    }

    return slots;
  }

  /**
   * Get empty slots in open container
   */
  getEmptySlotsContainer(): number[] {
    if (!this.currentContainer.window) return [];

    const slots: number[] = [];
    const containerSlotCount = this.getContainerSlotCount(this.currentContainer.window);

    for (let i = 0; i < containerSlotCount; i++) {
      if (!this.currentContainer.window.slots[i]) {
        slots.push(i);
      }
    }

    return slots;
  }

  /**
   * Check if player inventory has an empty slot
   */
  hasEmptySlot(playerInventoryOnly: boolean = true): boolean {
    // Check player inventory
    const emptyPlayerSlot = this.bot.inventory.firstEmptyInventorySlot();
    if (emptyPlayerSlot !== null) return true;

    // Check container if requested
    if (!playerInventoryOnly && this.currentContainer.window) {
      return this.getEmptySlotsContainer().length > 0;
    }

    return false;
  }

  /**
   * Get slots that can fit an item (stackable or empty)
   * @param itemName Item name to fit
   * @param count Number of items to fit
   * @param acceptPartial Accept slots that can fit some but not all items
   * @param playerInventory Include player inventory slots
   * @param container Include container slots
   */
  getSlotsThatCanFit(
    itemName: string,
    count: number,
    acceptPartial: boolean,
    playerInventory: boolean = true,
    container: boolean = false
  ): number[] {
    const result: number[] = [];

    // Helper to check if a slot can fit
    const checkSlot = (slot: number, item: Item | null, isContainer: boolean) => {
      if (!item) {
        // Empty slot can fit anything
        result.push(slot);
        return;
      }

      if (item.name === itemName) {
        // Same item type - check if room to stack
        const roomLeft = item.stackSize - item.count;
        if (roomLeft > 0 && (acceptPartial || roomLeft >= count)) {
          result.push(slot);
        }
      }
    };

    // Check player inventory
    if (playerInventory) {
      for (let i = 9; i <= 44; i++) {
        checkSlot(i, this.bot.inventory.slots[i], false);
      }
    }

    // Check container
    if (container && this.currentContainer.window) {
      const containerSlotCount = this.getContainerSlotCount(this.currentContainer.window);
      for (let i = 0; i < containerSlotCount; i++) {
        checkSlot(i, this.currentContainer.window.slots[i], true);
      }
    }

    return result;
  }

  /**
   * Get item in specific slot
   */
  getItemInSlot(slot: number): Item | null {
    return this.bot.inventory.slots[slot] ?? null;
  }

  /**
   * Get cursor item (item held by mouse in inventory screen)
   */
  getCursorItem(): Item | null {
    return (this.bot.inventory as any).cursor ?? null;
  }

  /**
   * Check if item is in offhand
   */
  hasItemInOffhand(itemName: string): boolean {
    const offhandSlot = this.bot.inventory.slots[45]; // Offhand slot
    return offhandSlot?.name === itemName;
  }

  /**
   * Get all inventory item stacks
   * @param includeCursor Include cursor item
   */
  getInventoryStacks(includeCursor: boolean = false): Item[] {
    const items = [...this.bot.inventory.items()];

    if (includeCursor) {
      const cursor = this.getCursorItem();
      if (cursor) {
        items.push(cursor);
      }
    }

    return items;
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
   * Get cached containers by type
   * @param types Container types to filter by
   */
  getCachedContainers(...types: ContainerType[]): ContainerCache[] {
    const typeSet = new Set(types);
    const dimension = this.bot.game?.dimension ?? 'overworld';

    return Array.from(this.containerCache.values())
      .filter(c => c.dimension === dimension && typeSet.has(c.containerType));
  }

  /**
   * Get closest container of specific type(s)
   * @param types Container types to search for
   */
  getClosestContainer(...types: ContainerType[]): ContainerCache | null {
    const containers = this.getCachedContainers(...types);
    if (containers.length === 0) return null;

    const playerPos = this.bot.entity.position;
    containers.sort((a, b) =>
      a.position.distanceTo(playerPos) - b.position.distanceTo(playerPos)
    );

    return containers[0];
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
