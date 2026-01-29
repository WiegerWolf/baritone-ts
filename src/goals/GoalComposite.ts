import { Goal, BlockPos } from '../types';
import { GoalBlock } from './GoalBlock';

/**
 * Composite goal - succeeds if ANY sub-goal is reached
 */
export class GoalComposite implements Goal {
  constructor(public readonly goals: Goal[]) {
    if (goals.length === 0) {
      throw new Error('GoalComposite requires at least one goal');
    }
  }

  isEnd(x: number, y: number, z: number): boolean {
    return this.goals.some(goal => goal.isEnd(x, y, z));
  }

  heuristic(x: number, y: number, z: number): number {
    let min = Infinity;
    for (const goal of this.goals) {
      const h = goal.heuristic(x, y, z);
      if (h < min) min = h;
    }
    return min;
  }

  /**
   * Create composite goal from multiple positions
   */
  static fromPositions(positions: BlockPos[]): GoalComposite {
    return new GoalComposite(
      positions.map(pos => new GoalBlock(pos.x, pos.y, pos.z))
    );
  }
}
