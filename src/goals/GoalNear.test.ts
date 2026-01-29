import { describe, it, expect } from 'bun:test';
import { GoalNear } from './index';

describe('GoalNear', () => {
  const goal = new GoalNear(100, 64, 100, 5);

  it('should match positions within radius', () => {
    expect(goal.isEnd(100, 64, 100)).toBe(true); // Center
    expect(goal.isEnd(103, 64, 100)).toBe(true); // Within radius
    expect(goal.isEnd(100, 64, 103)).toBe(true);
  });

  it('should not match positions outside radius', () => {
    expect(goal.isEnd(106, 64, 100)).toBe(false);
    expect(goal.isEnd(100, 70, 100)).toBe(false);
  });

  it('should return 0 heuristic within radius', () => {
    expect(goal.heuristic(102, 64, 102)).toBe(0);
  });
});

describe('GoalNear edge cases', () => {
  it('should match on exact boundary of range', () => {
    const goal = new GoalNear(0, 0, 0, 5);
    // Distance = 5 exactly, rangeSq = 25
    expect(goal.isEnd(5, 0, 0)).toBe(true); // distSq = 25 <= 25
    expect(goal.isEnd(3, 4, 0)).toBe(true);  // distSq = 25 <= 25
  });

  it('should not match just outside boundary', () => {
    const goal = new GoalNear(0, 0, 0, 5);
    // 4^2 + 4^2 = 32 > 25 (rangeSq), so outside
    expect(goal.isEnd(4, 4, 0)).toBe(false);
    // 6^2 = 36 > 25, outside
    expect(goal.isEnd(6, 0, 0)).toBe(false);
  });

  it('should handle range 0 (only exact position)', () => {
    const goal = new GoalNear(10, 64, 20, 0);
    expect(goal.isEnd(10, 64, 20)).toBe(true);
    expect(goal.isEnd(11, 64, 20)).toBe(false);
  });
});
