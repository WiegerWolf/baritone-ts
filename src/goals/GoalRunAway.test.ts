import { describe, it, expect } from 'bun:test';
import { GoalRunAway } from './index';
import { BlockPos } from '../types';

describe('GoalRunAway', () => {
  const dangers = [
    new BlockPos(100, 64, 100),
    new BlockPos(110, 64, 100)
  ];
  const goal = new GoalRunAway(dangers, 20);

  it('should match when far from all dangers', () => {
    expect(goal.isEnd(200, 64, 200)).toBe(true);
  });

  it('should not match when near any danger', () => {
    expect(goal.isEnd(105, 64, 100)).toBe(false);
  });

  it('should have lower heuristic farther from dangers', () => {
    const nearH = goal.heuristic(105, 64, 100);
    const farH = goal.heuristic(200, 64, 200);
    expect(nearH).toBeGreaterThan(farH);
  });
});

describe('GoalRunAway edge cases', () => {
  it('should return negative heuristic (maximizes distance)', () => {
    const dangers = [new BlockPos(0, 0, 0)];
    const goal = new GoalRunAway(dangers, 10);
    const h = goal.heuristic(100, 0, 0);
    expect(h).toBeLessThan(0);
  });

  it('should return more negative heuristic farther away', () => {
    const dangers = [new BlockPos(0, 0, 0)];
    const goal = new GoalRunAway(dangers, 10);
    const hNear = goal.heuristic(5, 0, 0);
    const hFar = goal.heuristic(50, 0, 0);
    // Farther = more negative (better for A*)
    expect(hFar).toBeLessThan(hNear);
  });

  it('should handle no dangers (always at goal)', () => {
    const goal = new GoalRunAway([], 10);
    expect(goal.isEnd(0, 0, 0)).toBe(true);
    // Sum of 0 dangers = -0
    expect(goal.heuristic(0, 0, 0)).toBe(-0);
  });
});
