/**
 * GetToChunkTask - Navigate to a Specific Chunk
 * Based on BaritonePlus's GetToChunkTask.java
 *
 * WHY: Sometimes we need to navigate to a general area (chunk) rather than
 * a specific block. This is useful for:
 * - Large-scale exploration
 * - Finding structures that span chunks
 * - Optimizing pathfinding over long distances
 *
 * A chunk is 16x16 blocks. Navigating to a chunk is more lenient than
 * navigating to a specific block - we just need to be anywhere inside it.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from './GoToTask';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';
import { blockToChunk, ChunkPos, chunkToBlock } from './ChunkSearchTask';

/**
 * Task to navigate to a specific chunk.
 *
 * WHY: When exploring or searching for structures, we often don't need
 * to reach an exact position - just being in the right chunk is enough.
 * This task:
 * 1. Takes a chunk coordinate as target
 * 2. Navigates to the center of that chunk
 * 3. Considers itself finished when the player is inside the chunk
 *
 * Based on BaritonePlus GetToChunkTask.java
 */
export class GetToChunkTask extends Task {
  private chunkPos: ChunkPos;
  private progressChecker: MovementProgressChecker;

  constructor(bot: Bot, chunkX: number, chunkZ: number) {
    super(bot);
    this.chunkPos = { x: chunkX, z: chunkZ };
    // More lenient checker since we're traversing entire chunks
    this.progressChecker = new MovementProgressChecker(bot, 10, 0.05);
  }

  /**
   * Create from block position (converts to chunk)
   */
  static fromBlockPos(bot: Bot, x: number, z: number): GetToChunkTask {
    const chunk = blockToChunk(x, z);
    return new GetToChunkTask(bot, chunk.x, chunk.z);
  }

  /**
   * Create from Vec3 position
   */
  static fromVec3(bot: Bot, pos: Vec3): GetToChunkTask {
    return GetToChunkTask.fromBlockPos(bot, Math.floor(pos.x), Math.floor(pos.z));
  }

  get displayName(): string {
    return `GetToChunk(${this.chunkPos.x}, ${this.chunkPos.z})`;
  }

  onStart(): void {
    this.progressChecker.reset();
  }

  onTick(): Task | null {
    // Check if we're already in the target chunk
    if (this.isInTargetChunk()) {
      return null;
    }

    // Check movement progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      // Reset and try again - chunk navigation should be more lenient
      this.progressChecker.reset();
    }

    // Navigate to the center of the chunk
    // chunkToBlock already returns center (chunk * 16 + 8)
    const centerBlock = chunkToBlock(this.chunkPos);
    const targetY = Math.floor(this.bot.entity.position.y);

    // Use near goal - we just need to be in the chunk
    return new GoToNearTask(this.bot, centerBlock.x, targetY, centerBlock.z, 8);
  }

  /**
   * Check if the player is currently in the target chunk
   */
  private isInTargetChunk(): boolean {
    const playerChunk = blockToChunk(
      Math.floor(this.bot.entity.position.x),
      Math.floor(this.bot.entity.position.z)
    );
    return playerChunk.x === this.chunkPos.x && playerChunk.z === this.chunkPos.z;
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.isInTargetChunk();
  }

  /**
   * Get the target chunk position
   */
  getTargetChunk(): ChunkPos {
    return { ...this.chunkPos };
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GetToChunkTask)) return false;
    return this.chunkPos.x === other.chunkPos.x && this.chunkPos.z === other.chunkPos.z;
  }
}

/**
 * Convenience function to navigate to a chunk
 */
export function getToChunk(bot: Bot, chunkX: number, chunkZ: number): GetToChunkTask {
  return new GetToChunkTask(bot, chunkX, chunkZ);
}

/**
 * Convenience function to navigate to chunk containing a block
 */
export function getToChunkContaining(bot: Bot, blockX: number, blockZ: number): GetToChunkTask {
  return GetToChunkTask.fromBlockPos(bot, blockX, blockZ);
}
