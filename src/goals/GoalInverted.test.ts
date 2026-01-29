import { describe, it, expect } from 'bun:test';
import { GoalInverted, GoalNear, GoalBlock } from './index';

describe('GoalInverted', () => {
  const inner = new GoalNear(100, 64, 100, 5);
  const inverted = new GoalInverted(inner);

  it('should invert isEnd result', () => {
    // Inner goal matches at center, inverted should not
    expect(inner.isEnd(100, 64, 100)).toBe(true);
    expect(inverted.isEnd(100, 64, 100)).toBe(false);

    // Inner goal doesn't match far away, inverted should
    expect(inner.isEnd(200, 64, 200)).toBe(false);
    expect(inverted.isEnd(200, 64, 200)).toBe(true);
  });

  it('should invert heuristic', () => {
    // Closer to inner goal = higher inverted heuristic
    const nearH = inverted.heuristic(101, 64, 100);
    const farH = inverted.heuristic(200, 64, 200);
    expect(nearH).toBeGreaterThan(farH);
  });
});

describe('GoalInverted edge cases', () => {
  it('should return COST_INF heuristic when at inner goal', () => {
    const inner = new GoalBlock(10, 64, 10);
    const inverted = new GoalInverted(inner);
    expect(inverted.heuristic(10, 64, 10)).toBe(1000000); // COST_INF
  });

  it('should return 0 heuristic when not at inner goal', () => {
    const inner = new GoalBlock(10, 64, 10);
    const inverted = new GoalInverted(inner);
    expect(inverted.heuristic(20, 64, 20)).toBe(0);
  });
});
