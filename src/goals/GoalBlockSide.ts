import { Goal, BlockPos } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';
import { Direction, getDirectionVector } from './Direction';

/**
 * GoalBlockSide - Goal to approach a block from a specific side
 * Based on BaritonePlus GoalBlockSide.java
 *
 * Useful for interacting with blocks that require approaching from
 * a specific direction (e.g., opening a door, using a chest)
 */
export class GoalBlockSide implements Goal {
  private dirVec: { x: number; y: number; z: number };

  constructor(
    public readonly blockX: number,
    public readonly blockY: number,
    public readonly blockZ: number,
    public readonly direction: Direction,
    public readonly bufferDistance: number = 1
  ) {
    this.dirVec = getDirectionVector(direction);
  }

  static fromBlockPos(pos: BlockPos, direction: Direction, buffer: number = 1): GoalBlockSide {
    return new GoalBlockSide(pos.x, pos.y, pos.z, direction, buffer);
  }

  isEnd(x: number, y: number, z: number): boolean {
    // We are on the right side if distance in the correct direction > 0
    return this.getDistanceInRightDirection(x, y, z) > 0;
  }

  heuristic(x: number, y: number, z: number): number {
    // How far are we from being on the right side
    return Math.min(this.getDistanceInRightDirection(x, y, z), 0) * -WALK_ONE_BLOCK_COST;
  }

  private getDistanceInRightDirection(x: number, y: number, z: number): number {
    const dx = x - this.blockX;
    const dy = y - this.blockY;
    const dz = z - this.blockZ;

    // Dot product with direction vector
    const dot = dx * this.dirVec.x + dy * this.dirVec.y + dz * this.dirVec.z;

    // Distance along the direction (direction is normalized)
    return dot - this.bufferDistance;
  }
}
