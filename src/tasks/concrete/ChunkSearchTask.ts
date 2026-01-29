/**
 * ChunkSearchTask - Chunk-based Exploration Tasks
 * Based on BaritonePlus's SearchChunksExploreTask.java and SearchChunkForBlockTask.java
 *
 * WHY: Minecraft worlds are organized into chunks (16x16 blocks). For finding
 * structures, biomes, or specific blocks, chunk-based searching is more efficient
 * than block-by-block searching. This task explores chunks systematically.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
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

/**
 * Task to search for specific blocks across chunks.
 *
 * WHY: Finding blocks like ores, stronghold blocks, or structure blocks
 * requires searching multiple chunks. This task systematically explores
 * until the target blocks are found.
 *
 * Based on BaritonePlus SearchChunkForBlockTask.java
 */
export class SearchChunkForBlockTask extends SearchChunksExploreTask {
  private targetBlocks: Set<string>;
  private foundPositions: Vec3[] = [];
  private maxResults: number;

  constructor(
    bot: Bot,
    blocks: string[],
    maxResults: number = 1,
    config: Partial<ChunkSearchConfig> = {}
  ) {
    super(bot, config);
    this.targetBlocks = new Set(blocks);
    this.maxResults = maxResults;
  }

  get displayName(): string {
    const blockNames = Array.from(this.targetBlocks).join(', ');
    return `SearchChunkForBlock(${blockNames})`;
  }

  protected isChunkWithinSearchSpace(chunk: ChunkPos): boolean {
    // Check if chunk contains any of the target blocks
    return this.scanChunkForBlocks(chunk);
  }

  protected searchWithinChunk(chunk: ChunkPos): Task | null {
    // Already scanned in isChunkWithinSearchSpace
    // Return navigation to nearest found block if any
    if (this.foundPositions.length > 0) {
      const nearest = this.findNearestFoundPosition();
      if (nearest) {
        return new GoToNearTask(
          this.bot,
          Math.floor(nearest.x),
          Math.floor(nearest.y),
          Math.floor(nearest.z),
          2
        );
      }
    }

    return null;
  }

  protected isSearchComplete(): boolean {
    return this.foundPositions.length >= this.maxResults;
  }

  /**
   * Get positions of found blocks
   */
  getFoundPositions(): Vec3[] {
    return [...this.foundPositions];
  }

  private scanChunkForBlocks(chunk: ChunkPos): boolean {
    const startX = chunk.x * 16;
    const startZ = chunk.z * 16;
    let found = false;

    // Scan the chunk
    for (let x = startX; x < startX + 16; x++) {
      for (let z = startZ; z < startZ + 16; z++) {
        // Use typical Minecraft Y range (-64 to 320 for 1.18+, or 0-255 for older)
        const minY = (this.bot.game as any).minY ?? -64;
        const maxY = (this.bot.game as any).maxY ?? 320;
        for (let y = minY; y <= maxY; y++) {
          const block = this.bot.blockAt(new Vec3(x, y, z));

          if (block && this.targetBlocks.has(block.name)) {
            this.foundPositions.push(new Vec3(x, y, z));
            found = true;

            if (this.foundPositions.length >= this.maxResults) {
              return true;
            }
          }
        }
      }
    }

    return found;
  }

  private findNearestFoundPosition(): Vec3 | null {
    if (this.foundPositions.length === 0) return null;

    const playerPos = this.bot.entity.position;
    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    for (const pos of this.foundPositions) {
      const dist = playerPos.distanceTo(pos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = pos;
      }
    }

    return nearest;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof SearchChunkForBlockTask)) return false;
    return this.targetBlocks.size === other.targetBlocks.size &&
           [...this.targetBlocks].every(b => other.targetBlocks.has(b));
  }
}

/**
 * Task to search for chunks matching a biome or structure type.
 *
 * WHY: Finding specific biomes (like desert for temples) or structures
 * (like strongholds) requires checking chunk data rather than individual blocks.
 */
export class SearchChunkByConditionTask extends SearchChunksExploreTask {
  private condition: (chunk: ChunkPos, bot: Bot) => boolean;
  private onChunkFound: (chunk: ChunkPos) => void;
  private foundChunks: ChunkPos[] = [];

  constructor(
    bot: Bot,
    condition: (chunk: ChunkPos, bot: Bot) => boolean,
    onChunkFound: (chunk: ChunkPos) => void = () => {},
    config: Partial<ChunkSearchConfig> = {}
  ) {
    super(bot, config);
    this.condition = condition;
    this.onChunkFound = onChunkFound;
  }

  get displayName(): string {
    return 'SearchChunkByCondition';
  }

  protected isChunkWithinSearchSpace(chunk: ChunkPos): boolean {
    const matches = this.condition(chunk, this.bot);
    if (matches) {
      this.foundChunks.push(chunk);
      this.onChunkFound(chunk);
    }
    return matches;
  }

  protected searchWithinChunk(chunk: ChunkPos): Task | null {
    // Navigate to chunk center
    const target = chunkToBlock(chunk, this.bot.entity.position.y);
    return new GoToNearTask(
      this.bot,
      Math.floor(target.x),
      Math.floor(target.y),
      Math.floor(target.z),
      4
    );
  }

  protected isSearchComplete(): boolean {
    return this.foundChunks.length > 0;
  }

  /**
   * Get found chunks matching condition
   */
  getFoundChunks(): ChunkPos[] {
    return [...this.foundChunks];
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof SearchChunkByConditionTask &&
           this.condition === other.condition;
  }
}

/**
 * Helper to search for blocks
 */
export function searchForBlocks(
  bot: Bot,
  blocks: string[],
  maxResults: number = 1
): SearchChunkForBlockTask {
  return new SearchChunkForBlockTask(bot, blocks, maxResults);
}

/**
 * Helper to search for end portal frames (stronghold)
 */
export function searchForStronghold(bot: Bot): SearchChunkForBlockTask {
  return new SearchChunkForBlockTask(bot, ['end_portal_frame'], 12); // Need 12 frames
}

/**
 * Helper to search for nether fortress blocks
 */
export function searchForNetherFortress(bot: Bot): SearchChunkForBlockTask {
  return new SearchChunkForBlockTask(
    bot,
    ['nether_bricks', 'nether_brick_fence', 'nether_brick_stairs'],
    5
  );
}
