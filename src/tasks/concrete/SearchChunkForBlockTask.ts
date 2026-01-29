/**
 * SearchChunkForBlockTask - Search for specific blocks across chunks
 * Based on BaritonePlus's SearchChunkForBlockTask.java
 *
 * WHY: Finding blocks like ores, stronghold blocks, or structure blocks
 * requires searching multiple chunks. This task systematically explores
 * until the target blocks are found.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToNearTask';
import { SearchChunksExploreTask, type ChunkPos, type ChunkSearchConfig } from './ChunkSearchTask';

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
