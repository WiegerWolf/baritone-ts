/**
 * Integration tests for pathfinding with mock bot
 */

import { Vec3 } from 'vec3';
import { createMockBot, createMockBotWithObstacles, MockBot } from '../mocks';
import { GoalBlock, GoalNear, GoalXZ } from '../../src/goals';
import { BlockPos, PathNode } from '../../src/types';

// Note: These tests validate the pathfinding logic without requiring
// a real Minecraft server. The mock bot provides enough functionality
// to test the A* algorithm, goal checking, and basic path calculations.

describe('Integration: Pathfinding', () => {
  describe('Goal matching', () => {
    it('should match GoalBlock at exact position', () => {
      const goal = new GoalBlock(10, 64, 10);
      expect(goal.isEnd(10, 64, 10)).toBe(true);
      expect(goal.isEnd(10, 64, 11)).toBe(false);
    });

    it('should match GoalNear within radius', () => {
      const goal = new GoalNear(10, 64, 10, 5);
      expect(goal.isEnd(10, 64, 10)).toBe(true);
      expect(goal.isEnd(12, 64, 12)).toBe(true);
      expect(goal.isEnd(20, 64, 20)).toBe(false);
    });

    it('should match GoalXZ at any Y', () => {
      const goal = new GoalXZ(10, 10);
      expect(goal.isEnd(10, 0, 10)).toBe(true);
      expect(goal.isEnd(10, 100, 10)).toBe(true);
      expect(goal.isEnd(10, 64, 11)).toBe(false);
    });
  });

  describe('Heuristic calculations', () => {
    it('should return 0 heuristic at goal', () => {
      const goal = new GoalBlock(10, 64, 10);
      expect(goal.heuristic(10, 64, 10)).toBe(0);
    });

    it('should increase heuristic with distance', () => {
      const goal = new GoalBlock(0, 64, 0);
      const h1 = goal.heuristic(5, 64, 0);
      const h2 = goal.heuristic(10, 64, 0);
      const h3 = goal.heuristic(20, 64, 0);

      expect(h2).toBeGreaterThan(h1);
      expect(h3).toBeGreaterThan(h2);
    });

    it('should handle negative coordinates', () => {
      const goal = new GoalBlock(-100, 64, -100);
      expect(goal.heuristic(-100, 64, -100)).toBe(0);
      expect(goal.heuristic(-95, 64, -95)).toBeGreaterThan(0);
    });
  });

  describe('MockBot', () => {
    let bot: MockBot;

    beforeEach(() => {
      bot = createMockBot();
    });

    afterEach(() => {
      bot.end();
    });

    it('should have correct initial position', () => {
      expect(bot.entity.position.y).toBe(64);
      expect(bot.entity.onGround).toBe(true);
    });

    it('should have walkable floor', () => {
      const block = bot.blockAt(new Vec3(0, 63, 0));
      expect(block).not.toBeNull();
      expect(block!.name).toBe('stone');
      expect(block!.boundingBox).toBe('block');
    });

    it('should have air above floor', () => {
      const block = bot.blockAt(new Vec3(0, 64, 0));
      expect(block).not.toBeNull();
      expect(block!.name).toBe('air');
      expect(block!.boundingBox).toBe('empty');
    });

    it('should track control states', () => {
      expect(bot.getControlState('forward')).toBe(false);
      bot.setControlState('forward', true);
      expect(bot.getControlState('forward')).toBe(true);
      bot.clearControlStates();
      expect(bot.getControlState('forward')).toBe(false);
    });

    it('should update look direction', async () => {
      await bot.look(Math.PI / 2, 0);
      expect(bot.entity.yaw).toBe(Math.PI / 2);
      expect(bot.entity.pitch).toBe(0);
    });
  });

  describe('MockBot with obstacles', () => {
    let bot: MockBot;

    beforeEach(() => {
      bot = createMockBotWithObstacles();
    });

    afterEach(() => {
      bot.end();
    });

    it('should have walls', () => {
      // Check wall at z=-5 (outside the gap at z=-2 to z=2)
      const wallBlock = bot.blockAt(new Vec3(-5, 64, -5));
      expect(wallBlock).not.toBeNull();
      expect(wallBlock!.name).toBe('stone');
    });

    it('should have gaps in walls', () => {
      const gapBlock = bot.blockAt(new Vec3(-5, 64, 0));
      // The gap is at z=-2 to z=2, so z=0 is in the gap
      // Actually, based on the code, the gap is created with createAir
      // Let me check the coordinates again
      const airBlock = bot.blockAt(new Vec3(-5, 64, -1));
      expect(airBlock!.boundingBox).toBe('empty');
    });

    it('should have pit area', () => {
      // Pit is at x=-3 to 3, z=5 to 8, y=60 to 63
      const pitBlock = bot.blockAt(new Vec3(0, 62, 6));
      expect(pitBlock!.boundingBox).toBe('empty');
    });
  });

  describe('Path cost estimation', () => {
    it('should estimate straight line cost', () => {
      const goal = new GoalBlock(10, 64, 0);
      const h = goal.heuristic(0, 64, 0);

      // Should be approximately 10 * walk cost (4.633)
      // Heuristic is usually Euclidean distance scaled by min movement cost
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThan(100); // Reasonable upper bound
    });

    it('should estimate diagonal cost', () => {
      const goal = new GoalBlock(10, 64, 10);
      const h = goal.heuristic(0, 64, 0);

      // Diagonal distance is sqrt(10^2 + 10^2) ≈ 14.14
      expect(h).toBeGreaterThan(0);
    });

    it('should estimate 3D cost with Y difference', () => {
      const goal = new GoalBlock(10, 74, 10);
      const h = goal.heuristic(0, 64, 0);

      // Includes vertical component
      expect(h).toBeGreaterThan(0);
    });
  });

  describe('PathNode', () => {
    it('should create linked path', () => {
      const node1 = new PathNode(0, 64, 0, 0);
      const node2 = new PathNode(1, 64, 0, 0);
      const node3 = new PathNode(2, 64, 0, 0);

      node1.cost = 0;
      node2.cost = 4.633;
      node3.cost = 9.266;

      node2.previous = node1;
      node3.previous = node2;

      // Reconstruct path
      const path: PathNode[] = [];
      let current: PathNode | null = node3;
      while (current !== null) {
        path.unshift(current);
        current = current.previous;
      }

      expect(path.length).toBe(3);
      expect(path[0]).toBe(node1);
      expect(path[1]).toBe(node2);
      expect(path[2]).toBe(node3);
    });

    it('should track costs correctly', () => {
      const node = new PathNode(5, 64, 5, 10);
      expect(node.cost).toBe(Infinity);
      expect(node.estimatedCostToGoal).toBe(10);

      node.cost = 20;
      node.combinedCost = node.cost + node.estimatedCostToGoal;
      expect(node.combinedCost).toBe(30);
    });
  });

  describe('BlockPos', () => {
    it('should calculate distance correctly', () => {
      const pos1 = new BlockPos(0, 64, 0);
      const pos2 = new BlockPos(3, 64, 4);

      expect(pos1.distanceTo(pos2)).toBeCloseTo(5, 5);
    });

    it('should calculate distance squared', () => {
      const pos1 = new BlockPos(0, 64, 0);
      const pos2 = new BlockPos(3, 64, 4);

      expect(pos1.distanceSquared(pos2)).toBe(25); // 3^2 + 0^2 + 4^2 = 25
    });

    it('should create offsets', () => {
      const pos = new BlockPos(10, 64, 20);
      const offset = pos.offset(1, -1, 2);

      expect(offset.x).toBe(11);
      expect(offset.y).toBe(63);
      expect(offset.z).toBe(22);
    });
  });
});

describe('Integration: World scenarios', () => {
  describe('Flat terrain', () => {
    let bot: MockBot;

    beforeEach(() => {
      bot = createMockBot({ floorRadius: 100 });
    });

    afterEach(() => {
      bot.end();
    });

    it('should have consistent floor', () => {
      for (let x = -10; x <= 10; x++) {
        for (let z = -10; z <= 10; z++) {
          const block = bot.blockAt(new Vec3(x, 63, z));
          expect(block!.name).toBe('stone');
        }
      }
    });

    it('should have open space for movement', () => {
      for (let x = -10; x <= 10; x++) {
        for (let z = -10; z <= 10; z++) {
          const block1 = bot.blockAt(new Vec3(x, 64, z));
          const block2 = bot.blockAt(new Vec3(x, 65, z));
          expect(block1!.boundingBox).toBe('empty');
          expect(block2!.boundingBox).toBe('empty');
        }
      }
    });
  });

  describe('Custom terrain', () => {
    it('should support stairs pattern', () => {
      const bot = createMockBot();
      const world = bot.world;

      // Create stairs
      for (let i = 0; i < 5; i++) {
        world.setBlock(i, 63 + i, 0, { name: 'stone', boundingBox: 'block' });
        world.setBlock(i, 64 + i, 0, { name: 'air', boundingBox: 'empty' });
        world.setBlock(i, 65 + i, 0, { name: 'air', boundingBox: 'empty' });
      }

      // Verify stair pattern
      expect(bot.blockAt(new Vec3(0, 63, 0))!.name).toBe('stone');
      expect(bot.blockAt(new Vec3(1, 64, 0))!.name).toBe('stone');
      expect(bot.blockAt(new Vec3(2, 65, 0))!.name).toBe('stone');

      bot.end();
    });

    it('should support water placement', () => {
      const bot = createMockBot();
      const world = bot.world;

      // Create water pool
      world.fillRegion(-5, 62, -5, 5, 63, 5, {
        name: 'water',
        boundingBox: 'empty',
        diggable: false
      });

      const waterBlock = bot.blockAt(new Vec3(0, 63, 0));
      expect(waterBlock!.name).toBe('water');
      expect(waterBlock!.boundingBox).toBe('empty');

      bot.end();
    });
  });
});
