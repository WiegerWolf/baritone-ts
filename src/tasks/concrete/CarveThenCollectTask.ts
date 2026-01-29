/**
 * CarveThenCollectTask - Carve blocks before collecting them
 * Based on BaritonePlus's CarveThenCollectTask.java
 *
 * WHY this task matters:
 * - Carved pumpkins needed for iron golems and jack-o-lanterns
 * - Requires tool interaction, not just mining
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { ResourceTask, ItemTarget, itemTarget } from './ResourceTask';
import { DestroyBlockTask, PlaceBlockNearbyTask } from './ConstructionTask';
import { InteractWithBlockTask } from './InteractWithBlockTask';

/**
 * State for carve then collect task
 */
export enum CarveState {
  GETTING_TOOL,
  FINDING_CARVED_BLOCK,
  BREAKING_CARVED_BLOCK,
  FINDING_CARVE_BLOCK,
  CARVING_BLOCK,
  COLLECTING_BLOCKS,
  PLACING_BLOCKS,
}

/**
 * Task to carve blocks before collecting them.
 *
 * WHY: Some items require carving blocks first:
 * - Carved pumpkins from pumpkins (using shears)
 * - Used for iron golems and jack-o-lanterns
 *
 * Based on BaritonePlus CarveThenCollectTask.java
 */
export class CarveThenCollectTask extends ResourceTask {
  private targetBlocks: string[];
  private toCarveBlocks: string[];
  private carveWithItem: string;
  private toCarveItem: string;
  private state: CarveState = CarveState.GETTING_TOOL;

  /**
   * @param bot The bot instance
   * @param target The target item to collect (e.g., carved_pumpkin)
   * @param targetBlocks The blocks that drop the target (e.g., carved_pumpkin block)
   * @param toCarve The item form of the block to carve (e.g., pumpkin item)
   * @param toCarveBlocks The blocks to carve (e.g., pumpkin block)
   * @param carveWith The item to carve with (e.g., shears)
   */
  constructor(
    bot: Bot,
    target: ItemTarget,
    targetBlocks: string[],
    toCarve: ItemTarget,
    toCarveBlocks: string[],
    carveWith: string
  ) {
    super(bot, [target]);
    this.targetBlocks = targetBlocks;
    this.toCarveBlocks = toCarveBlocks;
    this.carveWithItem = carveWith;
    this.toCarveItem = toCarve.items[0];
  }

  get displayName(): string {
    return `CarveThenCollect(${this.itemTargets[0].items[0]})`;
  }

  protected onResourceStart(): void {
    this.state = CarveState.GETTING_TOOL;
  }

  protected onResourceTick(): Task | null {
    const targetItem = this.itemTargets[0].items[0];
    const targetCount = this.itemTargets[0].targetCount;
    const currentCount = this.countItemByName(targetItem);
    const neededCount = targetCount - currentCount;

    if (neededCount <= 0) {
      return null; // Done
    }

    // If target block is found, break it
    const targetBlock = this.findNearbyBlock(this.targetBlocks);
    if (targetBlock) {
      this.state = CarveState.BREAKING_CARVED_BLOCK;
      return new DestroyBlockTask(this.bot, targetBlock.x, targetBlock.y, targetBlock.z);
    }

    // Make sure we have the carving tool
    if (!this.hasItemByName(this.carveWithItem)) {
      this.state = CarveState.GETTING_TOOL;
      // Would return task to get tool
      return null;
    }

    // If carve block is found, carve it
    const carveBlock = this.findNearbyBlock(this.toCarveBlocks);
    if (carveBlock) {
      this.state = CarveState.CARVING_BLOCK;
      return new InteractWithBlockTask(this.bot, {
        target: new BlockPos(carveBlock.x, carveBlock.y, carveBlock.z),
        itemToUse: this.carveWithItem,
      });
    }

    // Check if we have enough blocks to place and carve
    const currentCarveItems = this.countItemByName(this.toCarveItem);
    if (neededCount > currentCarveItems) {
      // Need to collect more blocks to carve
      this.state = CarveState.COLLECTING_BLOCKS;
      // Would return task to collect blocks
      return null;
    } else {
      // Place blocks to carve
      this.state = CarveState.PLACING_BLOCKS;
      return new PlaceBlockNearbyTask(this.bot, this.toCarveBlocks);
    }
  }

  protected onResourceStop(interruptTask: ITask | null): void {
    // Clean up
  }

  /**
   * Get current state
   */
  getState(): CarveState {
    return this.state;
  }

  /**
   * Get item count from inventory by name
   */
  private countItemByName(itemName: string): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (item.name.includes(itemName)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Check if player has item by name
   */
  private hasItemByName(itemName: string): boolean {
    return this.countItemByName(itemName) > 0;
  }

  /**
   * Find nearby block from list
   */
  private findNearbyBlock(blockNames: string[]): Vec3 | null {
    const playerPos = this.bot.entity.position;

    for (let x = -16; x <= 16; x++) {
      for (let z = -16; z <= 16; z++) {
        for (let y = -8; y <= 8; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);
          if (block && blockNames.some(name => block.name.includes(name))) {
            return pos;
          }
        }
      }
    }

    return null;
  }

  protected isEqualResource(other: ResourceTask): boolean {
    if (other instanceof CarveThenCollectTask) {
      return (
        this.itemTargets[0].items[0] === other.itemTargets[0].items[0] &&
        this.toCarveItem === other.toCarveItem
      );
    }
    return false;
  }
}

/**
 * Convenience function to create CarveThenCollectTask for carved pumpkins
 */
export function collectCarvedPumpkins(bot: Bot, count: number): CarveThenCollectTask {
  return new CarveThenCollectTask(
    bot,
    itemTarget('carved_pumpkin', count),
    ['carved_pumpkin'],
    itemTarget('pumpkin', count),
    ['pumpkin'],
    'shears'
  );
}
