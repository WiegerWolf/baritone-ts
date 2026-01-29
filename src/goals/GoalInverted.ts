import { Goal, COST_INF } from '../types';

/**
 * Inverted goal - succeeds if NOT at target
 * Useful for "get away from" scenarios
 */
export class GoalInverted implements Goal {
  constructor(public readonly inner: Goal) {}

  isEnd(x: number, y: number, z: number): boolean {
    return !this.inner.isEnd(x, y, z);
  }

  heuristic(x: number, y: number, z: number): number {
    // If we're at the target, we need to move
    if (this.inner.isEnd(x, y, z)) {
      return COST_INF;
    }
    // Otherwise we're already at the goal
    return 0;
  }
}
