import { Goal } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

/**
 * Goal to reach a specific X,Z coordinate (any Y level)
 */
export class GoalXZ implements Goal {
  constructor(
    public readonly x: number,
    public readonly z: number
  ) {}

  isEnd(x: number, _y: number, z: number): boolean {
    return x === this.x && z === this.z;
  }

  heuristic(x: number, _y: number, z: number): number {
    const dx = x - this.x;
    const dz = z - this.z;
    return Math.sqrt(dx * dx + dz * dz) * WALK_ONE_BLOCK_COST;
  }
}
