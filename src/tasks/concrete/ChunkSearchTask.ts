/**
 * ChunkSearchTask - Chunk-based Exploration Tasks
 * Based on BaritonePlus's SearchChunksExploreTask.java and SearchChunkForBlockTask.java
 *
 * WHY: Minecraft worlds are organized into chunks (16x16 blocks). For finding
 * structures, biomes, or specific blocks, chunk-based searching is more efficient
 * than block-by-block searching. This task explores chunks systematically.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { TimeoutWanderTask } from './TimeoutWanderTask';
import { GoToNearTask } from './GoToNearTask';

/**
 * Chunk position (chunk coordinates, not block coordinates)
 */
export interface ChunkPos {
  x: number;
  z: number;
}

/**
 * Convert block position to chunk position
 */
export function blockToChunk(blockX: number, blockZ: number): ChunkPos {
  return {
    x: Math.floor(blockX / 16),
    z: Math.floor(blockZ / 16),
  };
}

/**
 * Convert chunk position to center block position
 */
export function chunkToBlock(chunk: ChunkPos, y: number = 64): Vec3 {
  return new Vec3(chunk.x * 16 + 8, y, chunk.z * 16 + 8);
}

/**
 * State for chunk search task
 */
enum ChunkSearchState {
  SCANNING_LOADED,
  EXPLORING,
  SEARCHING_CHUNK,
  GOING_TO_CHUNK,
  FINISHED,
  FAILED
}

/**
 * Configuration for chunk search
 */
export interface ChunkSearchConfig {
  /** Maximum chunks to search before giving up */
  maxChunksToSearch: number;
  /** Whether to continue exploring when no valid chunks found */
  exploreWhenEmpty: boolean;
}

const DEFAULT_CONFIG: ChunkSearchConfig = {
  maxChunksToSearch: 100,
  exploreWhenEmpty: true,
};

/**
 * Abstract base class for chunk-based exploration.
 *
 * WHY: Many search tasks follow the same pattern:
 * 1. Check loaded chunks for the target
 * 2. If not found, explore to load new chunks
 * 3. When a valid chunk is found, search within it
 *
 * Subclasses define what makes a chunk "valid" for their purpose.
 *
 * Based on BaritonePlus SearchChunksExploreTask.java
 */
export abstract class SearchChunksExploreTask extends Task {
  protected config: ChunkSearchConfig;
  protected state: ChunkSearchState = ChunkSearchState.SCANNING_LOADED;
  protected exploredChunks: Set<string> = new Set();
  protected currentTargetChunk: ChunkPos | null = null;
  protected chunksSearched: number = 0;

  constructor(bot: Bot, config: Partial<ChunkSearchConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  onStart(): void {
    this.state = ChunkSearchState.SCANNING_LOADED;
    this.exploredChunks.clear();
    this.currentTargetChunk = null;
    this.chunksSearched = 0;
  }

  onTick(): Task | null {
    // Check termination conditions
    if (this.chunksSearched >= this.config.maxChunksToSearch) {
      this.state = ChunkSearchState.FAILED;
      return null;
    }

    switch (this.state) {
      case ChunkSearchState.SCANNING_LOADED:
        return this.handleScanningLoaded();

      case ChunkSearchState.EXPLORING:
        return this.handleExploring();

      case ChunkSearchState.SEARCHING_CHUNK:
        return this.handleSearchingChunk();

      case ChunkSearchState.GOING_TO_CHUNK:
        return this.handleGoingToChunk();

      default:
        return null;
    }
  }

  private handleScanningLoaded(): Task | null {
    // Scan currently loaded chunks
    const validChunk = this.findValidLoadedChunk();

    if (validChunk) {
      this.currentTargetChunk = validChunk;
      this.state = ChunkSearchState.SEARCHING_CHUNK;
      return null;
    }

    // No valid chunks loaded, start exploring
    if (this.config.exploreWhenEmpty) {
      this.state = ChunkSearchState.EXPLORING;
    } else {
      this.state = ChunkSearchState.FAILED;
    }

    return null;
  }

  private handleExploring(): Task | null {
    // Check if any new chunks have become valid
    const validChunk = this.findValidLoadedChunk();

    if (validChunk) {
      this.currentTargetChunk = validChunk;
      this.state = ChunkSearchState.SEARCHING_CHUNK;
      return null;
    }

    // Continue wandering to load new chunks
    return this.getWanderTask();
  }

  private handleSearchingChunk(): Task | null {
    if (!this.currentTargetChunk) {
      this.state = ChunkSearchState.SCANNING_LOADED;
      return null;
    }

    // Mark chunk as explored
    const chunkKey = `${this.currentTargetChunk.x},${this.currentTargetChunk.z}`;
    this.exploredChunks.add(chunkKey);
    this.chunksSearched++;

    // Call subclass to handle the specific search
    const result = this.searchWithinChunk(this.currentTargetChunk);

    if (this.isSearchComplete()) {
      this.state = ChunkSearchState.FINISHED;
      return null;
    }

    // Move to the chunk if not there already
    this.state = ChunkSearchState.GOING_TO_CHUNK;
    return result;
  }

  private handleGoingToChunk(): Task | null {
    if (!this.currentTargetChunk) {
      this.state = ChunkSearchState.SCANNING_LOADED;
      return null;
    }

    // Check if we're in or near the chunk
    const playerChunk = blockToChunk(
      this.bot.entity.position.x,
      this.bot.entity.position.z
    );

    const dist = Math.abs(playerChunk.x - this.currentTargetChunk.x) +
                 Math.abs(playerChunk.z - this.currentTargetChunk.z);

    if (dist <= 1) {
      // We're close enough, re-scan
      this.currentTargetChunk = null;
      this.state = ChunkSearchState.SCANNING_LOADED;
      return null;
    }

    // Navigate to chunk center
    const target = chunkToBlock(this.currentTargetChunk, this.bot.entity.position.y);
    return new GoToNearTask(
      this.bot,
      Math.floor(target.x),
      Math.floor(target.y),
      Math.floor(target.z),
      8
    );
  }

  onStop(interruptTask: ITask | null): void {
    this.exploredChunks.clear();
    this.currentTargetChunk = null;
  }

  isFinished(): boolean {
    return this.state === ChunkSearchState.FINISHED ||
           this.state === ChunkSearchState.FAILED;
  }

  isFailed(): boolean {
    return this.state === ChunkSearchState.FAILED;
  }

  /**
   * Reset the search state
   */
  resetSearch(): void {
    this.exploredChunks.clear();
    this.currentTargetChunk = null;
    this.chunksSearched = 0;
    this.state = ChunkSearchState.SCANNING_LOADED;
  }

  // ---- Methods for subclasses to implement ----

  /**
   * Check if a chunk is within the search space
   */
  protected abstract isChunkWithinSearchSpace(chunk: ChunkPos): boolean;

  /**
   * Perform search within a valid chunk, return any subtask needed
   */
  protected abstract searchWithinChunk(chunk: ChunkPos): Task | null;

  /**
   * Check if the overall search is complete
   */
  protected abstract isSearchComplete(): boolean;

  // ---- Helper methods ----

  /**
   * Get a task to wander and explore
   */
  protected getWanderTask(): Task {
    return new TimeoutWanderTask(this.bot, 30);
  }

  /**
   * Find a valid loaded chunk that hasn't been explored
   */
  private findValidLoadedChunk(): ChunkPos | null {
    const playerPos = this.bot.entity.position;
    const playerChunk = blockToChunk(playerPos.x, playerPos.z);

    // Check chunks in expanding rings
    for (let r = 0; r <= 8; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;

          const chunk: ChunkPos = {
            x: playerChunk.x + dx,
            z: playerChunk.z + dz,
          };

          const chunkKey = `${chunk.x},${chunk.z}`;
          if (this.exploredChunks.has(chunkKey)) continue;

          // Check if chunk is loaded (approximate via block access)
          const centerBlock = chunkToBlock(chunk, playerPos.y);
          const block = this.bot.blockAt(centerBlock);
          if (!block) continue; // Chunk not loaded

          // Check if chunk is valid for search
          if (this.isChunkWithinSearchSpace(chunk)) {
            return chunk;
          }
        }
      }
    }

    return null;
  }
}

