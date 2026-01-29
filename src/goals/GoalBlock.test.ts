import { describe, it, expect } from 'bun:test';
import { GoalBlock } from './index';
import { BlockPos } from '../types';
import { Vec3 } from 'vec3';

describe('GoalBlock', () => {
  const goal = new GoalBlock(10, 64, 20);

  it('should match exact position', () => {
    expect(goal.isEnd(10, 64, 20)).toBe(true);
  });

  it('should not match other positions', () => {
    expect(goal.isEnd(10, 64, 21)).toBe(false);
    expect(goal.isEnd(10, 65, 20)).toBe(false);
    expect(goal.isEnd(11, 64, 20)).toBe(false);
  });

  it('should return 0 heuristic at goal', () => {
    expect(goal.heuristic(10, 64, 20)).toBe(0);
  });

  it('should return positive heuristic away from goal', () => {
    expect(goal.heuristic(0, 64, 0)).toBeGreaterThan(0);
    expect(goal.heuristic(20, 64, 40)).toBeGreaterThan(0);
  });

  it('should scale heuristic with distance', () => {
    const near = goal.heuristic(11, 64, 20);
    const far = goal.heuristic(20, 64, 20);
    expect(far).toBeGreaterThan(near);
  });
});

describe('GoalBlock static methods', () => {
  it('should create from Vec3', () => {
    const goal = GoalBlock.fromVec3(new Vec3(10.7, 64.3, 20.9));
    expect(goal.x).toBe(10);
    expect(goal.y).toBe(64);
    expect(goal.z).toBe(20);
  });

  it('should create from BlockPos', () => {
    const pos = new BlockPos(5, 60, 15);
    const goal = GoalBlock.fromBlockPos(pos);
    expect(goal.x).toBe(5);
    expect(goal.y).toBe(60);
    expect(goal.z).toBe(15);
  });
});
