import { describe, it, expect } from 'bun:test';
import { GoalAABB } from './index';

describe('GoalAABB', () => {
  const goal = new GoalAABB(10, 64, 10, 20, 70, 20);

  it('should match positions inside bounding box', () => {
    expect(goal.isEnd(15, 67, 15)).toBe(true);
    expect(goal.isEnd(10, 64, 10)).toBe(true); // Corner
    expect(goal.isEnd(20, 70, 20)).toBe(true); // Other corner
  });

  it('should not match positions outside bounding box', () => {
    expect(goal.isEnd(5, 67, 15)).toBe(false);  // X too low
    expect(goal.isEnd(25, 67, 15)).toBe(false); // X too high
    expect(goal.isEnd(15, 63, 15)).toBe(false); // Y too low
    expect(goal.isEnd(15, 71, 15)).toBe(false); // Y too high
  });

  it('should return 0 heuristic inside box', () => {
    expect(goal.heuristic(15, 67, 15)).toBe(0);
  });

  it('should return positive heuristic outside box', () => {
    expect(goal.heuristic(0, 67, 15)).toBeGreaterThan(0);
  });
});

describe('GoalAABB edge cases', () => {
  it('should handle single-block AABB', () => {
    const goal = new GoalAABB(10, 64, 20, 10, 64, 20);
    expect(goal.isEnd(10, 64, 20)).toBe(true);
    expect(goal.isEnd(11, 64, 20)).toBe(false);
  });

  it('should compute correct distance from each axis', () => {
    const goal = new GoalAABB(10, 64, 10, 20, 70, 20);
    // Only X is out of range
    const hX = goal.heuristic(5, 67, 15);
    expect(hX).toBeGreaterThan(0);
    // Only Y is out of range
    const hY = goal.heuristic(15, 60, 15);
    expect(hY).toBeGreaterThan(0);
    // Only Z is out of range
    const hZ = goal.heuristic(15, 67, 5);
    expect(hZ).toBeGreaterThan(0);
  });
});
