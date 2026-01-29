/**
 * RavageRuinedPortalsTask - Ruined Portal Looting Task
 * Based on BaritonePlus's RavageRuinedPortalsTask.java
 *
 * WHY: Ruined portals contain valuable loot that accelerates progression:
 * - obsidian, flint and steel, gold equipment
 *
 * This task continuously searches for and loots ruined portals:
 * 1. Search for structure indicators (netherrack near chests)
 * 2. Navigate to found structures
 * 3. Safely loot containers
 * 4. Continue searching for more
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { LootContainerTask } from './LootContainerTask';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { BlockPos } from '../../types';
import { RavageState } from './RavageDesertTemplesTask';

/**
 * Loot commonly found in ruined portals
 */
export const RUINED_PORTAL_LOOT = [
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
 * Convenience function to ravage ruined portals
 */
export function ravageRuinedPortals(bot: Bot): RavageRuinedPortalsTask {
  return new RavageRuinedPortalsTask(bot);
}
