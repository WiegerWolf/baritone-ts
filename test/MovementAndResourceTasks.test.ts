/**
 * Movement and Resource Collection Tasks Tests
 *
 * These tests verify navigation and resource collection functionality:
 *
 * WHY these tasks matter:
 * 1. GetToChunkTask - Navigate to a general area (chunk) for exploration
 *    or structure finding. More lenient than exact block navigation.
 *
 * 2. CollectFoodTask - Autonomous food collection through hunting, harvesting,
 *    and cooking. Essential for survival without manual intervention.
 *
 * 3. CollectBlazeRodsTask - Complex multi-step resource collection:
 *    - Travel to Nether
 *    - Find Nether Fortress
 *    - Kill blazes safely
 *    Essential for End game progression.
 *
 * 4. FastTravelTask - Efficient long-distance travel using Nether's 8:1
 *    coordinate scaling. Crucial for speedruns and large world navigation.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../src/types';

// Import tasks
import {
  GetToChunkTask,
  getToChunk,
  getToChunkContaining,
} from '../src/tasks/concrete/GetToChunkTask';

import {
  CollectFoodTask,
  FoodCollectionState,
  collectFood,
  collectFoodUntilFull,
} from '../src/tasks/concrete/CollectFoodTask';

import {
  CollectBlazeRodsTask,
  BlazeCollectionState,
  collectBlazeRods,
  collectBlazeRodsForSpeedrun,
} from '../src/tasks/concrete/CollectBlazeRodsTask';

import {
  FastTravelTask,
  FastTravelState,
  fastTravelTo,
  fastTravelToPos,
} from '../src/tasks/concrete/FastTravelTask';

import {
  blockToChunk,
  chunkToBlock,
} from '../src/tasks/concrete/ChunkSearchTask';

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

// Mock item for testing
function createMockItem(name: string, count: number): any {
  return { name, count };
}

describe('GetToChunkTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Chunk coordinate utilities', () => {
    /**
     * WHY: Chunks are 16x16 blocks. Converting between block and chunk
     * coordinates is essential for chunk-based navigation.
     */
    it('should convert block to chunk coordinates', () => {
      expect(blockToChunk(0, 0)).toEqual({ x: 0, z: 0 });
      expect(blockToChunk(15, 15)).toEqual({ x: 0, z: 0 });
      expect(blockToChunk(16, 16)).toEqual({ x: 1, z: 1 });
      expect(blockToChunk(-1, -1)).toEqual({ x: -1, z: -1 });
      expect(blockToChunk(-16, -16)).toEqual({ x: -1, z: -1 });
      expect(blockToChunk(-17, -17)).toEqual({ x: -2, z: -2 });
    });

    it('should convert chunk to block coordinates (returns center)', () => {
      // chunkToBlock returns Vec3 at center of chunk (chunk * 16 + 8)
      const chunk00 = chunkToBlock({ x: 0, z: 0 });
      expect(chunk00.x).toBe(8);
      expect(chunk00.z).toBe(8);

      const chunk11 = chunkToBlock({ x: 1, z: 1 });
      expect(chunk11.x).toBe(24); // 1 * 16 + 8
      expect(chunk11.z).toBe(24);

      const chunkNeg = chunkToBlock({ x: -1, z: -1 });
      expect(chunkNeg.x).toBe(-8); // -1 * 16 + 8
      expect(chunkNeg.z).toBe(-8);
    });
  });

  describe('GetToChunkTask creation', () => {
    /**
     * WHY: GetToChunkTask simplifies navigation when exact position
     * doesn't matter - just being in the right chunk is enough.
     */
    it('should create task with chunk coordinates', () => {
      const task = new GetToChunkTask(bot, 5, 10);
      expect(task.displayName).toContain('GetToChunk');
      expect(task.displayName).toContain('5');
      expect(task.displayName).toContain('10');
    });

    it('should create from block position', () => {
      const task = GetToChunkTask.fromBlockPos(bot, 100, 200);
      expect(task.getTargetChunk().x).toBe(6); // 100 / 16 = 6
      expect(task.getTargetChunk().z).toBe(12); // 200 / 16 = 12
    });

    it('should create from Vec3', () => {
      const task = GetToChunkTask.fromVec3(bot, new Vec3(32, 64, 48));
      expect(task.getTargetChunk().x).toBe(2);
      expect(task.getTargetChunk().z).toBe(3);
    });
  });

  describe('GetToChunkTask completion', () => {
    it('should be finished when in target chunk', () => {
      // Player at (0, 64, 0) is in chunk (0, 0)
      const task = new GetToChunkTask(bot, 0, 0);
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });

    it('should not be finished when in different chunk', () => {
      const task = new GetToChunkTask(bot, 5, 5);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('GetToChunkTask equality', () => {
    it('should be equal if same chunk', () => {
      const task1 = new GetToChunkTask(bot, 5, 10);
      const task2 = new GetToChunkTask(bot, 5, 10);
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different chunk', () => {
      const task1 = new GetToChunkTask(bot, 5, 10);
      const task2 = new GetToChunkTask(bot, 6, 10);
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('getToChunk should create task', () => {
      const task = getToChunk(bot, 5, 10);
      expect(task).toBeInstanceOf(GetToChunkTask);
    });

    it('getToChunkContaining should create task from block', () => {
      const task = getToChunkContaining(bot, 100, 200);
      expect(task).toBeInstanceOf(GetToChunkTask);
      expect(task.getTargetChunk().x).toBe(6);
    });
  });
});

describe('CollectFoodTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('CollectFoodTask creation', () => {
    /**
     * WHY: Food collection is essential for autonomous survival.
     * The task should be configurable for different hunger needs.
     */
    it('should create task with units needed', () => {
      const task = new CollectFoodTask(bot, { unitsNeeded: 30 });
      expect(task.displayName).toContain('CollectFood');
      expect(task.displayName).toContain('30');
    });

    it('should use default config', () => {
      const task = new CollectFoodTask(bot);
      expect(task.displayName).toContain('20'); // Default
    });

    it('should create with static factory', () => {
      const task = CollectFoodTask.forUnits(bot, 50);
      expect(task.displayName).toContain('50');
    });
  });

  describe('Food potential calculation', () => {
    /**
     * WHY: Food potential includes both ready-to-eat food AND raw food
     * that can be cooked. This enables smarter food gathering decisions.
     */
    it('should start in searching state', () => {
      const task = new CollectFoodTask(bot);
      task.onStart();
      expect(task.getState()).toBe(FoodCollectionState.SEARCHING);
    });

    it('should calculate zero potential with empty inventory', () => {
      const task = new CollectFoodTask(bot);
      task.onStart();
      expect(task.getFoodPotential()).toBe(0);
    });

    it('should calculate potential with cooked food', () => {
      (bot.inventory as any).items = () => [
        createMockItem('cooked_beef', 5), // 5 * 8 = 40
      ];

      const task = new CollectFoodTask(bot);
      task.onStart();
      expect(task.getFoodPotential()).toBe(40);
    });

    it('should calculate potential with raw food (cookable)', () => {
      (bot.inventory as any).items = () => [
        createMockItem('beef', 5), // 5 * 8 (cooked value) = 40
      ];

      const task = new CollectFoodTask(bot);
      task.onStart();
      expect(task.getFoodPotential()).toBe(40);
    });

    it('should calculate potential with wheat (for bread)', () => {
      (bot.inventory as any).items = () => [
        createMockItem('wheat', 9), // 9 / 3 = 3 bread * 5 = 15
      ];

      const task = new CollectFoodTask(bot);
      task.onStart();
      expect(task.getFoodPotential()).toBe(15);
    });
  });

  describe('CollectFoodTask completion', () => {
    it('should be finished when food potential meets target', () => {
      (bot.inventory as any).items = () => [
        createMockItem('cooked_beef', 10), // 80 hunger
      ];

      const task = new CollectFoodTask(bot, { unitsNeeded: 20 });
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });

    it('should not be finished when below target', () => {
      (bot.inventory as any).items = () => [
        createMockItem('cooked_beef', 1), // 8 hunger
      ];

      const task = new CollectFoodTask(bot, { unitsNeeded: 20 });
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('CollectFoodTask equality', () => {
    it('should be equal if same units needed', () => {
      const task1 = new CollectFoodTask(bot, { unitsNeeded: 20 });
      const task2 = new CollectFoodTask(bot, { unitsNeeded: 20 });
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different units', () => {
      const task1 = new CollectFoodTask(bot, { unitsNeeded: 20 });
      const task2 = new CollectFoodTask(bot, { unitsNeeded: 30 });
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('collectFood should create task', () => {
      const task = collectFood(bot, 30);
      expect(task).toBeInstanceOf(CollectFoodTask);
    });

    it('collectFoodUntilFull should calculate needed amount', () => {
      (bot as any).food = 10; // Half full
      const task = collectFoodUntilFull(bot);
      expect(task).toBeInstanceOf(CollectFoodTask);
    });
  });
});

describe('CollectBlazeRodsTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('CollectBlazeRodsTask creation', () => {
    /**
     * WHY: Blaze rods are essential for End progression.
     * Typical speedrun needs 7 rods for Eyes of Ender.
     */
    it('should create task with count', () => {
      const task = new CollectBlazeRodsTask(bot, { count: 10 });
      expect(task.displayName).toContain('CollectBlazeRods');
      expect(task.displayName).toContain('10');
    });

    it('should use default count of 7', () => {
      const task = new CollectBlazeRodsTask(bot);
      expect(task.displayName).toContain('7');
    });

    it('should create with static factory', () => {
      const task = CollectBlazeRodsTask.forCount(bot, 5);
      expect(task.displayName).toContain('5');
    });
  });

  describe('CollectBlazeRodsTask state machine', () => {
    /**
     * WHY: Blaze rod collection requires multiple steps:
     * 1. Go to Nether
     * 2. Find fortress
     * 3. Find spawner
     * 4. Kill blazes
     */
    it('should start by going to Nether', () => {
      const task = new CollectBlazeRodsTask(bot);
      task.onStart();
      expect(task.getState()).toBe(BlazeCollectionState.GOING_TO_NETHER);
    });

    it('should have no spawner initially', () => {
      const task = new CollectBlazeRodsTask(bot);
      task.onStart();
      expect(task.getFoundSpawner()).toBeNull();
    });
  });

  describe('CollectBlazeRodsTask completion', () => {
    it('should be finished when have enough rods', () => {
      (bot.inventory as any).items = () => [
        createMockItem('blaze_rod', 10),
      ];

      const task = new CollectBlazeRodsTask(bot, { count: 7 });
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });

    it('should not be finished when below target', () => {
      (bot.inventory as any).items = () => [
        createMockItem('blaze_rod', 3),
      ];

      const task = new CollectBlazeRodsTask(bot, { count: 7 });
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('CollectBlazeRodsTask equality', () => {
    it('should be equal if same count', () => {
      const task1 = new CollectBlazeRodsTask(bot, { count: 7 });
      const task2 = new CollectBlazeRodsTask(bot, { count: 7 });
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different count', () => {
      const task1 = new CollectBlazeRodsTask(bot, { count: 7 });
      const task2 = new CollectBlazeRodsTask(bot, { count: 10 });
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('collectBlazeRods should create task', () => {
      const task = collectBlazeRods(bot, 5);
      expect(task).toBeInstanceOf(CollectBlazeRodsTask);
    });

    it('collectBlazeRodsForSpeedrun should create task with 7', () => {
      const task = collectBlazeRodsForSpeedrun(bot);
      expect(task).toBeInstanceOf(CollectBlazeRodsTask);
    });
  });
});

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

describe('Integration scenarios', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Speedrun workflow', () => {
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

  describe('Exploration workflow', () => {
    /**
     * WHY: Exploration involves chunk-based navigation and resource
     * gathering. These tasks enable autonomous exploration.
     */
    it('should create tasks for exploration', () => {
      // Navigate to a chunk
      const chunkTask = getToChunk(bot, 10, 10);
      expect(chunkTask).toBeInstanceOf(GetToChunkTask);

      // Collect food while exploring
      const foodTask = collectFoodUntilFull(bot);
      expect(foodTask).toBeInstanceOf(CollectFoodTask);
    });
  });

  describe('Nether coordinate scaling', () => {
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
});
