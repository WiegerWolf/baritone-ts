import { describe, it, expect } from 'bun:test';
import { GoalYLevel } from './index';

describe('GoalYLevel', () => {
  const goal = new GoalYLevel(64);

  it('should match any XZ at target Y', () => {
    expect(goal.isEnd(0, 64, 0)).toBe(true);
    expect(goal.isEnd(100, 64, 200)).toBe(true);
    expect(goal.isEnd(-50, 64, -50)).toBe(true);
  });

  it('should not match other Y levels', () => {
    expect(goal.isEnd(0, 63, 0)).toBe(false);
    expect(goal.isEnd(0, 65, 0)).toBe(false);
  });

  it('should only consider Y in heuristic', () => {
    const h1 = goal.heuristic(0, 60, 0);
    const h2 = goal.heuristic(1000, 60, 1000);
    expect(h1).toBe(h2);
  });
});
