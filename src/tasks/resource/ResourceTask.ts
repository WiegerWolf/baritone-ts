/**
 * ResourceTask - Multi-Method Item Acquisition Pattern
 * Based on AltoClef's ResourceTask.java
 *
 * ResourceTask provides a standardized approach for acquiring items through
 * multiple methods in priority order:
 * 1. Cursor cleanup (put cursor item back if held)
 * 2. Ground pickup (nearby dropped items)
 * 3. Container looting (known chests with items)
 * 4. Mining (blocks that drop items)
 * 5. Crafting (if recipe available)
 * 6. Subclass-specific logic
 *
 * This pattern ensures bots efficiently obtain items without redundant work.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../base/Task';
import { ItemTarget } from '../../utils/ItemTarget';
import type { EntityTracker } from '../../trackers/EntityTracker';
import type { ItemStorageTracker } from '../../trackers/ItemStorageTracker';
import type { BlockTracker } from '../../trackers/BlockTracker';
import type { StorageHelper } from '../../utils/StorageHelper';
import { ResourceTaskConfig, DEFAULT_CONFIG } from './ResourceTaskConfig';

/**
 * ResourceTask - Abstract base for item acquisition tasks
 */
export abstract class ResourceTask extends Task {
    protected itemTargets: ItemTarget[];
    protected config: ResourceTaskConfig;

    // Trackers (injected by subclass or context)
    protected entityTracker?: EntityTracker;
    protected storageTracker?: ItemStorageTracker;
    protected blockTracker?: BlockTracker;
    protected storageHelper?: StorageHelper;

    constructor(
        bot: Bot,
        itemTargets: ItemTarget[],
        config: Partial<ResourceTaskConfig> = {}
    ) {
        super(bot);
        this.itemTargets = itemTargets;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    get displayName(): string {
        const names = this.itemTargets.map(t => t.toString()).join(', ');
        return `ResourceTask(${names})`;
    }

    /**
     * Set trackers for resource acquisition
     */
    setTrackers(trackers: {
        entityTracker?: EntityTracker;
        storageTracker?: ItemStorageTracker;
        blockTracker?: BlockTracker;
        storageHelper?: StorageHelper;
    }): void {
        this.entityTracker = trackers.entityTracker;
        this.storageTracker = trackers.storageTracker;
        this.blockTracker = trackers.blockTracker;
        this.storageHelper = trackers.storageHelper;
    }

    /**
     * Check if all item targets are satisfied
     */
    isFinished(): boolean {
        for (const target of this.itemTargets) {
            const count = this.getItemCount(target);
            if (!target.isMet(count)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Main tick - implement priority-based acquisition
     */
    onTick(): Task | null {
        // 1. Handle cursor item if held
        if (this.needsCursorCleanup()) {
            const cleanupTask = this.createCursorCleanupTask();
            if (cleanupTask) return cleanupTask;
        }

        // 2. Ground pickup (highest priority - items despawn)
        if (this.config.pickupEnabled) {
            const pickupTask = this.tryGroundPickup();
            if (pickupTask) return pickupTask;
        }

        // 3. Container looting
        if (this.config.containerLootEnabled) {
            const containerTask = this.tryContainerLoot();
            if (containerTask) return containerTask;
        }

        // 4. Mining
        if (this.config.miningEnabled) {
            const mineTask = this.tryMining();
            if (mineTask) return mineTask;
        }

        // 5. Crafting
        if (this.config.craftingEnabled) {
            const craftTask = this.tryCrafting();
            if (craftTask) return craftTask;
        }

        // 6. Subclass-specific logic
        return this.onResourceTick();
    }

    /**
     * Override in subclass for additional acquisition methods
     */
    protected abstract onResourceTick(): Task | null;

    // ---- Cursor Management ----

    /**
     * Check if cursor has item that needs to be put back
     */
    protected needsCursorCleanup(): boolean {
        return (this.bot.inventory as any).cursor !== null;
    }

    /**
     * Create task to put cursor item back
     */
    protected createCursorCleanupTask(): Task | null {
        // This would delegate to a ClickSlotTask to place cursor item
        // For now, return null and let subclass handle
        return null;
    }

    // ---- Ground Pickup ----

    /**
     * Check for dropped items and create pickup task
     */
    protected tryGroundPickup(): Task | null {
        if (!this.entityTracker) return null;

        const itemNames = this.getNeededItemNames();
        if (itemNames.length === 0) return null;

        // Check if any needed items are dropped
        const droppedItems = this.findDroppedItems(itemNames);
        if (droppedItems.length === 0) return null;

        // Sort by distance
        const playerPos = this.bot.entity.position;
        droppedItems.sort((a, b) =>
            a.position.distanceTo(playerPos) - b.position.distanceTo(playerPos)
        );

        // Get closest within range
        const closest = droppedItems[0];
        if (closest.position.distanceTo(playerPos) > this.config.pickupRange) {
            return null;
        }

        // Create pickup task
        return this.createPickupTask(closest);
    }

    /**
     * Find dropped item entities matching names
     */
    protected findDroppedItems(itemNames: string[]): Entity[] {
        const dropped: Entity[] = [];

        for (const entity of Object.values(this.bot.entities)) {
            if (entity.type !== 'object' || entity.name !== 'item') continue;

            // Get item metadata
            const metadata = entity.metadata;
            if (!metadata) continue;

            // Item entities have item data in metadata[8] (version dependent)
            const itemData = (metadata as any).item ?? (metadata as any)[8];
            if (!itemData) continue;

            if (itemNames.includes(itemData.name)) {
                dropped.push(entity);
            }
        }

        return dropped;
    }

    /**
     * Create task to pick up a dropped item
     * Override in subclass for actual implementation
     */
    protected createPickupTask(entity: Entity): Task | null {
        // Would create a GetToEntityTask or similar
        // Subclass should implement
        return null;
    }

    // ---- Container Looting ----

    /**
     * Check known containers for needed items
     */
    protected tryContainerLoot(): Task | null {
        if (!this.storageTracker) return null;

        const itemNames = this.getNeededItemNames();
        if (itemNames.length === 0) return null;

        // Find containers with needed items
        const containers = this.storageTracker.getContainersWithItem(...itemNames);
        if (containers.length === 0) return null;

        // Sort by distance
        const playerPos = this.bot.entity.position;
        containers.sort((a, b) =>
            a.position.distanceTo(playerPos) - b.position.distanceTo(playerPos)
        );

        // Get closest within range
        const closest = containers[0];
        if (closest.position.distanceTo(playerPos) > this.config.containerRange) {
            return null;
        }

        // Create loot task
        return this.createContainerLootTask(closest.position);
    }

    /**
     * Create task to loot a container
     * Override in subclass for actual implementation
     */
    protected createContainerLootTask(containerPos: Vec3): Task | null {
        // Would create a LootContainerTask
        // Subclass should implement
        return null;
    }

    // ---- Mining ----

    /**
     * Find blocks to mine for needed items
     */
    protected tryMining(): Task | null {
        if (!this.blockTracker) return null;

        const blockNames = this.getSourceBlocks();
        if (blockNames.length === 0) return null;

        // Find nearest block
        for (const blockName of blockNames) {
            const pos = this.blockTracker.getNearestBlock(blockName);
            if (!pos) continue;

            const playerPos = this.bot.entity.position;
            if (pos.distanceTo(playerPos) > this.config.miningRange) continue;

            return this.createMineTask(pos, blockName);
        }

        return null;
    }

    /**
     * Get block names that drop needed items
     * Override in subclass for actual mapping
     */
    protected getSourceBlocks(): string[] {
        // Default: no known source blocks
        // Subclass should implement item → block mapping
        return [];
    }

    /**
     * Create task to mine a block
     * Override in subclass for actual implementation
     */
    protected createMineTask(pos: Vec3, blockName: string): Task | null {
        // Would create a MineBlockTask
        // Subclass should implement
        return null;
    }

    // ---- Crafting ----

    /**
     * Try to craft needed items
     */
    protected tryCrafting(): Task | null {
        // Would check recipe registry and create CraftTask
        // Subclass should implement
        return null;
    }

    // ---- Utility Methods ----

    /**
     * Get total count of items matching target
     */
    protected getItemCount(target: ItemTarget): number {
        let count = 0;

        // Count inventory items
        for (const item of this.bot.inventory.items()) {
            if (target.matches(item.name)) {
                count += item.count;
            }
        }

        return count;
    }

    /**
     * Get names of items still needed
     */
    protected getNeededItemNames(): string[] {
        const needed: string[] = [];

        for (const target of this.itemTargets) {
            const count = this.getItemCount(target);
            if (!target.isMet(count)) {
                needed.push(...target.getItemNames());
            }
        }

        return [...new Set(needed)]; // Deduplicate
    }

    /**
     * Get count still needed for target
     */
    protected getNeededCount(target: ItemTarget): number {
        const have = this.getItemCount(target);
        return Math.max(0, target.getTargetCount() - have);
    }

    /**
     * Check if any targets are infinite
     */
    protected hasInfiniteTarget(): boolean {
        return this.itemTargets.some(t => t.isInfinite());
    }
}
