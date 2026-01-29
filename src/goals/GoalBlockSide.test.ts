import { describe, it, expect } from 'bun:test';
import { GoalBlockSide, Direction } from './index';
import { BlockPos } from '../types';

describe('GoalBlockSide', () => {
  it('should match positions on correct side of block', () => {
    const goal = new GoalBlockSide(10, 64, 10, Direction.EAST, 1);
    // East means positive X direction
    expect(goal.isEnd(12, 64, 10)).toBe(true); // East side
    expect(goal.isEnd(8, 64, 10)).toBe(false);  // West side
  });

  it('should create from BlockPos', () => {
    const pos = new BlockPos(10, 64, 10);
    const goal = GoalBlockSide.fromBlockPos(pos, Direction.NORTH);
    expect(goal.blockX).toBe(10);
    expect(goal.blockY).toBe(64);
    expect(goal.blockZ).toBe(10);
  });

  it('should handle all directions', () => {
    const x = 10, y = 64, z = 10;
    // North = -z
    const north = new GoalBlockSide(x, y, z, Direction.NORTH, 1);
    expect(north.isEnd(x, y, z - 3)).toBe(true);

    // South = +z
    const south = new GoalBlockSide(x, y, z, Direction.SOUTH, 1);
    expect(south.isEnd(x, y, z + 3)).toBe(true);

    // Up = +y
    const up = new GoalBlockSide(x, y, z, Direction.UP, 1);
    expect(up.isEnd(x, y + 3, z)).toBe(true);

    // Down = -y
    const down = new GoalBlockSide(x, y, z, Direction.DOWN, 1);
    expect(down.isEnd(x, y - 3, z)).toBe(true);

    // West = -x
    const west = new GoalBlockSide(x, y, z, Direction.WEST, 1);
    expect(west.isEnd(x - 3, y, z)).toBe(true);
  });

  it('should return 0 heuristic when on correct side', () => {
    const goal = new GoalBlockSide(10, 64, 10, Direction.EAST, 1);
    expect(goal.heuristic(12, 64, 10)).toBeCloseTo(0);
  });

  it('should return positive heuristic when on wrong side', () => {
    const goal = new GoalBlockSide(10, 64, 10, Direction.EAST, 1);
    expect(goal.heuristic(8, 64, 10)).toBeGreaterThan(0);
  });
});
