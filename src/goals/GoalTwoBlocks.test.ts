import { describe, it, expect } from 'bun:test';
import { GoalTwoBlocks } from './index';

describe('GoalTwoBlocks', () => {
  const goal = new GoalTwoBlocks(10, 64, 20);

  it('should match position at feet (y=64)', () => {
    expect(goal.isEnd(10, 64, 20)).toBe(true);
  });

  it('should match one block below (feet at y-1, head at y)', () => {
    // When feet are at y=63, head is at y=64 (the target)
    expect(goal.isEnd(10, 63, 20)).toBe(true);
  });

  it('should not match other positions', () => {
    expect(goal.isEnd(10, 62, 20)).toBe(false);
    expect(goal.isEnd(10, 65, 20)).toBe(false);
    expect(goal.isEnd(10, 66, 20)).toBe(false);
  });
});

describe('GoalTwoBlocks edge cases', () => {
  it('should handle negative Y values', () => {
    const goal = new GoalTwoBlocks(0, -60, 0);
    expect(goal.isEnd(0, -60, 0)).toBe(true);
    expect(goal.isEnd(0, -61, 0)).toBe(true);
    expect(goal.isEnd(0, -62, 0)).toBe(false);
  });

  it('heuristic should take minimum of both positions', () => {
    const goal = new GoalTwoBlocks(0, 64, 0);
    // Closer to y=63 (head position) than y=64 (feet position)
    const h = goal.heuristic(0, 63, 0);
    expect(h).toBe(0); // Already at the y-1 position, dist2=0
  });
});
