import { Goal } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

/**
 * Goal to reach a specific Y level (any X,Z)
 */
export class GoalYLevel implements Goal {
  constructor(public readonly y: number) {}

  isEnd(_x: number, y: number, _z: number): boolean {
    return y === this.y;
  }

  heuristic(_x: number, y: number, _z: number): number {
    return Math.abs(y - this.y) * WALK_ONE_BLOCK_COST;
  }
}
