/**
 * CoverWithBlocksTask - Cover lava with blocks for safe passage
 * Based on BaritonePlus's construction tasks
 *
 * WHY: Covering lava is essential for Nether safety, preventing falls,
 * creating safe pathways, and enabling exploration of lava-filled areas.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { PlaceBlockTask } from './PlaceBlockTask';
import { MineAndCollectTask } from './MineAndCollectTask';
import { GoToDimensionTask } from '../composite/PortalTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { BlockPos } from '../../types';
import { Dimension, itemTarget } from './ResourceTask';
import { TimerGame } from '../../utils/timers/TimerGame';

/**
 * Throwaway block types for covering
 */
export const THROWAWAY_BLOCKS = [
  'cobblestone',
  'dirt',
  'netherrack',
  'stone',
  'granite',
  'diorite',
  'andesite',
  'deepslate',
  'tuff',
  'blackstone',
];

/**
 * State for lava covering
 */
export enum CoverWithBlocksState {
  GETTING_BLOCKS,
  GOING_TO_NETHER,
  SEARCHING_LAVA,
  COVERING,
}

/**
 * Task to cover lava with blocks for safe passage.
 *
 * WHY: Covering lava is essential for Nether safety:
 * - Prevents falling into lava lakes
 * - Creates safe pathways across dangerous terrain
 * - Enables exploration of lava-filled areas
 * - Protects from fire damage
 *
 * Based on BaritonePlus CoverWithBlocksTask.java
 */
export class CoverWithBlocksTask extends Task {
  private state: CoverWithBlocksState = CoverWithBlocksState.GETTING_BLOCKS;
  private currentLavaPos: BlockPos | null = null;
  private timer: TimerGame;

  constructor(bot: Bot) {
    super(bot);
    this.timer = new TimerGame(bot, 30);
  }

  get displayName(): string {
    return `CoverWithBlocks(state: ${CoverWithBlocksState[this.state]})`;
  }

  onStart(): void {
    this.state = CoverWithBlocksState.GETTING_BLOCKS;
    this.currentLavaPos = null;
    this.timer.reset();
  }

  onTick(): Task | null {
    const throwawayCount = this.getThrowawayCount();

    // Get more blocks if needed
    if (throwawayCount < 128) {
      this.state = CoverWithBlocksState.GETTING_BLOCKS;
      this.timer.reset();

      // Try to collect blocks
      const blockToCollect = this.findCollectableBlock();
      if (blockToCollect) {
        return new MineAndCollectTask(
          this.bot,
          [itemTarget(blockToCollect, 128)],
          [blockToCollect],
          {}
        );
      }

      // Switch dimensions to find blocks
      const dimension = this.getCurrentDimension();
      if (dimension === 'overworld') {
        return new GoToDimensionTask(this.bot, Dimension.NETHER);
      } else if (dimension === 'nether') {
        return new GoToDimensionTask(this.bot, Dimension.OVERWORLD);
      }

      return null;
    }

    // Make sure we're in the Nether
    if (this.getCurrentDimension() !== 'nether') {
      this.state = CoverWithBlocksState.GOING_TO_NETHER;
      this.timer.reset();
      return new GoToDimensionTask(this.bot, Dimension.NETHER);
    }

    // Find lava to cover
    const lavaPos = this.findLavaToCover();
    if (!lavaPos) {
      this.state = CoverWithBlocksState.SEARCHING_LAVA;
      this.timer.reset();
      return new TimeoutWanderTask(this.bot, 10);
    }

    // Cover the lava
    this.state = CoverWithBlocksState.COVERING;
    this.currentLavaPos = lavaPos;

    const throwawayBlock = this.getThrowawayBlock();
    if (throwawayBlock) {
      return new PlaceBlockTask(this.bot, lavaPos.x, lavaPos.y, lavaPos.z, throwawayBlock);
    }

    return null;
  }

  /**
   * Get current dimension
   */
  private getCurrentDimension(): string {
    const dimName = (this.bot as any).game?.dimension || 'overworld';
    if (dimName.includes('nether')) return 'nether';
    if (dimName.includes('end')) return 'the_end';
    return 'overworld';
  }

  /**
   * Count throwaway blocks in inventory
   */
  private getThrowawayCount(): number {
    let count = 0;
    for (const item of this.bot.inventory.items()) {
      if (THROWAWAY_BLOCKS.includes(item.name)) {
        count += item.count;
      }
    }
    return count;
  }

  /**
   * Find a block type we can collect
   */
  private findCollectableBlock(): string | null {
    // Use mineflayer's indexed findBlock instead of brute-force nested loops
    const result = this.bot.findBlock({
      matching: (block: any) => THROWAWAY_BLOCKS.includes(block.name),
      maxDistance: 16,
    });
    return result?.name ?? null;
  }

  /**
   * Get a throwaway block from inventory
   */
  private getThrowawayBlock(): string | null {
    for (const item of this.bot.inventory.items()) {
      if (THROWAWAY_BLOCKS.includes(item.name)) {
        return item.name;
      }
    }
    return null;
  }

  /**
   * Find lava source to cover
   */
  private findLavaToCover(): BlockPos | null {
    // Use mineflayer's indexed findBlocks instead of brute-force nested loops
    const positions = this.bot.findBlocks({
      matching: (block: any) => block.name === 'lava',
      maxDistance: 32,
      count: 64,
    });

    const playerPos = this.bot.entity.position;
    let nearest: BlockPos | null = null;
    let nearestDist = Infinity;

    for (const pos of positions) {
      const vec = new Vec3(pos.x, pos.y, pos.z);
      if (this.isValidLavaToCover(vec)) {
        const dist = playerPos.distanceTo(vec);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = new BlockPos(
            Math.floor(pos.x),
            Math.floor(pos.y),
            Math.floor(pos.z)
          );
        }
      }
    }

    return nearest;
  }

  /**
   * Check if lava position is valid to cover
   */
  private isValidLavaToCover(pos: Vec3): boolean {
    // Air must be above the lava
    const aboveBlock = this.bot.blockAt(pos.offset(0, 1, 0));
    if (!aboveBlock || aboveBlock.name !== 'air') {
      return false;
    }

    // At least one adjacent block should not be lava (edge of pool)
    const adjacents = [
      pos.offset(1, 0, 0),
      pos.offset(-1, 0, 0),
      pos.offset(0, 0, 1),
      pos.offset(0, 0, -1),
    ];

    for (const adj of adjacents) {
      const adjBlock = this.bot.blockAt(adj);
      if (!adjBlock || adjBlock.name !== 'lava') {
        return true;
      }
    }

    return false;
  }

  onStop(interruptTask: ITask | null): void {
    this.currentLavaPos = null;
  }

  isFinished(): boolean {
    // This task runs continuously until interrupted
    return false;
  }

  /**
   * Get current state
   */
  getState(): CoverWithBlocksState {
    return this.state;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof CoverWithBlocksTask;
  }
}

/**
 * Convenience function to cover lava with blocks
 */
export function coverWithBlocks(bot: Bot): CoverWithBlocksTask {
  return new CoverWithBlocksTask(bot);
}
