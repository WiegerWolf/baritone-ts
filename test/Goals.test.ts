import {
  GoalBlock,
  GoalXZ,
  GoalYLevel,
  GoalGetToBlock,
  GoalNear,
  GoalTwoBlocks,
  GoalComposite,
  GoalInverted,
  GoalRunAway,
  GoalAABB
} from '../src/goals';
import { BlockPos } from '../src/types';

describe('Goals', () => {
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

  describe('GoalXZ', () => {
    const goal = new GoalXZ(100, 200);

    it('should match any Y at target XZ', () => {
      expect(goal.isEnd(100, 0, 200)).toBe(true);
      expect(goal.isEnd(100, 64, 200)).toBe(true);
      expect(goal.isEnd(100, 256, 200)).toBe(true);
    });

    it('should not match other XZ positions', () => {
      expect(goal.isEnd(101, 64, 200)).toBe(false);
      expect(goal.isEnd(100, 64, 201)).toBe(false);
    });

    it('should not include Y in heuristic', () => {
      const h1 = goal.heuristic(100, 0, 200);
      const h2 = goal.heuristic(100, 100, 200);
      expect(h1).toBe(h2);
    });
  });

  describe('GoalYLevel', () => {
    const goal = new GoalYLevel(64);

    it('should match any XZ at target Y', () => {
      expect(goal.isEnd(0, 64, 0)).toBe(true);
      expect(goal.isEnd(100, 64, 200)).toBe(true);
      expect(goal.isEnd(-50, 64, -50)).toBe(true);
    });

    it('should not match other Y levels', () => {
      expect(goal.isEnd(0, 63, 0)).toBe(false);
      expect(goal.isEnd(0, 65, 0)).toBe(false);
    });

    it('should only consider Y in heuristic', () => {
      const h1 = goal.heuristic(0, 60, 0);
      const h2 = goal.heuristic(1000, 60, 1000);
      expect(h1).toBe(h2);
    });
  });

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

  describe('GoalNear', () => {
    const goal = new GoalNear(100, 64, 100, 5);

    it('should match positions within radius', () => {
      expect(goal.isEnd(100, 64, 100)).toBe(true); // Center
      expect(goal.isEnd(103, 64, 100)).toBe(true); // Within radius
      expect(goal.isEnd(100, 64, 103)).toBe(true);
    });

    it('should not match positions outside radius', () => {
      expect(goal.isEnd(106, 64, 100)).toBe(false);
      expect(goal.isEnd(100, 70, 100)).toBe(false);
    });

    it('should return 0 heuristic within radius', () => {
      expect(goal.heuristic(102, 64, 102)).toBe(0);
    });
  });

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
});
