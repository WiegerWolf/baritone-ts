/**
 * SearchWithinBiomeTask - Biome-based chunk search
 * Based on BaritonePlus's biome search system
 *
 * WHY: Some structures and resources spawn only in specific biomes.
 * This task helps find and navigate within biomes for targeted searching.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { SearchChunksExploreTask, type ChunkPos } from './ChunkSearchTask';

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
 * Helper function to search within a biome
 */
export function searchWithinBiome(
  bot: Bot,
  biome: string
): SearchWithinBiomeTask {
  return new SearchWithinBiomeTask(bot, biome);
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
