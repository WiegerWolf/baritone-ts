import { describe, it, expect } from 'bun:test';
import { GoalXZ } from './index';

describe('GoalXZ', () => {
  const goal = new GoalXZ(100, 200);

  it('should match any Y at target XZ', () => {
    expect(goal.isEnd(100, 0, 200)).toBe(true);
    expect(goal.isEnd(100, 64, 200)).toBe(true);
    expect(goal.isEnd(100, 256, 200)).toBe(true);
  });

  it('should not match other XZ positions', () => {
    expect(goal.isEnd(101, 64, 200)).toBe(false);
    expect(goal.isEnd(100, 64, 201)).toBe(false);
  });

  it('should not include Y in heuristic', () => {
    const h1 = goal.heuristic(100, 0, 200);
    const h2 = goal.heuristic(100, 100, 200);
    expect(h1).toBe(h2);
  });
});
