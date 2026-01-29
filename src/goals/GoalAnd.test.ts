import { describe, it, expect } from 'bun:test';
import { GoalAnd, GoalYLevel, GoalXZ, GoalBlock } from './index';

describe('GoalAnd', () => {
  it('should require all sub-goals to be met', () => {
    const goal = new GoalAnd(
      new GoalYLevel(64),
      new GoalXZ(100, 200),
    );
    expect(goal.isEnd(100, 64, 200)).toBe(true);
    expect(goal.isEnd(100, 65, 200)).toBe(false); // Wrong Y
    expect(goal.isEnd(101, 64, 200)).toBe(false); // Wrong X
  });

  it('should throw for empty goals', () => {
    expect(() => new GoalAnd()).toThrow('GoalAnd requires at least one goal');
  });

  it('should sum heuristics', () => {
    const g1 = new GoalBlock(10, 64, 10);
    const g2 = new GoalBlock(20, 64, 20);
    const goal = new GoalAnd(g1, g2);
    const h = goal.heuristic(15, 64, 15);
    expect(h).toBe(g1.heuristic(15, 64, 15) + g2.heuristic(15, 64, 15));
  });

  it('should have toString', () => {
    const goal = new GoalAnd(new GoalYLevel(64));
    expect(goal.toString()).toContain('GoalAnd');
  });
});
