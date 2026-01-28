/**
 * BiomeSearchTask - Biome-based Search and Location Tasks
 * Based on BaritonePlus's biome search system
 *
 * WHY: Some structures and resources spawn only in specific biomes.
 * These tasks help find and navigate within biomes for targeted searching.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { SearchChunksExploreTask, ChunkPos, blockToChunk } from './ChunkSearchTask';
import { GoToBlockTask } from './GoToTask';
import { TimeoutWanderTask } from './MovementUtilTask';

/**
 * Common Minecraft biomes
 */
export const Biomes = {
  // Overworld
  DESERT: 'desert',
  PLAINS: 'plains',
  FOREST: 'forest',
  TAIGA: 'taiga',
  SNOWY_PLAINS: 'snowy_plains',
  JUNGLE: 'jungle',
  SWAMP: 'swamp',
  RIVER: 'river',
  OCEAN: 'ocean',
  BEACH: 'beach',
  MUSHROOM_FIELDS: 'mushroom_fields',
  SAVANNA: 'savanna',
  BADLANDS: 'badlands',
  DARK_FOREST: 'dark_forest',
  MEADOW: 'meadow',
  GROVE: 'grove',
  SNOWY_SLOPES: 'snowy_slopes',
  FROZEN_PEAKS: 'frozen_peaks',
  JAGGED_PEAKS: 'jagged_peaks',
  STONY_PEAKS: 'stony_peaks',
  CHERRY_GROVE: 'cherry_grove',
  DEEP_DARK: 'deep_dark',
  MANGROVE_SWAMP: 'mangrove_swamp',
  LUSH_CAVES: 'lush_caves',
  DRIPSTONE_CAVES: 'dripstone_caves',

  // Nether
  NETHER_WASTES: 'nether_wastes',
  SOUL_SAND_VALLEY: 'soul_sand_valley',
  CRIMSON_FOREST: 'crimson_forest',
  WARPED_FOREST: 'warped_forest',
  BASALT_DELTAS: 'basalt_deltas',

  // End
  THE_END: 'the_end',
  END_HIGHLANDS: 'end_highlands',
  END_MIDLANDS: 'end_midlands',
  SMALL_END_ISLANDS: 'small_end_islands',
  END_BARRENS: 'end_barrens',
} as const;

export type BiomeKey = typeof Biomes[keyof typeof Biomes];

/**
 * State for biome search task
 */
enum BiomeSearchState {
  SEARCHING,
  FOUND,
  FINISHED,
  FAILED
}

/**
 * Task to search for chunks within a specific biome.
 *
 * WHY: Desert temples only spawn in deserts, witch huts in swamps,
 * mushroom cows in mushroom fields. This task explores chunks
 * that are within the target biome, skipping non-matching areas.
 *
 * Based on BaritonePlus SearchWithinBiomeTask.java
 */
export class SearchWithinBiomeTask extends SearchChunksExploreTask {
  private targetBiome: string;
  private searchComplete: boolean = false;

  constructor(bot: Bot, biome: string) {
    super(bot);
    this.targetBiome = biome;
  }

  get displayName(): string {
    return `SearchWithinBiome(${this.targetBiome})`;
  }

  onStart(): void {
    super.onStart();
    this.searchComplete = false;
  }

  /**
   * Check if a chunk is within the target biome
   */
  protected isChunkWithinSearchSpace(pos: ChunkPos): boolean {
    // Get world position from chunk (center of chunk)
    const worldX = pos.x * 16 + 8;
    const worldZ = pos.z * 16 + 8;
    const worldY = Math.floor(this.bot.entity.position.y);

    const biome = this.getBiomeAt(worldX, worldY, worldZ);
    return biome === this.targetBiome;
  }

  /**
   * Perform search within a valid biome chunk
   * This is continuous exploration - we don't "complete" within a chunk
   */
  protected searchWithinChunk(chunk: ChunkPos): Task | null {
    // For biome search, we just want to explore the biome
    // The search is complete when whoever's using us signals completion
    return null;
  }

  /**
   * Check if search is complete
   * For biome search, we continue until manually stopped or max chunks reached
   */
  protected isSearchComplete(): boolean {
    return this.searchComplete;
  }

  /**
   * Mark the search as complete (called externally when target is found)
   */
  markComplete(): void {
    this.searchComplete = true;
  }

  /**
   * Get the biome at a position
   */
  private getBiomeAt(x: number, y: number, z: number): string | null {
    // mineflayer-prismarine provides biome info through the world
    // Note: This is a simplified implementation
    try {
      const block = this.bot.blockAt(new Vec3(x, y, z));
      if (block && (block as any).biome) {
        return (block as any).biome.name;
      }
    } catch (e) {
      // Block not loaded
    }
    return null;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof SearchWithinBiomeTask)) return false;
    return this.targetBiome === other.targetBiome;
  }
}

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
 * Helper function to search within a biome
 */
export function searchWithinBiome(
  bot: Bot,
  biome: string
): SearchWithinBiomeTask {
  return new SearchWithinBiomeTask(bot, biome);
}

/**
 * Helper function to locate a desert temple
 */
export function locateDesertTemple(bot: Bot): LocateDesertTempleTask {
  return new LocateDesertTempleTask(bot);
}

/**
 * Helper function to get current biome at player position
 */
export function getCurrentBiome(bot: Bot): string | null {
  try {
    const pos = bot.entity.position;
    const block = bot.blockAt(pos);
    if (block && (block as any).biome) {
      return (block as any).biome.name;
    }
  } catch (e) {
    // Not available
  }
  return null;
}

/**
 * Check if player is in a specific biome
 */
export function isInBiome(bot: Bot, biome: string): boolean {
  return getCurrentBiome(bot) === biome;
}
