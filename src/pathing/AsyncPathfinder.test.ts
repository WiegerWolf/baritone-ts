/**
 * Unit tests for AsyncPathfinder
 */

import { AsyncPathfinder, AsyncPathState, AsyncPathProgress } from './AsyncPathfinder';
import { GoalBlock, GoalNear } from '../goals';
import { CalculationContext } from '../types';

/**
 * Create a mock calculation context for testing
 */
function createMockContext(options: {
  solidBlocks?: Set<string>;
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
    getBreakTime: () => 20,
    getBestTool: () => null,
    canDig: false,
    canPlace: false,
    allowSprint: true,
    allowParkour: true,
    allowWaterBucket: false,
    jumpPenalty: 0,
    getFavoring: () => 1.0
  };
}

describe('AsyncPathfinder', () => {
  describe('initialization', () => {
    it('should initialize with default options', () => {
      const pathfinder = new AsyncPathfinder();
      expect(pathfinder).toBeDefined();
      expect(pathfinder.getState()).toBe(AsyncPathState.IDLE);
    });

    it('should initialize with custom options', () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 50,
        totalTimeoutMs: 5000
      });
      expect(pathfinder).toBeDefined();
    });
  });

  describe('compute', () => {
    it('should find path to nearby goal', async () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 100,
        totalTimeoutMs: 5000
      });
      const ctx = createMockContext();
      const goal = new GoalBlock(5, 64, 5);

      const result = await pathfinder.compute(0, 64, 0, goal, ctx);

      expect(result.status).toBe('success');
      expect(result.path.length).toBeGreaterThan(0);
      expect(result.path[result.path.length - 1].x).toBe(5);
      expect(result.path[result.path.length - 1].z).toBe(5);
    }, 10000);

    it('should find path to immediate goal', async () => {
      const pathfinder = new AsyncPathfinder();
      const ctx = createMockContext();
      const goal = new GoalBlock(0, 64, 0);

      const result = await pathfinder.compute(0, 64, 0, goal, ctx);

      expect(result.status).toBe('success');
      expect(result.path.length).toBe(1);
    });

    it('should work with GoalNear', async () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 100,
        totalTimeoutMs: 5000
      });
      const ctx = createMockContext();
      const goal = new GoalNear(10, 64, 10, 2);

      const result = await pathfinder.compute(0, 64, 0, goal, ctx);

      expect(result.status).toBe('success');
      const end = result.path[result.path.length - 1];
      const dist = Math.sqrt(
        Math.pow(end.x - 10, 2) +
        Math.pow(end.z - 10, 2)
      );
      expect(dist).toBeLessThanOrEqual(2);
    }, 10000);

    it('should return noPath when blocked', async () => {
      // Create enclosed area
      const solidBlocks = new Set<string>();
      for (let x = -5; x <= 5; x++) {
        for (let z = -5; z <= 5; z++) {
          solidBlocks.add(`${x},63,${z}`);
        }
      }
      // Wall around start
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx !== 0 || dz !== 0) {
            solidBlocks.add(`${dx},64,${dz}`);
            solidBlocks.add(`${dx},65,${dz}`);
          }
        }
      }

      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 100,
        totalTimeoutMs: 5000
      });
      const ctx = createMockContext({ solidBlocks });
      const goal = new GoalBlock(10, 64, 10);

      const result = await pathfinder.compute(0, 64, 0, goal, ctx);

      expect(result.status).toBe('noPath');
    }, 10000);
  });

  describe('state management', () => {
    it('should update state during computation', async () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 10,
        totalTimeoutMs: 5000
      });
      const ctx = createMockContext();
      const goal = new GoalBlock(10, 64, 10);

      const statesObserved: AsyncPathState[] = [];

      // Start computation
      const promise = pathfinder.compute(0, 64, 0, goal, ctx);

      // Check state is computing
      statesObserved.push(pathfinder.getState());

      await promise;

      // Check state is complete
      statesObserved.push(pathfinder.getState());

      expect(statesObserved).toContain(AsyncPathState.COMPUTING);
      expect(pathfinder.getState()).toBe(AsyncPathState.COMPLETE);
    }, 10000);

    it('should be IDLE initially', () => {
      const pathfinder = new AsyncPathfinder();
      expect(pathfinder.getState()).toBe(AsyncPathState.IDLE);
    });
  });

  describe('cancellation', () => {
    it('should cancel and update state', () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 5,
        totalTimeoutMs: 10000
      });
      const ctx = createMockContext();
      const goal = new GoalBlock(100, 64, 100);

      // Start computation (don't await)
      pathfinder.compute(0, 64, 0, goal, ctx);

      // State should be computing
      expect(pathfinder.getState()).toBe(AsyncPathState.COMPUTING);

      // Cancel
      pathfinder.cancel();

      // State should be cancelled
      expect(pathfinder.getState()).toBe(AsyncPathState.CANCELLED);
    });

    it('should be safe to cancel when idle', () => {
      const pathfinder = new AsyncPathfinder();

      // Should not throw
      pathfinder.cancel();

      expect(pathfinder.getState()).toBe(AsyncPathState.IDLE);
    });
  });

  describe('progress callbacks', () => {
    it('should call onProgress during computation', async () => {
      const progressEvents: AsyncPathProgress[] = [];

      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 10,
        totalTimeoutMs: 5000,
        onProgress: (progress) => {
          progressEvents.push({ ...progress });
        }
      });
      const ctx = createMockContext();
      const goal = new GoalBlock(15, 64, 15);

      await pathfinder.compute(0, 64, 0, goal, ctx);

      // Should have received progress events
      expect(progressEvents.length).toBeGreaterThan(0);

      // Progress should have visited nodes
      expect(progressEvents[progressEvents.length - 1].visitedNodes).toBeGreaterThan(0);
    }, 10000);

    it('should call onComplete when done', async () => {
      let completeCalled = false;
      let completeResult: any = null;

      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 50,
        totalTimeoutMs: 5000,
        onComplete: (result) => {
          completeCalled = true;
          completeResult = result;
        }
      });
      const ctx = createMockContext();
      const goal = new GoalBlock(3, 64, 3);

      await pathfinder.compute(0, 64, 0, goal, ctx);

      expect(completeCalled).toBe(true);
      expect(completeResult).not.toBeNull();
      expect(completeResult.status).toBe('success');
    }, 10000);
  });

  describe('timeout handling', () => {
    it('should timeout on very long paths', async () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 10,
        totalTimeoutMs: 100 // Very short timeout
      });
      const ctx = createMockContext();
      const goal = new GoalBlock(1000, 64, 1000); // Unreachably far

      const result = await pathfinder.compute(0, 64, 0, goal, ctx);

      expect(result.status).toBe('timeout');
      // Should still have partial path
      expect(result.path.length).toBeGreaterThan(0);
    }, 5000);
  });

  describe('result properties', () => {
    it('should include visited node count', async () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 100,
        totalTimeoutMs: 5000
      });
      const ctx = createMockContext();
      const goal = new GoalBlock(5, 64, 5);

      const result = await pathfinder.compute(0, 64, 0, goal, ctx);

      expect(result.visitedNodes).toBeDefined();
      expect(result.visitedNodes).toBeGreaterThan(0);
    }, 10000);

    it('should include generated node count', async () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 100,
        totalTimeoutMs: 5000
      });
      const ctx = createMockContext();
      const goal = new GoalBlock(5, 64, 5);

      const result = await pathfinder.compute(0, 64, 0, goal, ctx);

      expect(result.generatedNodes).toBeDefined();
      expect(result.generatedNodes).toBeGreaterThanOrEqual(result.visitedNodes);
    }, 10000);

    it('should have connected path', async () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 100,
        totalTimeoutMs: 5000
      });
      const ctx = createMockContext();
      const goal = new GoalBlock(8, 64, 8);

      const result = await pathfinder.compute(0, 64, 0, goal, ctx);

      expect(result.status).toBe('success');

      // Verify path connectivity
      for (let i = 1; i < result.path.length; i++) {
        const prev = result.path[i - 1];
        const curr = result.path[i];
        const dx = Math.abs(curr.x - prev.x);
        const dz = Math.abs(curr.z - prev.z);

        expect(dx).toBeLessThanOrEqual(4); // Allow parkour
        expect(dz).toBeLessThanOrEqual(4);
      }
    }, 10000);
  });

  describe('multiple computations', () => {
    it('should handle sequential computations', async () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 50,
        totalTimeoutMs: 5000
      });
      const ctx = createMockContext();

      // First computation
      const result1 = await pathfinder.compute(0, 64, 0, new GoalBlock(3, 64, 0), ctx);
      expect(result1.status).toBe('success');

      // Second computation
      const result2 = await pathfinder.compute(0, 64, 0, new GoalBlock(0, 64, 3), ctx);
      expect(result2.status).toBe('success');

      // Paths should be different
      expect(result1.path[result1.path.length - 1].z).toBe(0);
      expect(result2.path[result2.path.length - 1].z).toBe(3);
    }, 15000);

    it('should allow starting new computation after cancel', async () => {
      const pathfinder = new AsyncPathfinder({
        chunkTimeMs: 50,
        totalTimeoutMs: 5000
      });
      const ctx = createMockContext();

      // Start computation but cancel immediately
      pathfinder.compute(0, 64, 0, new GoalBlock(50, 64, 50), ctx);
      pathfinder.cancel();

      expect(pathfinder.getState()).toBe(AsyncPathState.CANCELLED);

      // Start new computation - should work
      const result = await pathfinder.compute(0, 64, 0, new GoalBlock(2, 64, 2), ctx);
      expect(result.status).toBe('success');
      expect(pathfinder.getState()).toBe(AsyncPathState.COMPLETE);
    }, 10000);
  });
});
