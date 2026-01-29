import { Vec3 } from 'vec3';
import { Goal, BlockPos } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

/**
 * Goal to reach a specific block position
 */
export class GoalBlock implements Goal {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {}

  isEnd(x: number, y: number, z: number): boolean {
    return x === this.x && y === this.y && z === this.z;
  }

  heuristic(x: number, y: number, z: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) * WALK_ONE_BLOCK_COST;
  }

  static fromVec3(v: Vec3): GoalBlock {
    return new GoalBlock(Math.floor(v.x), Math.floor(v.y), Math.floor(v.z));
  }

  static fromBlockPos(pos: BlockPos): GoalBlock {
    return new GoalBlock(pos.x, pos.y, pos.z);
  }
}
