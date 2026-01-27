import { BlockPos, CalculationContext } from '../types';

/**
 * ChunkLoadingHelper provides utilities for checking chunk loading status
 * to prevent pathfinding through unloaded chunks
 */
export class ChunkLoadingHelper {
  private bot: any;

  constructor(bot: any) {
    this.bot = bot;
  }

  /**
   * Check if a chunk is loaded at the given block position
   */
  isChunkLoaded(x: number, z: number): boolean {
    const chunkX = Math.floor(x / 16);
    const chunkZ = Math.floor(z / 16);

    // Check if the world has this column loaded
    const column = this.bot.world?.getColumn?.(chunkX, chunkZ);
    return column !== null && column !== undefined;
  }

  /**
   * Check if a position is in a loaded chunk
   */
  isPositionLoaded(pos: BlockPos): boolean {
    return this.isChunkLoaded(pos.x, pos.z);
  }

  /**
   * Check if the path between two positions goes through only loaded chunks
   * Returns the first unloaded position, or null if all loaded
   */
  findFirstUnloadedPosition(from: BlockPos, to: BlockPos): BlockPos | null {
    // Check both endpoints
    if (!this.isPositionLoaded(from)) return from;
    if (!this.isPositionLoaded(to)) return to;

    // For longer paths, check intermediate chunks
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));

    if (steps <= 1) return null;

    // Check each step (could optimize by checking chunk boundaries only)
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = Math.floor(from.x + dx * t);
      const z = Math.floor(from.z + dz * t);

      if (!this.isChunkLoaded(x, z)) {
        return new BlockPos(x, from.y, z);
      }
    }

    return null;
  }

  /**
   * Check if a movement can be executed (all involved positions are in loaded chunks)
   */
  canExecuteMovement(src: BlockPos, dest: BlockPos): boolean {
    // Check source chunk
    if (!this.isPositionLoaded(src)) return false;

    // Check destination chunk
    if (!this.isPositionLoaded(dest)) return false;

    // Check intermediate positions for diagonal/parkour movements
    const dx = dest.x - src.x;
    const dz = dest.z - src.z;

    // For movements that span multiple chunks, check the path
    if (Math.abs(dx) > 1 || Math.abs(dz) > 1) {
      const unloaded = this.findFirstUnloadedPosition(src, dest);
      if (unloaded) return false;
    }

    return true;
  }

  /**
   * Get the distance to the nearest chunk edge from a position
   */
  distanceToChunkEdge(x: number, z: number): number {
    const localX = ((x % 16) + 16) % 16;
    const localZ = ((z % 16) + 16) % 16;

    return Math.min(localX, 15 - localX, localZ, 15 - localZ);
  }

  /**
   * Check if a position is near a chunk boundary (within n blocks)
   */
  isNearChunkBoundary(pos: BlockPos, threshold: number = 2): boolean {
    return this.distanceToChunkEdge(pos.x, pos.z) <= threshold;
  }

  /**
   * Get all chunks that a path visits
   */
  getPathChunks(path: BlockPos[]): Set<string> {
    const chunks = new Set<string>();

    for (const pos of path) {
      const chunkX = Math.floor(pos.x / 16);
      const chunkZ = Math.floor(pos.z / 16);
      chunks.add(`${chunkX},${chunkZ}`);
    }

    return chunks;
  }

  /**
   * Check if all chunks for a path are loaded
   */
  arePathChunksLoaded(path: BlockPos[]): boolean {
    const chunks = this.getPathChunks(path);

    for (const chunk of chunks) {
      const [chunkX, chunkZ] = chunk.split(',').map(Number);
      if (!this.isChunkLoaded(chunkX * 16, chunkZ * 16)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Wait for a chunk to load (with timeout)
   */
  async waitForChunkLoad(x: number, z: number, timeoutMs: number = 5000): Promise<boolean> {
    if (this.isChunkLoaded(x, z)) return true;

    const chunkX = Math.floor(x / 16);
    const chunkZ = Math.floor(z / 16);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.bot.removeListener('chunkColumnLoad', onLoad);
        resolve(false);
      }, timeoutMs);

      const onLoad = (loadedPos: { x: number; z: number }) => {
        if (loadedPos.x === chunkX && loadedPos.z === chunkZ) {
          clearTimeout(timeout);
          this.bot.removeListener('chunkColumnLoad', onLoad);
          resolve(true);
        }
      };

      this.bot.on('chunkColumnLoad', onLoad);
    });
  }
}

/**
 * Shared instance cache (one per bot)
 */
const helpers = new WeakMap<any, ChunkLoadingHelper>();

/**
 * Get or create ChunkLoadingHelper for a bot
 */
export function getChunkLoadingHelper(bot: any): ChunkLoadingHelper {
  let helper = helpers.get(bot);
  if (!helper) {
    helper = new ChunkLoadingHelper(bot);
    helpers.set(bot, helper);
  }
  return helper;
}
