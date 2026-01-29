/**
 * CollectObsidianTask Tests
 *
 * WHY this task matters:
 * CollectObsidianTask - Obsidian is essential for:
 *    - Nether portals (10-14 blocks)
 *    - Enchanting tables (4 blocks)
 *    - Ender chests (8 blocks)
 *    Requires diamond pickaxe (hardness 50).
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

import {
  CollectObsidianTask,
  ObsidianCollectionState,
  collectObsidian,
  collectObsidianForPortal,
} from './CollectObsidianTask';

import {
  ConstructNetherPortalTask,
  PortalConstructionState,
  constructPortal,
} from './ConstructNetherPortalTask';

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

describe('CollectObsidianTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('CollectObsidianTask creation', () => {
    /**
     * WHY: Obsidian collection requires configurable count for different uses:
     * - 10 blocks for minimal portal
     * - 14 blocks for full portal
     * - 4 blocks for enchanting table
     */
    it('should create task with default count', () => {
      const task = new CollectObsidianTask(bot);
      expect(task.displayName).toContain('CollectObsidian');
      expect(task.displayName).toContain('10'); // Default for portal
    });

    it('should create task with custom count', () => {
      const task = new CollectObsidianTask(bot, { count: 20 });
      expect(task.displayName).toContain('20');
    });

    it('should create task for portal (10 blocks)', () => {
      const task = CollectObsidianTask.forPortal(bot);
      expect(task.displayName).toContain('10');
    });

    it('should create task for full portal (14 blocks)', () => {
      const task = CollectObsidianTask.forFullPortal(bot);
      expect(task.displayName).toContain('14');
    });
  });

  describe('CollectObsidianTask completion', () => {
    /**
     * WHY: Task should complete when we have enough obsidian.
     * Obsidian stacks to 64, so we check inventory count.
     */
    it('should be finished when have enough obsidian', () => {
      (bot.inventory as any).items = () => [
        createMockItem('obsidian', 10),
      ];

      const task = new CollectObsidianTask(bot, { count: 10 });
      task.onStart();
      expect(task.isResourceFinished()).toBe(true);
    });

    it('should not be finished when lacking obsidian', () => {
      (bot.inventory as any).items = () => [
        createMockItem('obsidian', 5),
      ];

      const task = new CollectObsidianTask(bot, { count: 10 });
      task.onStart();
      expect(task.isResourceFinished()).toBe(false);
    });

    it('should count obsidian across multiple stacks', () => {
      (bot.inventory as any).items = () => [
        createMockItem('obsidian', 32),
        createMockItem('obsidian', 32),
      ];

      const task = new CollectObsidianTask(bot, { count: 50 });
      task.onStart();
      expect(task.isResourceFinished()).toBe(true);
    });
  });

  describe('CollectObsidianTask pickaxe requirement', () => {
    /**
     * WHY: Obsidian requires diamond or netherite pickaxe.
     * Hardness 50 means other tools take forever or don't work.
     */
    it('should recognize diamond pickaxe', () => {
      (bot.inventory as any).items = () => [
        createMockItem('diamond_pickaxe', 1),
      ];

      const task = new CollectObsidianTask(bot);
      task.onStart();
      task.onTick(); // State changes on tick
      // Task should proceed to mining, not getting pickaxe
      expect(task.getState()).not.toBe(ObsidianCollectionState.GETTING_PICKAXE);
    });

    it('should recognize netherite pickaxe', () => {
      (bot.inventory as any).items = () => [
        createMockItem('netherite_pickaxe', 1),
      ];

      const task = new CollectObsidianTask(bot);
      task.onStart();
      task.onTick(); // State changes on tick
      expect(task.getState()).not.toBe(ObsidianCollectionState.GETTING_PICKAXE);
    });

    it('should not proceed without proper pickaxe', () => {
      (bot.inventory as any).items = () => [
        createMockItem('iron_pickaxe', 1),
      ];

      const task = new CollectObsidianTask(bot);
      task.onStart();
      task.onTick();
      expect(task.getState()).toBe(ObsidianCollectionState.GETTING_PICKAXE);
    });
  });

  describe('CollectObsidianTask dimension awareness', () => {
    /**
     * WHY: Can't create obsidian in Nether because water evaporates instantly.
     * Must mine existing obsidian or return to Overworld.
     */
    it('should wander in Nether (cannot place water)', () => {
      (bot as any).game = { dimension: 'minecraft:the_nether' };
      (bot.inventory as any).items = () => [
        createMockItem('diamond_pickaxe', 1),
      ];

      const task = new CollectObsidianTask(bot);
      task.onStart();
      task.onTick();
      expect(task.getState()).toBe(ObsidianCollectionState.WANDERING);
    });

    it('should be able to create obsidian in Overworld', () => {
      (bot as any).game = { dimension: 'minecraft:overworld' };
      (bot.inventory as any).items = () => [
        createMockItem('diamond_pickaxe', 1),
      ];

      const task = new CollectObsidianTask(bot, { createFromLava: true });
      task.onStart();
      // Should search for lava or wander
      task.onTick();
      expect([
        ObsidianCollectionState.SEARCHING_LAVA,
        ObsidianCollectionState.WANDERING,
      ]).toContain(task.getState());
    });
  });

  describe('CollectObsidianTask equality', () => {
    it('should be equal if same count', () => {
      const task1 = new CollectObsidianTask(bot, { count: 10 });
      const task2 = new CollectObsidianTask(bot, { count: 10 });
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different count', () => {
      const task1 = new CollectObsidianTask(bot, { count: 10 });
      const task2 = new CollectObsidianTask(bot, { count: 14 });
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('collectObsidian should create task', () => {
      const task = collectObsidian(bot, 10);
      expect(task).toBeInstanceOf(CollectObsidianTask);
    });

    it('collectObsidianForPortal should create task for 10 blocks', () => {
      const task = collectObsidianForPortal(bot);
      expect(task).toBeInstanceOf(CollectObsidianTask);
    });
  });
});

describe('Integration: Obsidian to portal flow', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  /**
   * WHY: Real gameplay often chains these tasks together.
   * - Collect obsidian for portal
   * - Construct portal
   */
  it('should collect then construct', () => {
    // First collect obsidian
    (bot.inventory as any).items = () => [
      createMockItem('diamond_pickaxe', 1),
      createMockItem('obsidian', 10),
      createMockItem('water_bucket', 1),
      createMockItem('lava_bucket', 1),
      createMockItem('flint_and_steel', 1),
    ];

    const collectTask = collectObsidian(bot, 10);
    collectTask.onStart();
    expect(collectTask.isResourceFinished()).toBe(true);

    // Then construct portal
    const constructTask = constructPortal(bot);
    constructTask.onStart();
    // After onTick, should move to searching for location (has materials)
    constructTask.onTick();
    expect(constructTask.getState()).toBe(PortalConstructionState.SEARCHING_LOCATION);
  });
});
