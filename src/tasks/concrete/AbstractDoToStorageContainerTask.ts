/**
 * AbstractDoToStorageContainerTask - Storage Container Base Task
 * Based on BaritonePlus's storage container interaction system
 *
 * Abstract base class for storage container tasks (chests, barrels, etc.)
 * Provides container tracking and caching functionality.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { InteractBlockTask } from './InteractTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { ContainerType } from './DoStuffInContainerTask';
import { BlockPos } from '../../types';

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
