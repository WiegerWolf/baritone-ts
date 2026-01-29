import { Goal } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

/**
 * Goal to get within a certain radius of a position
 */
export class GoalNear implements Goal {
  public readonly rangeSq: number;

  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number,
    public readonly range: number
  ) {
    this.rangeSq = range * range;
  }

  isEnd(x: number, y: number, z: number): boolean {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    return dx * dx + dy * dy + dz * dz <= this.rangeSq;
  }

  heuristic(x: number, y: number, z: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return Math.max(0, dist - this.range) * WALK_ONE_BLOCK_COST;
  }
}
