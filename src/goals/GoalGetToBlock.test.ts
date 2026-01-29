import { describe, it, expect } from 'bun:test';
import { GoalGetToBlock } from './index';

describe('GoalGetToBlock', () => {
  const goal = new GoalGetToBlock(10, 64, 20);

  it('should match adjacent positions', () => {
    expect(goal.isEnd(9, 64, 20)).toBe(true);  // -x
    expect(goal.isEnd(11, 64, 20)).toBe(true); // +x
    expect(goal.isEnd(10, 64, 19)).toBe(true); // -z
    expect(goal.isEnd(10, 64, 21)).toBe(true); // +z
    expect(goal.isEnd(10, 63, 20)).toBe(true); // -y
    expect(goal.isEnd(10, 65, 20)).toBe(true); // +y
  });

  it('should not match the block itself', () => {
    expect(goal.isEnd(10, 64, 20)).toBe(false);
  });

  it('should match diagonal positions within reach', () => {
    // GoalGetToBlock allows adjacent including diagonal (within 1 block on each axis)
    expect(goal.isEnd(11, 64, 21)).toBe(true);
    // But not 2 blocks away
    expect(goal.isEnd(12, 64, 20)).toBe(false);
  });
});

describe('GoalGetToBlock edge cases', () => {
  const goal = new GoalGetToBlock(10, 64, 20);

  it('should match all 3D diagonal neighbors', () => {
    // All 26 neighbors minus the block itself
    let adjacentCount = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) {
            expect(goal.isEnd(10, 64, 20)).toBe(false);
          } else {
            expect(goal.isEnd(10 + dx, 64 + dy, 20 + dz)).toBe(true);
            adjacentCount++;
          }
        }
      }
    }
    expect(adjacentCount).toBe(26);
  });

  it('should return 0 heuristic when already adjacent (dist=1)', () => {
    const h = goal.heuristic(11, 64, 20);
    expect(h).toBe(0);
  });

  it('should return positive heuristic when further than 1 block', () => {
    const h = goal.heuristic(15, 64, 20);
    expect(h).toBeGreaterThan(0);
  });
});
