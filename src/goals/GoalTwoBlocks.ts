import { Goal } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

/**
 * Goal where either head or feet can be at target (2 block tall entity)
 */
export class GoalTwoBlocks implements Goal {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {}

  isEnd(x: number, y: number, z: number): boolean {
    if (x !== this.x || z !== this.z) return false;
    // Either feet at y or head at y (feet at y-1)
    return y === this.y || y === this.y - 1;
  }

  heuristic(x: number, y: number, z: number): number {
    const dx = x - this.x;
    const dz = z - this.z;

    // Check both positions
    const dy1 = y - this.y;        // feet at target
    const dy2 = y - (this.y - 1);  // head at target

    const dist1 = Math.sqrt(dx * dx + dy1 * dy1 + dz * dz);
    const dist2 = Math.sqrt(dx * dx + dy2 * dy2 + dz * dz);

    return Math.min(dist1, dist2) * WALK_ONE_BLOCK_COST;
  }
}
