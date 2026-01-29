/**
 * RavageDesertTemplesTask - Desert Temple Looting Task
 * Based on BaritonePlus's RavageDesertTemplesTask.java
 *
 * WHY: Desert temples contain valuable loot that accelerates progression:
 * - diamonds, emeralds, enchanted books, golden apples
 *
 * This task continuously searches for and loots desert temples:
 * 1. Search for structure indicators (pressure plates)
 * 2. Navigate to found structures
 * 3. Safely loot containers
 * 4. Continue searching for more
 */

import type { Bot } from 'mineflayer';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { LootDesertTempleTask } from './LootDesertTempleTask';
import { SearchChunkForBlockTask } from './SearchChunkForBlockTask';
import { BlockPos } from '../../types';

/**
 * Loot commonly found in desert temples
 */
export const DESERT_TEMPLE_LOOT = [
  'bone',
  'rotten_flesh',
  'gunpowder',
  'sand',
  'string',
  'spider_eye',
  'enchanted_book',
  'saddle',
  'golden_apple',
  'gold_ingot',
  'iron_ingot',
  'emerald',
  'iron_horse_armor',
  'golden_horse_armor',
  'diamond',
  'diamond_horse_armor',
  'enchanted_golden_apple',
];

/**
 * State for structure ravaging
 */
export enum RavageState {
  SEARCHING,
  TRAVELING,
  LOOTING,
  WANDERING,
}

/**
 * Task to continuously loot desert temples.
 *
 * WHY: Desert temples are high-value structures with 4 chests
 * containing diamonds, emeralds, and other valuables.
 * This task automates finding and looting them while avoiding
 * the TNT trap.
 *
 * Based on BaritonePlus RavageDesertTemplesTask.java
 */
export class RavageDesertTemplesTask extends Task {
  private state: RavageState = RavageState.SEARCHING;
  private currentTemple: BlockPos | null = null;
  private lootTask: LootDesertTempleTask | null = null;
  private searchTask: SearchChunkForBlockTask;
  private lootedTemples: Set<string> = new Set();

  constructor(bot: Bot) {
    super(bot);
    // Search for pressure plates (temple indicator)
    this.searchTask = new SearchChunkForBlockTask(
      bot,
      ['stone_pressure_plate'],
      10,
      { maxChunksToSearch: 200 }
    );
  }

  get displayName(): string {
    return `RavageDesertTemples(looted: ${this.lootedTemples.size})`;
  }

  onStart(): void {
    this.state = RavageState.SEARCHING;
    this.currentTemple = null;
    this.lootTask = null;
  }

  onTick(): Task | null {
    // Continue looting current temple
    if (this.lootTask && !this.lootTask.isFinished()) {
      this.state = RavageState.LOOTING;
      return this.lootTask;
    }

    // Record looted temple
    if (this.lootTask && this.currentTemple) {
      this.lootedTemples.add(`${this.currentTemple.x},${this.currentTemple.y},${this.currentTemple.z}`);
      this.currentTemple = null;
      this.lootTask = null;
    }

    // Search for new temple
    const temple = this.findUnlootedTemple();
    if (temple) {
      this.currentTemple = temple;
      this.lootTask = new LootDesertTempleTask(this.bot, temple, {
        wantedItems: DESERT_TEMPLE_LOOT,
      });
      this.state = RavageState.LOOTING;
      return this.lootTask;
    }

    // Continue searching
    this.state = RavageState.SEARCHING;
    return this.searchTask;
  }

  /**
   * Find an unlooted temple based on pressure plates
   */
  private findUnlootedTemple(): BlockPos | null {
    const playerPos = this.bot.entity.position;
    let nearest: BlockPos | null = null;
    let nearestDist = Infinity;

    // Look for pressure plates (temple center indicator)
    for (let x = -64; x <= 64; x += 8) {
      for (let z = -64; z <= 64; z += 8) {
        for (let y = -20; y <= 10; y++) {
          const pos = playerPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (block && block.name === 'stone_pressure_plate') {
            const key = `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
            if (!this.lootedTemples.has(key)) {
              const dist = playerPos.distanceTo(pos);
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
        }
      }
    }

    return nearest;
  }

  onStop(interruptTask: ITask | null): void {
    this.lootTask = null;
  }

  isFinished(): boolean {
    // This task runs indefinitely until interrupted
    return false;
  }

  /**
   * Get current state
   */
  getState(): RavageState {
    return this.state;
  }

  /**
   * Get number of temples looted
   */
  getTemplesLooted(): number {
    return this.lootedTemples.size;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof RavageDesertTemplesTask;
  }
}

/**
 * Convenience function to ravage desert temples
 */
export function ravageDesertTemples(bot: Bot): RavageDesertTemplesTask {
  return new RavageDesertTemplesTask(bot);
}
