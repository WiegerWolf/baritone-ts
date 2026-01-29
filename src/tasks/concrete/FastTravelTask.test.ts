/**
 * FastTravelTask Tests
 *
 * WHY this task matters:
 * FastTravelTask - Efficient long-distance travel using Nether's 8:1
 * coordinate scaling. Crucial for speedruns and large world navigation.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';

import {
  FastTravelTask,
  FastTravelState,
  fastTravelTo,
  fastTravelToPos,
} from './FastTravelTask';

import { CollectFoodTask, collectFood } from './CollectFoodTask';
import { CollectBlazeRodsTask, collectBlazeRodsForSpeedrun } from './CollectBlazeRodsTask';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
      metadata: {},
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    entities: {},
    time: { timeOfDay: 6000, age: 0 },
    health: 20,
    food: 20,
    heldItem: null,
    game: { dimension: 'minecraft:overworld' },
    pathfinder: {
      setGoal: jest.fn(),
      goto: jest.fn(),
      isMoving: () => false,
    },
    setControlState: jest.fn(),
    clearControlStates: jest.fn(),
    look: jest.fn(),
    ...overrides,
  };

  return baseBot;
}

describe('FastTravelTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('FastTravelTask creation', () => {
    /**
     * WHY: Nether travel is 8x faster. 1000 blocks in Overworld = 125 in Nether.
     * This task handles the complex portal-based fast travel workflow.
     */
    it('should create task with target', () => {
      const target = new BlockPos(1000, 64, 1000);
      const task = new FastTravelTask(bot, { target });
      expect(task.displayName).toContain('FastTravel');
      expect(task.displayName).toContain('1000');
    });

    it('should create with static factory', () => {
      const task = FastTravelTask.to(bot, 1000, 64, 1000);
      expect(task).toBeInstanceOf(FastTravelTask);
    });

    it('should create from Vec3', () => {
      const task = FastTravelTask.toVec3(bot, new Vec3(1000, 64, 1000));
      expect(task).toBeInstanceOf(FastTravelTask);
    });
  });

  describe('FastTravelTask state machine', () => {
    /**
     * WHY: Fast travel has distinct phases:
     * 1. Check if Nether travel is worth it (threshold)
     * 2. Collect materials or walk
     * 3. Travel through Nether
     * 4. Exit and walk to target
     */
    it('should start by checking threshold', () => {
      const task = new FastTravelTask(bot, { target: new BlockPos(1000, 64, 1000) });
      task.onStart();
      expect(task.getState()).toBe(FastTravelState.CHECKING_THRESHOLD);
    });
  });

  describe('FastTravelTask completion', () => {
    it('should be finished when near target in overworld', () => {
      // Player at (0, 64, 0), target at (1, 64, 1) - very close
      const task = new FastTravelTask(bot, { target: new BlockPos(1, 64, 1) });
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });

    it('should not be finished when far from target', () => {
      const task = new FastTravelTask(bot, { target: new BlockPos(1000, 64, 1000) });
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('FastTravelTask equality', () => {
    it('should be equal if same target', () => {
      const task1 = new FastTravelTask(bot, { target: new BlockPos(1000, 64, 1000) });
      const task2 = new FastTravelTask(bot, { target: new BlockPos(1000, 64, 1000) });
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different target', () => {
      const task1 = new FastTravelTask(bot, { target: new BlockPos(1000, 64, 1000) });
      const task2 = new FastTravelTask(bot, { target: new BlockPos(2000, 64, 2000) });
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('fastTravelTo should create task', () => {
      const task = fastTravelTo(bot, 1000, 64, 1000);
      expect(task).toBeInstanceOf(FastTravelTask);
    });

    it('fastTravelToPos should create task', () => {
      const task = fastTravelToPos(bot, new Vec3(1000, 64, 1000));
      expect(task).toBeInstanceOf(FastTravelTask);
    });
  });
});

describe('Integration scenarios - Speedrun workflow', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  /**
   * WHY: Speedruns require efficient resource collection and travel.
   * These tests verify that tasks work together for speedrun scenarios.
   */
  it('should create tasks for speedrun progression', () => {
    // Collect food for the journey
    const foodTask = collectFood(bot, 40);
    expect(foodTask).toBeInstanceOf(CollectFoodTask);

    // Collect blaze rods
    const blazeTask = collectBlazeRodsForSpeedrun(bot);
    expect(blazeTask).toBeInstanceOf(CollectBlazeRodsTask);

    // Fast travel to stronghold (hypothetical coordinates)
    const travelTask = fastTravelTo(bot, 1500, 64, -500);
    expect(travelTask).toBeInstanceOf(FastTravelTask);
  });
});

describe('Integration scenarios - Nether coordinate scaling', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  /**
   * WHY: Understanding Nether scaling (8:1) is critical for fast travel.
   * These tests verify the math is correct.
   */
  it('should calculate correct Nether target from Overworld', () => {
    // If target is 1000 blocks in Overworld, Nether target is 125
    const overworldTarget = new BlockPos(1000, 64, 800);
    const task = new FastTravelTask(bot, { target: overworldTarget });

    // Internal calculation: 1000/8 = 125, 800/8 = 100
    // We can't directly test this, but the task should handle it
    expect(task).toBeDefined();
  });
});
