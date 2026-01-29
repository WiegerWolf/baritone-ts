/**
 * LocateDesertTempleTask - Desert temple location task
 * Based on BaritonePlus's LocateDesertTempleTask.java
 *
 * WHY: Desert temples contain valuable loot (diamonds, enchanted items, TNT).
 * They're identified by stone pressure plates (the TNT trap) and are always
 * 14 blocks above the pressure plate.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToBlockTask } from './GoToBlockTask';
import { SearchWithinBiomeTask, Biomes } from './SearchWithinBiomeTask';

/**
 * Configuration for LocateDesertTempleTask
 */
export interface LocateDesertTempleConfig {
  /** Search radius in blocks */
  searchRadius: number;
}

const DEFAULT_TEMPLE_CONFIG: LocateDesertTempleConfig = {
  searchRadius: 2000,
};

/**
 * State for desert temple location task
 */
enum LocateTempleState {
  SEARCHING_BIOME,
  SEARCHING_BLOCKS,
  APPROACHING,
  FINISHED
}

/**
 * Task to locate a desert temple.
 *
 * WHY: Desert temples contain valuable loot (diamonds, enchanted items, TNT).
 * They're identified by stone pressure plates (the TNT trap) and are always
 * 14 blocks above the pressure plate. This task finds the biome, then the
 * structure indicator.
 *
 * Based on BaritonePlus LocateDesertTempleTask.java
 */
export class LocateDesertTempleTask extends Task {
  private config: LocateDesertTempleConfig;
  private state: LocateTempleState = LocateTempleState.SEARCHING_BIOME;
  private foundTemplePos: Vec3 | null = null;

  constructor(bot: Bot, config: Partial<LocateDesertTempleConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_TEMPLE_CONFIG, ...config };
  }

  get displayName(): string {
    return `LocateDesertTemple(${LocateTempleState[this.state]})`;
  }

  onStart(): void {
    this.state = LocateTempleState.SEARCHING_BIOME;
    this.foundTemplePos = null;
  }

  onTick(): Task | null {
    // Check if we've already found a temple
    const temple = this.findNearbyTemple();
    if (temple) {
      // Temple position is 14 blocks above the pressure plate
      this.foundTemplePos = new Vec3(temple.x, temple.y + 14, temple.z);
      this.state = LocateTempleState.APPROACHING;
    }

    switch (this.state) {
      case LocateTempleState.SEARCHING_BIOME:
        return this.handleSearchingBiome();

      case LocateTempleState.SEARCHING_BLOCKS:
        return this.handleSearchingBlocks();

      case LocateTempleState.APPROACHING:
        return this.handleApproaching();

      case LocateTempleState.FINISHED:
        return null;

      default:
        return null;
    }
  }

  private handleSearchingBiome(): Task | null {
    // Search within desert biome
    return new SearchWithinBiomeTask(this.bot, Biomes.DESERT);
  }

  private handleSearchingBlocks(): Task | null {
    // Look for stone pressure plates (temple trap indicator)
    const pressurePlate = this.findNearbyTemple();
    if (pressurePlate) {
      this.foundTemplePos = new Vec3(
        pressurePlate.x,
        pressurePlate.y + 14, // Entrance is 14 blocks above
        pressurePlate.z
      );
      this.state = LocateTempleState.APPROACHING;
      return null;
    }

    // Keep searching in desert
    return new SearchWithinBiomeTask(this.bot, Biomes.DESERT);
  }

  private handleApproaching(): Task | null {
    if (!this.foundTemplePos) {
      this.state = LocateTempleState.SEARCHING_BIOME;
      return null;
    }

    // Check if we've arrived
    const dist = this.bot.entity.position.distanceTo(this.foundTemplePos);
    if (dist < 5) {
      this.state = LocateTempleState.FINISHED;
      return null;
    }

    return new GoToBlockTask(
      this.bot,
      Math.floor(this.foundTemplePos.x),
      Math.floor(this.foundTemplePos.y),
      Math.floor(this.foundTemplePos.z)
    );
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.state === LocateTempleState.FINISHED;
  }

  // ---- Helper methods ----

  /**
   * Search for stone pressure plates (temple indicator)
   */
  private findNearbyTemple(): Vec3 | null {
    const pos = this.bot.entity.position;
    const radius = 64; // Check nearby chunks

    for (let x = -radius; x <= radius; x += 4) {
      for (let z = -radius; z <= radius; z += 4) {
        // Temples are typically at certain Y levels
        for (let y = -20; y <= 20; y++) {
          const checkPos = new Vec3(
            Math.floor(pos.x) + x,
            Math.floor(pos.y) + y,
            Math.floor(pos.z) + z
          );

          const block = this.bot.blockAt(checkPos);
          if (block && block.name === 'stone_pressure_plate') {
            // Verify it's a temple by checking for sandstone nearby
            if (this.hasTempleSandstone(checkPos)) {
              return checkPos;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Verify a pressure plate is part of a temple (has sandstone structure)
   */
  private hasTempleSandstone(pressurePlatePos: Vec3): boolean {
    // Check for sandstone blocks around the pressure plate
    const offsets = [
      [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
      [0, 1, 0], [0, -1, 0],
    ];

    let sandstoneCount = 0;
    for (const [dx, dy, dz] of offsets) {
      const checkPos = new Vec3(
        pressurePlatePos.x + dx,
        pressurePlatePos.y + dy,
        pressurePlatePos.z + dz
      );
      const block = this.bot.blockAt(checkPos);
      if (block && (block.name.includes('sandstone') || block.name === 'tnt')) {
        sandstoneCount++;
      }
    }

    // Temple pressure plate should have sandstone/TNT nearby
    return sandstoneCount >= 2;
  }

  /**
   * Get the found temple position
   */
  getFoundTemplePosition(): Vec3 | null {
    return this.foundTemplePos;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof LocateDesertTempleTask;
  }
}

/**
 * Helper function to locate a desert temple
 */
export function locateDesertTemple(bot: Bot): LocateDesertTempleTask {
  return new LocateDesertTempleTask(bot);
}
