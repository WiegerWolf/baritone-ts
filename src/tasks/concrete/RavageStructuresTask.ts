/**
 * RavageStructuresTask - Structure Looting Tasks
 * Based on BaritonePlus's RavageDesertTemplesTask.java and RavageRuinedPortalsTask.java
 *
 * WHY: Structures contain valuable loot that accelerates progression:
 * - Desert temples: diamonds, emeralds, enchanted books, golden apples
 * - Ruined portals: obsidian, flint and steel, gold equipment
 *
 * These tasks continuously search for and loot structures:
 * 1. Search for structure indicators
 * 2. Navigate to found structures
 * 3. Safely loot containers
 * 4. Continue searching for more
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { LootDesertTempleTask } from './LootDesertTempleTask';
import { LootContainerTask } from './StorageContainerTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { SearchChunkForBlockTask } from './ChunkSearchTask';
import { BlockPos } from '../../types';
import { Dimension } from './ResourceTask';

/**
 * Loot commonly found in desert temples
 */
const DESERT_TEMPLE_LOOT = [
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
 * Loot commonly found in ruined portals
 */
const RUINED_PORTAL_LOOT = [
  'iron_nugget',
  'flint',
  'obsidian',
  'fire_charge',
  'flint_and_steel',
  'gold_nugget',
  'golden_apple',
  'golden_axe',
  'golden_hoe',
  'golden_pickaxe',
  'golden_shovel',
  'golden_sword',
  'golden_helmet',
  'golden_chestplate',
  'golden_leggings',
  'golden_boots',
  'glistering_melon_slice',
  'golden_carrot',
  'gold_ingot',
  'clock',
  'light_weighted_pressure_plate',
  'golden_horse_armor',
  'gold_block',
  'bell',
  'enchanted_golden_apple',
];

/**
 * State for structure ravaging
 */
enum RavageState {
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
 * Task to continuously loot ruined portals.
 *
 * WHY: Ruined portals are found in the overworld near lava/magma
 * and contain valuable gold equipment, obsidian, and flint and steel.
 * They're identified by netherrack blocks nearby.
 *
 * Based on BaritonePlus RavageRuinedPortalsTask.java
 */
export class RavageRuinedPortalsTask extends Task {
  private state: RavageState = RavageState.SEARCHING;
  private lootTask: LootContainerTask | null = null;
  private lootedChests: Set<string> = new Set();
  private notPortalChests: Set<string> = new Set();

  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return `RavageRuinedPortals(looted: ${this.lootedChests.size})`;
  }

  onStart(): void {
    this.state = RavageState.SEARCHING;
    this.lootTask = null;
  }

  onTick(): Task | null {
    // Check dimension - only works in overworld
    const dimension = this.getCurrentDimension();
    if (dimension !== 'overworld') {
      this.state = RavageState.WANDERING;
      return new TimeoutWanderTask(this.bot, 5);
    }

    // Continue looting current chest
    if (this.lootTask && !this.lootTask.isFinished()) {
      this.state = RavageState.LOOTING;
      return this.lootTask;
    }

    // Record looted chest
    if (this.lootTask) {
      this.lootTask = null;
    }

    // Find a portal chest to loot
    const chest = this.findRuinedPortalChest();
    if (chest) {
      const key = `${chest.x},${chest.y},${chest.z}`;
      this.lootedChests.add(key);

      const lootFilter = (itemName: string) => RUINED_PORTAL_LOOT.includes(itemName);
      this.lootTask = new LootContainerTask(this.bot, chest, lootFilter);
      this.state = RavageState.LOOTING;
      return this.lootTask;
    }

    // Wander to find more
    this.state = RavageState.WANDERING;
    return new TimeoutWanderTask(this.bot, 10);
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
   * Find a ruined portal chest
   */
  private findRuinedPortalChest(): BlockPos | null {
    const playerPos = this.bot.entity.position;
    let nearest: BlockPos | null = null;
    let nearestDist = Infinity;

    // Search for chests
    for (let x = -64; x <= 64; x += 4) {
      for (let z = -64; z <= 64; z += 4) {
        for (let y = 30; y <= 120; y += 4) {
          for (let dx = 0; dx < 4; dx++) {
            for (let dz = 0; dz < 4; dz++) {
              const pos = playerPos.offset(x + dx, y - Math.floor(playerPos.y), z + dz);
              const block = this.bot.blockAt(pos);

              if (block && block.name === 'chest') {
                const key = `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;

                // Skip already looted or confirmed non-portal chests
                if (this.lootedChests.has(key) || this.notPortalChests.has(key)) {
                  continue;
                }

                // Check if this looks like a ruined portal chest
                if (this.isRuinedPortalChest(pos)) {
                  const dist = playerPos.distanceTo(pos);
                  if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = new BlockPos(
                      Math.floor(pos.x),
                      Math.floor(pos.y),
                      Math.floor(pos.z)
                    );
                  }
                } else {
                  this.notPortalChests.add(key);
                }
              }
            }
          }
        }
      }
    }

    return nearest;
  }

  /**
   * Check if a chest is likely part of a ruined portal
   */
  private isRuinedPortalChest(chestPos: Vec3): boolean {
    // Skip underwater chests (shipwrecks, ocean ruins)
    const aboveBlock = this.bot.blockAt(chestPos.offset(0, 1, 0));
    if (aboveBlock && aboveBlock.name === 'water') {
      return false;
    }

    // Skip if too low (buried treasure, mineshafts)
    if (chestPos.y < 50) {
      return false;
    }

    // Look for netherrack nearby (ruined portal indicator)
    for (let dx = -4; dx <= 4; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -4; dz <= 4; dz++) {
          const checkPos = chestPos.offset(dx, dy, dz);
          const block = this.bot.blockAt(checkPos);
          if (block && block.name === 'netherrack') {
            return true;
          }
        }
      }
    }

    return false;
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
   * Get number of chests looted
   */
  getChestsLooted(): number {
    return this.lootedChests.size;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof RavageRuinedPortalsTask;
  }
}

/**
 * Convenience function to ravage desert temples
 */
export function ravageDesertTemples(bot: Bot): RavageDesertTemplesTask {
  return new RavageDesertTemplesTask(bot);
}

/**
 * Convenience function to ravage ruined portals
 */
export function ravageRuinedPortals(bot: Bot): RavageRuinedPortalsTask {
  return new RavageRuinedPortalsTask(bot);
}

export { RavageState, DESERT_TEMPLE_LOOT, RUINED_PORTAL_LOOT };
