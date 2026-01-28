/**
 * ContainerTask - Container Interaction Tasks
 * Based on BaritonePlus's container interaction system
 *
 * Tasks for interacting with containers - finding, opening, and manipulating
 * items within containers like chests, crafting tables, furnaces, etc.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask } from './GoToTask';
import { InteractBlockTask } from './InteractTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { BlockPos } from '../../types';

/**
 * Container type enum
 */
export enum ContainerType {
  CHEST = 'chest',
  TRAPPED_CHEST = 'trapped_chest',
  BARREL = 'barrel',
  ENDER_CHEST = 'ender_chest',
  SHULKER_BOX = 'shulker_box',
  FURNACE = 'furnace',
  BLAST_FURNACE = 'blast_furnace',
  SMOKER = 'smoker',
  CRAFTING_TABLE = 'crafting_table',
  ANVIL = 'anvil',
  SMITHING_TABLE = 'smithing_table',
  ENCHANTING_TABLE = 'enchanting_table',
  BREWING_STAND = 'brewing_stand',
  HOPPER = 'hopper',
  DISPENSER = 'dispenser',
  DROPPER = 'dropper',
  CARTOGRAPHY_TABLE = 'cartography_table',
  LOOM = 'loom',
  STONECUTTER = 'stonecutter',
  GRINDSTONE = 'grindstone',
}

/**
 * Get block names for a container type
 */
export function getContainerBlocks(type: ContainerType): string[] {
  switch (type) {
    case ContainerType.SHULKER_BOX:
      return [
        'shulker_box',
        'white_shulker_box', 'orange_shulker_box', 'magenta_shulker_box',
        'light_blue_shulker_box', 'yellow_shulker_box', 'lime_shulker_box',
        'pink_shulker_box', 'gray_shulker_box', 'light_gray_shulker_box',
        'cyan_shulker_box', 'purple_shulker_box', 'blue_shulker_box',
        'brown_shulker_box', 'green_shulker_box', 'red_shulker_box',
        'black_shulker_box'
      ];
    case ContainerType.ANVIL:
      return ['anvil', 'chipped_anvil', 'damaged_anvil'];
    default:
      return [type];
  }
}

/**
 * Check if a block is a container type
 */
export function isContainerBlock(blockName: string, type: ContainerType): boolean {
  const blocks = getContainerBlocks(type);
  return blocks.some(b => blockName === b || blockName.includes(b));
}

/**
 * State for container interaction
 */
enum ContainerState {
  FINDING_CONTAINER,
  GETTING_CONTAINER_ITEM,
  PLACING_CONTAINER,
  GOING_TO_CONTAINER,
  OPENING_CONTAINER,
  WORKING_IN_CONTAINER,
  CLOSING,
  FINISHED,
  FAILED
}

/**
 * Configuration for DoStuffInContainerTask
 */
export interface ContainerTaskConfig {
  /** Container block types to use */
  containerBlocks: string[];
  /** Item name to use if we need to craft/get a container */
  containerItem: string;
  /** Max distance to walk to existing container before placing new one */
  maxWalkDistance: number;
  /** Whether to place a new container if none found */
  canPlaceNew: boolean;
  /** Time to wait after placing before interacting */
  placeWaitTime: number;
  /** Search radius for containers */
  searchRadius: number;
}

const DEFAULT_CONFIG: Partial<ContainerTaskConfig> = {
  maxWalkDistance: 64,
  canPlaceNew: true,
  placeWaitTime: 0.5,
  searchRadius: 32,
};

/**
 * Abstract base class for tasks that interact with containers.
 *
 * WHY: Many tasks need to interact with containers (chests, crafting tables, furnaces).
 * This base class handles the common logic of finding/placing containers and opening them,
 * allowing subclasses to focus on what to do once the container is open.
 *
 * Based on BaritonePlus DoStuffInContainerTask.java
 */
export abstract class DoStuffInContainerTask extends Task {
  protected config: ContainerTaskConfig;
  private state: ContainerState = ContainerState.FINDING_CONTAINER;
  private targetContainer: Block | null = null;
  private cachedContainerPos: BlockPos | null = null;
  private placeForceTimer: TimerGame;
  private justPlacedTimer: TimerGame;
  private windowOpen: boolean = false;

  constructor(bot: Bot, config: Partial<ContainerTaskConfig> & { containerBlocks: string[], containerItem: string }) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config } as ContainerTaskConfig;
    this.placeForceTimer = new TimerGame(bot, 10); // Force place for 10 seconds
    this.justPlacedTimer = new TimerGame(bot, 3);  // Wait 3 seconds after placing
  }

  get displayName(): string {
    return `DoStuffInContainer(${this.config.containerItem})`;
  }

  onStart(): void {
    this.state = ContainerState.FINDING_CONTAINER;
    this.targetContainer = null;
    this.cachedContainerPos = null;
    this.windowOpen = false;
  }

  onTick(): Task | null {
    switch (this.state) {
      case ContainerState.FINDING_CONTAINER:
        return this.handleFindingContainer();

      case ContainerState.GETTING_CONTAINER_ITEM:
        return this.handleGettingContainerItem();

      case ContainerState.PLACING_CONTAINER:
        return this.handlePlacingContainer();

      case ContainerState.GOING_TO_CONTAINER:
        return this.handleGoingToContainer();

      case ContainerState.OPENING_CONTAINER:
        return this.handleOpeningContainer();

      case ContainerState.WORKING_IN_CONTAINER:
        return this.handleWorkingInContainer();

      case ContainerState.CLOSING:
        return this.handleClosing();

      default:
        return null;
    }
  }

  private handleFindingContainer(): Task | null {
    // Check if we need to place a new container
    const nearest = this.findNearestContainer();

    if (!nearest) {
      if (this.config.canPlaceNew) {
        // Need to get and place a container
        if (this.hasContainerItem()) {
          this.state = ContainerState.PLACING_CONTAINER;
        } else {
          this.state = ContainerState.GETTING_CONTAINER_ITEM;
        }
      } else {
        this.state = ContainerState.FAILED;
      }
      return null;
    }

    // Check if it's cheaper to place a new one
    const walkCost = this.calculateWalkCost(nearest.position);
    const placeCost = this.getCostToMakeNew();

    if (walkCost > placeCost && this.config.canPlaceNew && !this.justPlacedTimer.elapsed()) {
      this.placeForceTimer.reset();
    }

    if (walkCost > this.config.maxWalkDistance || (!this.placeForceTimer.elapsed() && this.justPlacedTimer.elapsed())) {
      if (this.config.canPlaceNew) {
        if (this.hasContainerItem()) {
          this.state = ContainerState.PLACING_CONTAINER;
        } else {
          this.state = ContainerState.GETTING_CONTAINER_ITEM;
        }
        return null;
      }
    }

    this.targetContainer = nearest;
    this.cachedContainerPos = new BlockPos(
      Math.floor(nearest.position.x),
      Math.floor(nearest.position.y),
      Math.floor(nearest.position.z)
    );
    this.state = ContainerState.GOING_TO_CONTAINER;
    return null;
  }

  private handleGettingContainerItem(): Task | null {
    // Subclass should override this to get the container item
    // Default: fail
    this.state = ContainerState.FAILED;
    return null;
  }

  private handlePlacingContainer(): Task | null {
    // Subclass should override this to place the container
    // Default: fail
    this.state = ContainerState.FAILED;
    return null;
  }

  private handleGoingToContainer(): Task | null {
    if (!this.targetContainer) {
      this.state = ContainerState.FINDING_CONTAINER;
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.targetContainer.position);
    if (dist <= 4.0) {
      this.state = ContainerState.OPENING_CONTAINER;
      return null;
    }

    return new GetToBlockTask(
      this.bot,
      Math.floor(this.targetContainer.position.x),
      Math.floor(this.targetContainer.position.y),
      Math.floor(this.targetContainer.position.z)
    );
  }

  private handleOpeningContainer(): Task | null {
    // Check if already open
    if (this.isContainerOpen()) {
      this.windowOpen = true;
      this.state = ContainerState.WORKING_IN_CONTAINER;
      return null;
    }

    if (!this.targetContainer) {
      this.state = ContainerState.FINDING_CONTAINER;
      return null;
    }

    return InteractBlockTask.fromVec3(this.bot, this.targetContainer.position);
  }

  private handleWorkingInContainer(): Task | null {
    // Check if container is still open
    if (!this.isContainerOpen()) {
      this.windowOpen = false;
      this.state = ContainerState.OPENING_CONTAINER;
      return null;
    }

    // Delegate to subclass
    return this.containerSubTask();
  }

  private handleClosing(): Task | null {
    this.closeContainer();
    this.state = ContainerState.FINISHED;
    return null;
  }

  onStop(interruptTask: ITask | null): void {
    this.closeContainer();
    this.targetContainer = null;
    this.cachedContainerPos = null;
    this.windowOpen = false;
  }

  isFinished(): boolean {
    return this.state === ContainerState.FINISHED || this.state === ContainerState.FAILED;
  }

  isFailed(): boolean {
    return this.state === ContainerState.FAILED;
  }

  // ---- Abstract methods for subclasses ----

  /**
   * Called when the container is open. Return a subtask to do work,
   * or null when finished.
   */
  protected abstract containerSubTask(): Task | null;

  /**
   * Check if the container is open (screen handler active).
   */
  protected abstract isContainerOpen(): boolean;

  /**
   * Get the cost of making a new container (for cost comparison).
   * Return Infinity if can't make new.
   */
  protected getCostToMakeNew(): number {
    if (!this.config.canPlaceNew) return Infinity;
    // Default: prefer existing containers within 30 blocks
    return 30;
  }

  // ---- Helper methods ----

  protected findNearestContainer(): Block | null {
    const playerPos = this.bot.entity.position;
    let nearest: Block | null = null;
    let nearestDist = Infinity;

    const radius = this.config.searchRadius;
    for (let x = -radius; x <= radius; x += 2) {
      for (let z = -radius; z <= radius; z += 2) {
        for (let y = -10; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block) continue;

          // Check if it's a valid container
          if (!this.isValidContainerBlock(block.name)) continue;

          // Additional checks (can be overridden)
          if (!this.canUseContainer(block)) continue;

          const dist = playerPos.distanceTo(pos);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = block;
          }
        }
      }
    }

    return nearest;
  }

  protected isValidContainerBlock(blockName: string): boolean {
    return this.config.containerBlocks.some(b =>
      blockName === b || blockName.includes(b)
    );
  }

  /**
   * Additional check if container can be used (e.g., not blocked).
   * Can be overridden by subclasses.
   */
  protected canUseContainer(block: Block): boolean {
    // Check if block above is not solid (for chests)
    if (block.name.includes('chest')) {
      const above = this.bot.blockAt(block.position.offset(0, 1, 0));
      if (above && above.boundingBox === 'block') {
        return false;
      }
    }
    return true;
  }

  protected hasContainerItem(): boolean {
    return this.bot.inventory.items().some(item =>
      item.name === this.config.containerItem ||
      this.config.containerBlocks.includes(item.name)
    );
  }

  protected calculateWalkCost(pos: Vec3): number {
    const playerPos = this.bot.entity.position;
    const dx = pos.x - playerPos.x;
    const dy = pos.y - playerPos.y;
    const dz = pos.z - playerPos.z;
    return Math.sqrt(dx * dx + dz * dz) + Math.abs(dy) * 2;
  }

  protected closeContainer(): void {
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
    }
  }

  protected getTargetContainerPosition(): BlockPos | null {
    return this.cachedContainerPos;
  }

  /**
   * Mark that work in container is done
   */
  protected finishContainerWork(): void {
    this.state = ContainerState.CLOSING;
  }

  /**
   * Mark task as failed
   */
  protected failTask(): void {
    this.state = ContainerState.FAILED;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof DoStuffInContainerTask)) return false;
    return JSON.stringify(this.config) === JSON.stringify(other.config);
  }
}

/**
 * Abstract base class for storage container tasks (chests, barrels, etc.)
 *
 * WHY: Storage containers have different semantics than crafting stations.
 * They store items persistently and can be tracked across sessions.
 * This class provides container tracking and caching functionality.
 */
export abstract class AbstractDoToStorageContainerTask extends Task {
  private currentContainerType: ContainerType | null = null;

  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return 'DoToStorageContainer';
  }

  onStart(): void {
    this.currentContainerType = null;
  }

  onTick(): Task | null {
    const containerTarget = this.getContainerTarget();

    // No container found
    if (!containerTarget) {
      this.currentContainerType = null;
      return this.onSearchWander();
    }

    // Check if container is open
    if (this.currentContainerType !== null && this.isContainerScreenOpen()) {
      return this.onContainerOpenSubtask(containerTarget);
    }

    // Get container type from block
    const block = this.bot.blockAt(new Vec3(containerTarget.x, containerTarget.y, containerTarget.z));
    if (block) {
      this.currentContainerType = this.getContainerTypeFromBlock(block.name);
    }

    // Clear block above chest if needed
    if (block && block.name.includes('chest')) {
      const above = this.bot.blockAt(block.position.offset(0, 1, 0));
      if (above && above.boundingBox === 'block') {
        // Would need DestroyBlockTask here, but return wander for now
        return this.onSearchWander();
      }
    }

    // Go to and open container
    return InteractBlockTask.fromBlockPos(this.bot, containerTarget);
  }

  onStop(interruptTask: ITask | null): void {
    // Close any open window
    const window = (this.bot as any).currentWindow;
    if (window) {
      try {
        this.bot.closeWindow(window);
      } catch {
        // Ignore
      }
    }
  }

  isFinished(): boolean {
    return false; // Subclass determines
  }

  // ---- Abstract methods ----

  /**
   * Get the position of the container to target
   */
  protected abstract getContainerTarget(): BlockPos | null;

  /**
   * Called when container is open and ready for work
   */
  protected abstract onContainerOpenSubtask(containerPos: BlockPos): Task | null;

  // ---- Virtual methods ----

  /**
   * Called when no container is found - default wanders
   */
  protected onSearchWander(): Task {
    return new TimeoutWanderTask(this.bot);
  }

  // ---- Helper methods ----

  protected isContainerScreenOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    if (!window) return false;

    const type = (window.type || '').toLowerCase();
    return type.includes('chest') ||
           type.includes('barrel') ||
           type.includes('shulker') ||
           type.includes('generic') ||
           type.includes('hopper') ||
           type.includes('dispenser') ||
           type.includes('dropper');
  }

  protected getContainerTypeFromBlock(blockName: string): ContainerType | null {
    if (blockName.includes('chest')) return ContainerType.CHEST;
    if (blockName.includes('barrel')) return ContainerType.BARREL;
    if (blockName.includes('shulker')) return ContainerType.SHULKER_BOX;
    if (blockName.includes('hopper')) return ContainerType.HOPPER;
    if (blockName.includes('dispenser')) return ContainerType.DISPENSER;
    if (blockName.includes('dropper')) return ContainerType.DROPPER;
    if (blockName.includes('ender_chest')) return ContainerType.ENDER_CHEST;
    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return this.constructor === other.constructor;
  }
}

/**
 * Task to do something at a crafting table.
 *
 * WHY: Crafting table operations require opening the table,
 * placing items in the grid, and receiving the output.
 * This task handles finding/placing a crafting table and opening it.
 */
export class CraftInTableTask extends DoStuffInContainerTask {
  private finished: boolean = false;

  constructor(bot: Bot) {
    super(bot, {
      containerBlocks: ['crafting_table'],
      containerItem: 'crafting_table',
      canPlaceNew: true,
    });
  }

  get displayName(): string {
    return 'CraftInTable';
  }

  protected containerSubTask(): Task | null {
    // Subclass should implement actual crafting logic
    // This base implementation just opens the table
    this.finished = true;
    this.finishContainerWork();
    return null;
  }

  protected isContainerOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    if (!window) return false;
    const type = (window.type || '').toLowerCase();
    return type.includes('crafting');
  }

  isFinished(): boolean {
    return this.finished || super.isFinished();
  }
}

/**
 * Task to smelt items in a furnace.
 *
 * WHY: Smelting requires putting fuel, input items, and waiting
 * for the output. This base class handles furnace interaction.
 */
export class SmeltInFurnaceBaseTask extends DoStuffInContainerTask {
  private finished: boolean = false;

  constructor(bot: Bot, furnaceType: 'furnace' | 'blast_furnace' | 'smoker' = 'furnace') {
    super(bot, {
      containerBlocks: [furnaceType],
      containerItem: furnaceType,
      canPlaceNew: true,
    });
  }

  get displayName(): string {
    return `SmeltInFurnace(${this.config.containerBlocks[0]})`;
  }

  protected containerSubTask(): Task | null {
    // Subclass should implement actual smelting logic
    this.finished = true;
    this.finishContainerWork();
    return null;
  }

  protected isContainerOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    if (!window) return false;
    const type = (window.type || '').toLowerCase();
    return type.includes('furnace') || type.includes('smoker') || type.includes('blast');
  }

  isFinished(): boolean {
    return this.finished || super.isFinished();
  }
}

/**
 * Task to upgrade items in a smithing table.
 *
 * WHY: Smithing table operations are special - they upgrade
 * diamond gear to netherite. This requires specific item placement.
 */
export class UpgradeInSmithingTableTask extends DoStuffInContainerTask {
  private finished: boolean = false;

  constructor(bot: Bot) {
    super(bot, {
      containerBlocks: ['smithing_table'],
      containerItem: 'smithing_table',
      canPlaceNew: true,
    });
  }

  get displayName(): string {
    return 'UpgradeInSmithingTable';
  }

  protected containerSubTask(): Task | null {
    // Subclass should implement actual smithing logic
    this.finished = true;
    this.finishContainerWork();
    return null;
  }

  protected isContainerOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    if (!window) return false;
    const type = (window.type || '').toLowerCase();
    return type.includes('smithing');
  }

  isFinished(): boolean {
    return this.finished || super.isFinished();
  }
}

/**
 * Task to repair/combine items in an anvil.
 *
 * WHY: Anvil operations can rename, repair, or combine items.
 * Each operation has an XP cost that needs to be checked.
 */
export class CraftInAnvilTask extends DoStuffInContainerTask {
  private finished: boolean = false;

  constructor(bot: Bot) {
    super(bot, {
      containerBlocks: ['anvil', 'chipped_anvil', 'damaged_anvil'],
      containerItem: 'anvil',
      canPlaceNew: true,
    });
  }

  get displayName(): string {
    return 'CraftInAnvil';
  }

  protected containerSubTask(): Task | null {
    // Subclass should implement actual anvil logic
    this.finished = true;
    this.finishContainerWork();
    return null;
  }

  protected isContainerOpen(): boolean {
    const window = (this.bot as any).currentWindow;
    if (!window) return false;
    const type = (window.type || '').toLowerCase();
    return type.includes('anvil');
  }

  isFinished(): boolean {
    return this.finished || super.isFinished();
  }
}
