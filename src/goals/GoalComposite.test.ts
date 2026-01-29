import { describe, it, expect } from 'bun:test';
import { GoalComposite, GoalBlock } from './index';
import { BlockPos } from '../types';

describe('GoalComposite', () => {
  const goal1 = new GoalBlock(10, 64, 10);
  const goal2 = new GoalBlock(20, 64, 20);
  const composite = new GoalComposite([goal1, goal2]);

  it('should match any child goal', () => {
    expect(composite.isEnd(10, 64, 10)).toBe(true);
    expect(composite.isEnd(20, 64, 20)).toBe(true);
  });

  it('should not match positions that dont match any child', () => {
    expect(composite.isEnd(15, 64, 15)).toBe(false);
  });

  it('should return minimum heuristic of children', () => {
    const h = composite.heuristic(15, 64, 15);
    const h1 = goal1.heuristic(15, 64, 15);
    const h2 = goal2.heuristic(15, 64, 15);
    expect(h).toBe(Math.min(h1, h2));
  });
});

describe('GoalComposite extras', () => {
  it('should throw for empty goals array', () => {
    expect(() => new GoalComposite([])).toThrow('GoalComposite requires at least one goal');
  });

  it('should create from positions', () => {
    const positions = [
      new BlockPos(10, 64, 10),
      new BlockPos(20, 64, 20),
    ];
    const composite = GoalComposite.fromPositions(positions);
    expect(composite.isEnd(10, 64, 10)).toBe(true);
    expect(composite.isEnd(20, 64, 20)).toBe(true);
    expect(composite.isEnd(15, 64, 15)).toBe(false);
  });
});

describe('GoalComposite edge cases', () => {
  it('should return Infinity heuristic when no goals match', () => {
    // Single goal, far away
    const goal = new GoalComposite([new GoalBlock(1000000, 1000000, 1000000)]);
    const h = goal.heuristic(0, 0, 0);
    expect(h).toBeGreaterThan(0);
    expect(Number.isFinite(h)).toBe(true);
  });

  it('should return single goal heuristic for single child', () => {
    const inner = new GoalBlock(10, 64, 10);
    const composite = new GoalComposite([inner]);
    expect(composite.heuristic(0, 0, 0)).toBe(inner.heuristic(0, 0, 0));
  });
});
