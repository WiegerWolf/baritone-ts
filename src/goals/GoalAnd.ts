import { Goal } from '../types';

/**
 * GoalAnd - Composite goal that requires ALL sub-goals to be met
 * Based on BaritonePlus GoalAnd.java
 *
 * Unlike GoalComposite (any), this requires all goals to be satisfied.
 * Useful for complex conditions like "at position X AND at Y level Y"
 */
export class GoalAnd implements Goal {
  public readonly goals: Goal[];

  constructor(...goals: Goal[]) {
    if (goals.length === 0) {
      throw new Error('GoalAnd requires at least one goal');
    }
    this.goals = goals;
  }

  isEnd(x: number, y: number, z: number): boolean {
    for (const goal of this.goals) {
      if (!goal.isEnd(x, y, z)) {
        return false;
      }
    }
    return true;
  }

  heuristic(x: number, y: number, z: number): number {
    // Sum heuristics from all goals
    let sum = 0;
    for (const goal of this.goals) {
      sum += goal.heuristic(x, y, z);
    }
    return sum;
  }

  toString(): string {
    return `GoalAnd[${this.goals.join(', ')}]`;
  }
}
