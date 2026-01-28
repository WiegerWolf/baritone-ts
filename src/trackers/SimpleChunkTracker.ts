/**
 * SimpleChunkTracker - Track Loaded Chunks
 * Based on BaritonePlus SimpleChunkTracker.java
 *
 * Keeps track of currently loaded chunks and provides utilities
 * for scanning chunks block by block.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../types';

/**
 * Chunk position
 */
export interface ChunkPos {
  x: number;
  z: number;
}

/**
 * World height constants
 */
const WORLD_FLOOR_Y = -64;
const WORLD_CEILING_Y = 320;

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
 * Get chunk start X coordinate
 */
export function chunkStartX(chunkX: number): number {
  return chunkX * 16;
}

/**
 * Get chunk end X coordinate
 */
export function chunkEndX(chunkX: number): number {
  return chunkX * 16 + 15;
}

/**
 * Get chunk start Z coordinate
 */
export function chunkStartZ(chunkZ: number): number {
  return chunkZ * 16;
}

/**
 * Get chunk end Z coordinate
 */
export function chunkEndZ(chunkZ: number): number {
  return chunkZ * 16 + 15;
}

/**
 * SimpleChunkTracker - Track loaded chunks
 *
 * Provides chunk loading state and scanning utilities.
 */
export class SimpleChunkTracker {
  private bot: Bot;
  private loadedChunks: Set<string> = new Set();

  constructor(bot: Bot) {
    this.bot = bot;

    // Listen for chunk load/unload events
    this.bot.on('chunkColumnLoad', (point: Vec3) => {
      const chunkPos = blockToChunk(point.x, point.z);
      this.loadedChunks.add(this.chunkKey(chunkPos));
    });

    this.bot.on('chunkColumnUnload', (point: Vec3) => {
      const chunkPos = blockToChunk(point.x, point.z);
      this.loadedChunks.delete(this.chunkKey(chunkPos));
    });
  }

  /**
   * Create unique key for chunk position
   */
  private chunkKey(pos: ChunkPos): string {
    return `${pos.x},${pos.z}`;
  }

  /**
   * Check if a chunk is loaded
   */
  isChunkLoaded(pos: ChunkPos): boolean {
    // Check via mineflayer's world
    const blockX = chunkStartX(pos.x);
    const blockZ = chunkStartZ(pos.z);
    const column = (this.bot as any).world?.getColumn?.(pos.x, pos.z);
    return column != null;
  }

  /**
   * Check if a block position's chunk is loaded
   */
  isBlockChunkLoaded(blockPos: BlockPos | Vec3): boolean {
    const chunkPos = blockToChunk(
      Math.floor(blockPos.x),
      Math.floor('z' in blockPos ? blockPos.z : (blockPos as any).z)
    );
    return this.isChunkLoaded(chunkPos);
  }

  /**
   * Get all loaded chunks
   */
  getLoadedChunks(): ChunkPos[] {
    const result: ChunkPos[] = [];

    for (const key of this.loadedChunks) {
      const [x, z] = key.split(',').map(Number);
      const pos = { x, z };
      if (this.isChunkLoaded(pos)) {
        result.push(pos);
      }
    }

    return result;
  }

  /**
   * Scan a chunk block by block
   *
   * @param chunk The chunk to scan
   * @param onBlock Callback for each block. Return true to stop scanning.
   * @returns Whether scanning was stopped early
   */
  scanChunk(chunk: ChunkPos, onBlock: (pos: BlockPos) => boolean): boolean {
    if (!this.isChunkLoaded(chunk)) {
      return false;
    }

    const startX = chunkStartX(chunk.x);
    const endX = chunkEndX(chunk.x);
    const startZ = chunkStartZ(chunk.z);
    const endZ = chunkEndZ(chunk.z);

    for (let x = startX; x <= endX; x++) {
      for (let y = WORLD_FLOOR_Y; y <= WORLD_CEILING_Y; y++) {
        for (let z = startZ; z <= endZ; z++) {
          if (onBlock(new BlockPos(x, y, z))) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Scan a chunk with a consumer (doesn't stop early)
   */
  scanChunkAll(chunk: ChunkPos, onBlock: (pos: BlockPos) => void): void {
    this.scanChunk(chunk, (pos) => {
      onBlock(pos);
      return false;
    });
  }

  /**
   * Scan chunks in radius around a position
   */
  scanChunksInRadius(
    centerX: number,
    centerZ: number,
    radiusChunks: number,
    onBlock: (pos: BlockPos) => boolean
  ): boolean {
    const centerChunk = blockToChunk(centerX, centerZ);

    for (let dx = -radiusChunks; dx <= radiusChunks; dx++) {
      for (let dz = -radiusChunks; dz <= radiusChunks; dz++) {
        const chunk = { x: centerChunk.x + dx, z: centerChunk.z + dz };
        if (this.scanChunk(chunk, onBlock)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find block in loaded chunks
   */
  findBlock(
    blockName: string,
    maxChunkRadius: number = 8
  ): BlockPos | null {
    const playerPos = this.bot.entity.position;
    let result: BlockPos | null = null;
    let closestDistSq = Infinity;

    this.scanChunksInRadius(
      playerPos.x,
      playerPos.z,
      maxChunkRadius,
      (pos) => {
        const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
        if (block?.name === blockName) {
          const dx = pos.x - playerPos.x;
          const dy = pos.y - playerPos.y;
          const dz = pos.z - playerPos.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < closestDistSq) {
            closestDistSq = distSq;
            result = pos;
          }
        }
        return false;
      }
    );

    return result;
  }

  /**
   * Reset tracker state
   */
  reset(): void {
    this.loadedChunks.clear();
  }
}

export default SimpleChunkTracker;
