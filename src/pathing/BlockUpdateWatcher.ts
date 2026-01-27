import { Vec3 } from 'vec3';
import { PathNode, BlockPos } from '../types';

/**
 * BlockUpdateWatcher monitors block changes near the path and detects invalidation
 * Based on Baritone's approach of invalidating paths when relevant blocks change
 */
export class BlockUpdateWatcher {
  private bot: any;
  private currentPath: PathNode[] = [];
  private pathPositions: Set<string> = new Set();
  private nearPathPositions: Set<string> = new Set();
  private invalidated: boolean = false;
  private invalidationReason: string | null = null;

  // Distance threshold for "near path" positions
  private static readonly NEAR_PATH_DISTANCE = 2;

  constructor(bot: any) {
    this.bot = bot;
    this.setupListeners();
  }

  /**
   * Set up block update listeners
   */
  private setupListeners(): void {
    this.bot.on('blockUpdate', (oldBlock: any, newBlock: any) => {
      this.onBlockUpdate(oldBlock, newBlock);
    });

    this.bot.on('chunkColumnLoad', (chunk: any) => {
      this.onChunkLoad(chunk);
    });
  }

  /**
   * Set the current path to monitor
   */
  setPath(path: PathNode[]): void {
    this.currentPath = path;
    this.invalidated = false;
    this.invalidationReason = null;
    this.rebuildPathPositions();
  }

  /**
   * Clear the current path
   */
  clearPath(): void {
    this.currentPath = [];
    this.pathPositions.clear();
    this.nearPathPositions.clear();
    this.invalidated = false;
    this.invalidationReason = null;
  }

  /**
   * Rebuild the set of path positions for fast lookup
   */
  private rebuildPathPositions(): void {
    this.pathPositions.clear();
    this.nearPathPositions.clear();

    for (const node of this.currentPath) {
      // Exact path positions
      this.pathPositions.add(`${node.x},${node.y},${node.z}`);
      this.pathPositions.add(`${node.x},${node.y + 1},${node.z}`); // Head level

      // Near-path positions (for floor blocks, walls, etc.)
      for (let dx = -BlockUpdateWatcher.NEAR_PATH_DISTANCE; dx <= BlockUpdateWatcher.NEAR_PATH_DISTANCE; dx++) {
        for (let dy = -1; dy <= 2; dy++) {
          for (let dz = -BlockUpdateWatcher.NEAR_PATH_DISTANCE; dz <= BlockUpdateWatcher.NEAR_PATH_DISTANCE; dz++) {
            const hash = `${node.x + dx},${node.y + dy},${node.z + dz}`;
            this.nearPathPositions.add(hash);
          }
        }
      }
    }
  }

  /**
   * Handle block update event
   */
  private onBlockUpdate(oldBlock: any, newBlock: any): void {
    if (!oldBlock || !newBlock) return;
    if (this.currentPath.length === 0) return;
    if (this.invalidated) return;

    const pos = oldBlock.position;
    const hash = `${pos.x},${pos.y},${pos.z}`;

    // Check if block is on the path
    if (this.pathPositions.has(hash)) {
      // Block directly on path changed
      if (this.isSignificantChange(oldBlock, newBlock)) {
        this.invalidate(`Block on path changed at ${pos.x},${pos.y},${pos.z}`);
        return;
      }
    }

    // Check if block is near the path
    if (this.nearPathPositions.has(hash)) {
      // Could affect the path (floor disappeared, wall appeared, etc.)
      if (this.couldAffectPath(oldBlock, newBlock, pos)) {
        this.invalidate(`Block near path changed at ${pos.x},${pos.y},${pos.z}`);
      }
    }
  }

  /**
   * Handle chunk load event
   */
  private onChunkLoad(chunk: any): void {
    if (this.currentPath.length === 0) return;
    if (this.invalidated) return;

    const chunkX = chunk.x;
    const chunkZ = chunk.z;

    // Check if any path nodes are in this chunk
    for (const node of this.currentPath) {
      const nodeChunkX = node.x >> 4;
      const nodeChunkZ = node.z >> 4;

      // Check if adjacent to this chunk
      if (Math.abs(nodeChunkX - chunkX) <= 1 && Math.abs(nodeChunkZ - chunkZ) <= 1) {
        // A chunk near the path was loaded, might need to recalculate
        this.invalidate(`Chunk loaded near path at ${chunkX},${chunkZ}`);
        return;
      }
    }
  }

  /**
   * Check if a block change is significant enough to invalidate path
   */
  private isSignificantChange(oldBlock: any, newBlock: any): boolean {
    // Type changed
    if (oldBlock.type !== newBlock.type) {
      return true;
    }

    // Bounding box changed (door opened/closed, etc.)
    if (oldBlock.boundingBox !== newBlock.boundingBox) {
      return true;
    }

    return false;
  }

  /**
   * Check if a block change near the path could affect traversability
   */
  private couldAffectPath(oldBlock: any, newBlock: any, pos: Vec3): boolean {
    const wasPassable = oldBlock.boundingBox === 'empty' || oldBlock.name === 'air';
    const isPassable = newBlock.boundingBox === 'empty' || newBlock.name === 'air';

    // Solid block appeared in passable space
    if (wasPassable && !isPassable) {
      return true;
    }

    // Solid floor disappeared
    const wasSolid = oldBlock.boundingBox === 'block';
    const isSolid = newBlock.boundingBox === 'block';

    if (wasSolid && !isSolid) {
      // Check if this was a floor block for any path node
      const aboveHash = `${pos.x},${pos.y + 1},${pos.z}`;
      if (this.pathPositions.has(aboveHash)) {
        return true;
      }
    }

    // Dangerous block appeared
    const dangerBlocks = ['lava', 'fire', 'cactus', 'magma_block'];
    if (!dangerBlocks.includes(oldBlock.name) && dangerBlocks.includes(newBlock.name)) {
      return true;
    }

    return false;
  }

  /**
   * Mark path as invalidated
   */
  private invalidate(reason: string): void {
    this.invalidated = true;
    this.invalidationReason = reason;
    this.bot.emit('path_invalidated', reason);
  }

  /**
   * Check if path is invalidated
   */
  isInvalidated(): boolean {
    return this.invalidated;
  }

  /**
   * Get invalidation reason
   */
  getInvalidationReason(): string | null {
    return this.invalidationReason;
  }

  /**
   * Check if a specific position is near the current path
   */
  isNearPath(pos: BlockPos): boolean {
    const hash = `${pos.x},${pos.y},${pos.z}`;
    return this.nearPathPositions.has(hash);
  }

  /**
   * Check if a specific position is on the current path
   */
  isOnPath(pos: BlockPos): boolean {
    const hash = `${pos.x},${pos.y},${pos.z}`;
    return this.pathPositions.has(hash);
  }

  /**
   * Recalculate path costs starting from a position
   * Returns Infinity if path is now impossible
   */
  recalculateCostFrom(
    startIndex: number,
    ctx: any // CalculationContext
  ): number {
    let totalCost = 0;

    for (let i = startIndex; i < this.currentPath.length - 1; i++) {
      const from = this.currentPath[i];
      const to = this.currentPath[i + 1];

      // Check if movement is still possible
      const fromPos = new BlockPos(from.x, from.y, from.z);
      const toPos = new BlockPos(to.x, to.y, to.z);

      // Check floor exists at destination
      const floor = ctx.getBlock(toPos.x, toPos.y - 1, toPos.z);
      if (!ctx.canWalkOn(floor)) {
        return Infinity;
      }

      // Check body space is clear
      const body1 = ctx.getBlock(toPos.x, toPos.y, toPos.z);
      const body2 = ctx.getBlock(toPos.x, toPos.y + 1, toPos.z);
      if (!ctx.canWalkThrough(body1) || !ctx.canWalkThrough(body2)) {
        return Infinity;
      }

      // Estimate cost (simple for now)
      const dx = toPos.x - fromPos.x;
      const dy = toPos.y - fromPos.y;
      const dz = toPos.z - fromPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      totalCost += dist * 4.633; // WALK_ONE_BLOCK_COST
    }

    return totalCost;
  }
}
