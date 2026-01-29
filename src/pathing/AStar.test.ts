/**
 * Unit tests for A* algorithm
 */

import { AStar } from './AStar';
import { GoalBlock, GoalNear, GoalXZ } from '../goals';
import { CalculationContext, PathNode, BlockPos } from '../types';

/**
 * Create a mock calculation context for testing
 */
function createMockContext(options: {
  solidBlocks?: Set<string>;
  canDig?: boolean;
  canPlace?: boolean;
  allowSprint?: boolean;
  allowParkour?: boolean;
} = {}): CalculationContext {
  const solidBlocks = options.solidBlocks || new Set<string>();

  // Default: floor at y=63, air above
  if (solidBlocks.size === 0) {
    for (let x = -50; x <= 50; x++) {
      for (let z = -50; z <= 50; z++) {
        solidBlocks.add(`${x},63,${z}`);
      }
    }
  }

  const isSolid = (x: number, y: number, z: number) => solidBlocks.has(`${x},${y},${z}`);

  return {
    bot: {} as any,
    world: {} as any,
    canWalkOn: (block) => block !== null,
    canWalkThrough: (block) => block === null || block.boundingBox === 'empty',
    isWater: () => false,
    isLava: () => false,
    getBlock: (x, y, z) => {
      if (isSolid(x, y, z)) {
        return { boundingBox: 'block', name: 'stone' } as any;
      }
      return null;
    },
    getBreakTime: () => 20, // 1 second
    getBestTool: () => null,
    canDig: options.canDig ?? false,
    canPlace: options.canPlace ?? false,
    allowSprint: options.allowSprint ?? true,
    allowParkour: options.allowParkour ?? true,
    allowWaterBucket: false,
    jumpPenalty: 0,
    getFavoring: () => 1.0
  };
}

describe('AStar', () => {
  describe('initialization', () => {
    it('should initialize with start position', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(10, 64, 10);
      const astar = new AStar(0, 64, 0, goal, ctx);

      // Should not throw
      expect(astar).toBeDefined();
    });

    it('should throw on NaN heuristic', () => {
      const ctx = createMockContext();
      const badGoal = {
        isEnd: () => false,
        heuristic: () => NaN
      };

      expect(() => new AStar(0, 64, 0, badGoal, ctx)).toThrow('NaN heuristic');
    });
  });

  describe('path finding', () => {
    it('should find path to adjacent block', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(1, 64, 0);
      const astar = new AStar(0, 64, 0, goal, ctx);

      const result = astar.compute(1000);

      expect(result.status).toBe('success');
      expect(result.path.length).toBeGreaterThan(0);
      expect(result.path[result.path.length - 1].x).toBe(1);
      expect(result.path[result.path.length - 1].z).toBe(0);
    });

    it('should find path in straight line', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(5, 64, 0);
      const astar = new AStar(0, 64, 0, goal, ctx);

      const result = astar.compute(5000);

      expect(result.status).toBe('success');
      expect(result.path.length).toBe(6); // 0 to 5 inclusive
    });

    it('should find diagonal path', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(3, 64, 3);
      const astar = new AStar(0, 64, 0, goal, ctx);

      const result = astar.compute(5000);

      expect(result.status).toBe('success');
      expect(result.path[result.path.length - 1].x).toBe(3);
      expect(result.path[result.path.length - 1].z).toBe(3);
    });

    it('should return success immediately at goal', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(0, 64, 0);
      const astar = new AStar(0, 64, 0, goal, ctx);

      const result = astar.compute(100);

      expect(result.status).toBe('success');
      expect(result.path.length).toBe(1);
    });

    it('should work with GoalNear', () => {
      const ctx = createMockContext();
      const goal = new GoalNear(10, 64, 10, 3);
      const astar = new AStar(0, 64, 0, goal, ctx);

      const result = astar.compute(5000);

      expect(result.status).toBe('success');
      const end = result.path[result.path.length - 1];
      const dist = Math.sqrt(
        Math.pow(end.x - 10, 2) +
        Math.pow(end.y - 64, 2) +
        Math.pow(end.z - 10, 2)
      );
      expect(dist).toBeLessThanOrEqual(3);
    });

    it('should work with GoalXZ', () => {
      const ctx = createMockContext();
      const goal = new GoalXZ(5, 5);
      const astar = new AStar(0, 64, 0, goal, ctx);

      const result = astar.compute(5000);

      expect(result.status).toBe('success');
      const end = result.path[result.path.length - 1];
      expect(end.x).toBe(5);
      expect(end.z).toBe(5);
    });
  });

  describe('obstacle handling', () => {
    it('should path around wall', () => {
      // Create a wall at x=2 from z=-5 to z=5
      const solidBlocks = new Set<string>();

      // Floor
      for (let x = -10; x <= 10; x++) {
        for (let z = -10; z <= 10; z++) {
          solidBlocks.add(`${x},63,${z}`);
        }
      }

      // Wall at x=2 with gap at z=3
      for (let z = -5; z <= 5; z++) {
        if (z !== 3) {
          solidBlocks.add(`2,64,${z}`);
          solidBlocks.add(`2,65,${z}`);
        }
      }

      const ctx = createMockContext({ solidBlocks });
      const goal = new GoalBlock(5, 64, 0);
      const astar = new AStar(0, 64, 0, goal, ctx);

      const result = astar.compute(10000);

      expect(result.status).toBe('success');
      // Path should go through the gap at z=3
      const pathZ = result.path.map(n => n.z);
      expect(pathZ.some(z => z === 3)).toBe(true);
    });

    it('should return noPath when completely blocked', () => {
      // Create an enclosed area
      const solidBlocks = new Set<string>();

      // Floor
      for (let x = -5; x <= 5; x++) {
        for (let z = -5; z <= 5; z++) {
          solidBlocks.add(`${x},63,${z}`);
        }
      }

      // Complete wall around start position
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx !== 0 || dz !== 0) {
            solidBlocks.add(`${dx},64,${dz}`);
            solidBlocks.add(`${dx},65,${dz}`);
          }
        }
      }

      const ctx = createMockContext({ solidBlocks });
      const goal = new GoalBlock(10, 64, 10);
      const astar = new AStar(0, 64, 0, goal, ctx);

      const result = astar.compute(10000);

      expect(result.status).toBe('noPath');
    });
  });

  describe('partial results', () => {
    it('should return partial when tick timeout hit', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(100, 64, 100); // Far goal
      const astar = new AStar(0, 64, 0, goal, ctx);

      // Very short tick timeout
      const result = astar.compute(1);

      // Should either be partial (still computing) or success (if fast enough)
      expect(['partial', 'success']).toContain(result.status);
    });

    it('should continue computing after partial', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(20, 64, 20);
      const astar = new AStar(0, 64, 0, goal, ctx);

      // First compute with short timeout
      let result = astar.compute(5);
      let iterations = 0;

      // Keep computing until done or max iterations
      while (result.status === 'partial' && iterations < 100) {
        result = astar.compute(5);
        iterations++;
      }

      expect(result.status).toBe('success');
    });
  });

  describe('path properties', () => {
    it('should build path with increasing cost', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(5, 64, 0);
      const astar = new AStar(0, 64, 0, goal, ctx);

      const result = astar.compute(5000);

      expect(result.status).toBe('success');

      // Cost should increase along path
      let prevCost = 0;
      for (const node of result.path) {
        expect(node.cost).toBeGreaterThanOrEqual(prevCost);
        prevCost = node.cost;
      }
    });

    it('should have connected path nodes', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(5, 64, 5);
      const astar = new AStar(0, 64, 0, goal, ctx);

      const result = astar.compute(5000);

      expect(result.status).toBe('success');

      // Each node should be within 2 blocks of previous (allowing diagonal + fall)
      for (let i = 1; i < result.path.length; i++) {
        const prev = result.path[i - 1];
        const curr = result.path[i];

        const dx = Math.abs(curr.x - prev.x);
        const dy = Math.abs(curr.y - prev.y);
        const dz = Math.abs(curr.z - prev.z);

        // Standard movements are within 1 block, parkour up to 4
        expect(dx).toBeLessThanOrEqual(4);
        expect(dy).toBeLessThanOrEqual(4);
        expect(dz).toBeLessThanOrEqual(4);
      }
    });

    it('should start at start position', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(5, 64, 5);
      const astar = new AStar(3, 64, 2, goal, ctx);

      const result = astar.compute(5000);

      expect(result.status).toBe('success');
      expect(result.path[0].x).toBe(3);
      expect(result.path[0].y).toBe(64);
      expect(result.path[0].z).toBe(2);
    });
  });

  describe('visited chunks tracking', () => {
    it('should track visited chunks', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(20, 64, 20);
      const astar = new AStar(0, 64, 0, goal, ctx);

      astar.compute(5000);

      // Should have visited some chunks
      expect(astar.visitedChunks.size).toBeGreaterThan(0);

      // Should include chunk at start position
      expect(astar.visitedChunks.has('0,0')).toBe(true);
    });
  });

  describe('timeouts', () => {
    it('should respect primary timeout', () => {
      const ctx = createMockContext();
      // Very far goal that can't be reached quickly
      const goal = new GoalBlock(1000, 64, 1000);
      const astar = new AStar(0, 64, 0, goal, ctx, 100, 50); // 100ms primary, 50ms failure

      const start = performance.now();
      const result = astar.compute(1000); // Long tick timeout
      const elapsed = performance.now() - start;

      expect(['timeout', 'partial']).toContain(result.status);
      // Should not take much longer than timeout
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('graceful degradation', () => {
    it('should provide best partial path on timeout', () => {
      const ctx = createMockContext();
      const goal = new GoalBlock(100, 64, 100);
      const astar = new AStar(0, 64, 0, goal, ctx, 50, 25);

      const result = astar.compute(1000);

      // Even on timeout, should have a path
      expect(result.path.length).toBeGreaterThan(0);

      // Path should lead toward goal
      const end = result.path[result.path.length - 1];
      const startDist = Math.sqrt(100*100 + 100*100);
      const endDist = Math.sqrt(
        Math.pow(end.x - 100, 2) +
        Math.pow(end.z - 100, 2)
      );

      expect(endDist).toBeLessThan(startDist);
    });
  });
});
