import { describe, it, expect } from 'bun:test';
import { GoalDirectionXZ } from './index';

describe('GoalDirectionXZ', () => {
  it('should never return true for isEnd', () => {
    const goal = new GoalDirectionXZ(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    );
    expect(goal.isEnd(0, 64, 0)).toBe(false);
    expect(goal.isEnd(1000, 64, 0)).toBe(false);
  });

  it('should reward movement in correct direction', () => {
    const goal = new GoalDirectionXZ(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    );
    const hForward = goal.heuristic(10, 64, 0);
    const hBackward = goal.heuristic(-10, 64, 0);
    expect(hForward).toBeLessThan(hBackward);
  });

  it('should penalize sideways deviation', () => {
    const goal = new GoalDirectionXZ(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    );
    const hOnLine = goal.heuristic(10, 64, 0);
    const hOffLine = goal.heuristic(10, 64, 10);
    expect(hOffLine).toBeGreaterThan(hOnLine);
  });

  it('should throw for zero direction', () => {
    expect(() => new GoalDirectionXZ(
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    )).toThrow('Direction vector cannot be zero');
  });
});

describe('GoalDirectionXZ edge cases', () => {
  it('should handle diagonal direction', () => {
    const goal = new GoalDirectionXZ(
      { x: 0, z: 0 },
      { x: 1, z: 1 },
    );
    const hForward = goal.heuristic(10, 64, 10);
    const hBackward = goal.heuristic(-10, 64, -10);
    expect(hForward).toBeLessThan(hBackward);
  });

  it('should penalize sideways movement with custom penalty', () => {
    const goal = new GoalDirectionXZ(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      5.0 // High side penalty
    );
    const hOnLine = goal.heuristic(10, 64, 0);
    const hOffLine = goal.heuristic(10, 64, 5);
    expect(hOffLine).toBeGreaterThan(hOnLine);
  });

  it('should throw for near-zero direction', () => {
    expect(() => new GoalDirectionXZ(
      { x: 0, z: 0 },
      { x: 0.0001, z: 0.0001 },
    )).toThrow('Direction vector cannot be zero');
  });
});
