import { Goal } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

/**
 * Goal to get within reach of a block (adjacent, not on top)
 */
export class GoalGetToBlock implements Goal {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {}

  isEnd(x: number, y: number, z: number): boolean {
    // Must be adjacent (not on the block itself)
    const dx = Math.abs(x - this.x);
    const dy = Math.abs(y - this.y);
    const dz = Math.abs(z - this.z);

    // Adjacent means within 1 block on any axis
    if (dx > 1 || dy > 1 || dz > 1) return false;

    // But not on the block itself
    if (dx === 0 && dy === 0 && dz === 0) return false;

    return true;
  }

  heuristic(x: number, y: number, z: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // Subtract 1 because we want to be adjacent, not on top
    return Math.max(0, dist - 1) * WALK_ONE_BLOCK_COST;
  }
}
