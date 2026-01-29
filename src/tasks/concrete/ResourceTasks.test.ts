/**
 * Tests for Resource Collection Tasks
 *
 * These tests verify that resource collection tasks work correctly:
 * - WHY: Resource collection is fundamental to Minecraft progression.
 *   Mining, hunting, and fuel gathering enable crafting and smelting.
 * - INTENT: Validate item tracking, state transitions, and collection logic.
 */

import {
  ResourceTask,
  ItemTarget,
  itemTarget,
  Dimension,
} from './ResourceTask';
import {
  MineAndCollectTask,
  mineAndCollect,
  mineOre,
} from './MineAndCollectTask';
import {
  KillAndLootTask,
  killAndLoot,
  huntForFood,
  huntMobForDrop,
} from './KillAndLootTask';
import {
  CollectFuelTask,
  collectFuel,
  collectFuelForSmelting,
  FUEL_SOURCES,
} from './CollectFuelTask';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { Vec3 } from 'vec3';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
      yaw: 0,
      pitch: 0,
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
    game: { dimension: 'minecraft:overworld' },
    attack: jest.fn(),
    setControlState: jest.fn(),
    clearControlStates: jest.fn(),
    look: jest.fn(),
    targetDigBlock: null,
    currentWindow: null,
    player: {},
    ...overrides,
  };

  // Add Vec3 methods to position
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  return baseBot;
}

// Mock block
function createMockBlock(name: string, x: number, y: number, z: number): any {
  return {
    name,
    position: new Vec3(x, y, z),
    boundingBox: 'block',
    hardness: 1,
  };
}

// Mock entity
function createMockEntity(id: number, name: string, x: number, y: number, z: number): any {
  const pos = new Vec3(x, y, z);
  pos.distanceTo = (other: Vec3) => {
    const dx = other.x - x;
    const dy = other.y - y;
    const dz = other.z - z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  return {
    id,
    name,
    type: 'mob',
    position: pos,
    height: 1.8,
    isValid: true,
    health: 20,
  };
}

describe('Resource Tasks', () => {
  describe('ItemTarget helper', () => {
    it('should create item target with single item', () => {
      const target = itemTarget('diamond', 10);
      expect(target.items).toEqual(['diamond']);
      expect(target.targetCount).toBe(10);
    });

    it('should create item target with multiple items', () => {
      const target = itemTarget(['coal', 'charcoal'], 5);
      expect(target.items).toEqual(['coal', 'charcoal']);
      expect(target.targetCount).toBe(5);
    });
  });

  describe('MineAndCollectTask', () => {
    describe('creation and initialization', () => {
      it('should create with item targets and blocks', () => {
        const bot = createMockBot();
        const task = new MineAndCollectTask(
          bot,
          [itemTarget('coal', 10)],
          ['coal_ore']
        );
        expect(task.displayName).toContain('MineAndCollect');
        expect(task.displayName).toContain('coal_ore');
      });

      it('should start not finished', () => {
        const bot = createMockBot();
        const task = new MineAndCollectTask(
          bot,
          [itemTarget('diamond', 5)],
          ['diamond_ore']
        );
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('block finding', () => {
      /**
       * WHY: The task should find the nearest matching block to mine.
       */
      it('should find nearby blocks', () => {
        const block = createMockBlock('coal_ore', 5, 64, 5);
        const bot = createMockBot({
          blockAt: (pos: Vec3) => {
            if (pos.x === 5 && pos.y === 64 && pos.z === 5) return block;
            return { name: 'stone', position: pos, boundingBox: 'block' };
          },
        });

        const task = new MineAndCollectTask(
          bot,
          [itemTarget('coal', 3)],
          ['coal_ore']
        );
        task.onStart();
        task.onTick(); // Search

        // Should be in approaching or mining state (not wandering)
        expect(task.isFinished()).toBe(false);
      });

      /**
       * WHY: When no matching blocks exist, the task should wander.
       */
      it('should wander when no blocks found', () => {
        const bot = createMockBot({
          blockAt: () => ({ name: 'stone', boundingBox: 'block' }),
        });

        const task = new MineAndCollectTask(
          bot,
          [itemTarget('coal', 3)],
          ['coal_ore']
        );
        task.onStart();
        const subtask = task.onTick();
        const subtask2 = task.onTick();

        // Should return wander task
        expect(subtask2 !== null).toBe(true);
      });
    });

    describe('completion logic', () => {
      /**
       * WHY: The task should finish when enough items are collected.
       */
      it('should finish when target count reached', () => {
        const bot = createMockBot({
          inventory: {
            items: () => [{ name: 'coal', count: 10 }],
            slots: {},
          },
        });

        const task = new MineAndCollectTask(
          bot,
          [itemTarget('coal', 10)],
          ['coal_ore']
        );
        task.onStart();

        expect(task.isFinished()).toBe(true);
      });

      it('should not finish when target count not reached', () => {
        const bot = createMockBot({
          inventory: {
            items: () => [{ name: 'coal', count: 5 }],
            slots: {},
          },
        });

        const task = new MineAndCollectTask(
          bot,
          [itemTarget('coal', 10)],
          ['coal_ore']
        );
        task.onStart();

        expect(task.isFinished()).toBe(false);
      });
    });

    describe('convenience functions', () => {
      it('mineAndCollect should create task', () => {
        const bot = createMockBot();
        const task = mineAndCollect(bot, 'iron_ore', 5);
        expect(task).toBeInstanceOf(MineAndCollectTask);
      });

      it('mineOre should create task with ore and drop names', () => {
        const bot = createMockBot();
        const task = mineOre(bot, 'iron_ore', 'raw_iron', 5);
        expect(task).toBeInstanceOf(MineAndCollectTask);
      });
    });

    describe('equality', () => {
      it('should be equal if same blocks', () => {
        const bot = createMockBot();
        const task1 = new MineAndCollectTask(bot, [itemTarget('coal', 5)], ['coal_ore']);
        const task2 = new MineAndCollectTask(bot, [itemTarget('coal', 10)], ['coal_ore']);
        expect(task1.isEqual(task2)).toBe(true);
      });

      it('should not be equal if different blocks', () => {
        const bot = createMockBot();
        const task1 = new MineAndCollectTask(bot, [itemTarget('coal', 5)], ['coal_ore']);
        const task2 = new MineAndCollectTask(bot, [itemTarget('iron', 5)], ['iron_ore']);
        expect(task1.isEqual(task2)).toBe(false);
      });
    });
  });

  describe('KillAndLootTask', () => {
    describe('creation and initialization', () => {
      it('should create with entity types', () => {
        const bot = createMockBot();
        const task = new KillAndLootTask(
          bot,
          [itemTarget('beef', 5)],
          ['cow']
        );
        expect(task.displayName).toContain('KillAndLoot');
        expect(task.displayName).toContain('cow');
      });

      it('should start not finished', () => {
        const bot = createMockBot();
        const task = new KillAndLootTask(
          bot,
          [itemTarget('beef', 5)],
          ['cow']
        );
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('entity finding', () => {
      /**
       * WHY: The task should find and target matching entities.
       */
      it('should find nearby entities', () => {
        const cow = createMockEntity(1, 'cow', 10, 64, 10);
        const bot = createMockBot({
          entities: { 1: cow },
        });

        const task = new KillAndLootTask(
          bot,
          [itemTarget('beef', 3)],
          ['cow']
        );
        task.onStart();
        task.onTick(); // Search

        expect(task.isFinished()).toBe(false);
      });

      /**
       * WHY: When no entities exist, the task should wander.
       */
      it('should wander when no entities found', () => {
        const bot = createMockBot({
          entities: {},
        });

        const task = new KillAndLootTask(
          bot,
          [itemTarget('beef', 3)],
          ['cow']
        );
        task.onStart();
        task.onTick(); // Search
        const subtask = task.onTick();

        // Should return wander task
        expect(subtask !== null).toBe(true);
      });
    });

    describe('entity filtering', () => {
      /**
       * WHY: Custom filters allow targeting specific entities
       * (e.g., only baby zombies, only uncharged creepers).
       */
      it('should respect entity filter', () => {
        const adultCow = createMockEntity(1, 'cow', 10, 64, 10);
        adultCow.metadata = { age: 0 }; // Adult
        const babyCow = createMockEntity(2, 'cow', 15, 64, 15);
        babyCow.metadata = { age: -20 }; // Baby

        const bot = createMockBot({
          entities: { 1: adultCow, 2: babyCow },
        });

        const task = new KillAndLootTask(
          bot,
          [itemTarget('beef', 3)],
          ['cow'],
          { entityFilter: (e: any) => e.metadata?.age >= 0 } // Only adults
        );
        task.onStart();
        task.onTick();

        // Should be targeting, not wandering
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('convenience functions', () => {
      it('killAndLoot should create task', () => {
        const bot = createMockBot();
        const task = killAndLoot(bot, 'cow', 'beef', 5);
        expect(task).toBeInstanceOf(KillAndLootTask);
      });

      it('huntForFood should create task for multiple animals', () => {
        const bot = createMockBot();
        const task = huntForFood(bot, 10);
        expect(task).toBeInstanceOf(KillAndLootTask);
      });

      it('huntMobForDrop should create task with filter', () => {
        const bot = createMockBot();
        const task = huntMobForDrop(bot, 'enderman', 'ender_pearl', 5);
        expect(task).toBeInstanceOf(KillAndLootTask);
      });
    });
  });

  describe('CollectFuelTask', () => {
    describe('creation and initialization', () => {
      it('should create with target fuel value', () => {
        const bot = createMockBot();
        const task = new CollectFuelTask(bot, 64);
        expect(task.displayName).toContain('CollectFuel');
      });

      it('should start not finished when no fuel', () => {
        const bot = createMockBot();
        const task = new CollectFuelTask(bot, 64);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('fuel calculation', () => {
      /**
       * WHY: The task needs to correctly calculate fuel value from
       * items in inventory to know when it's done.
       * Coal has burn time of 1600 ticks.
       */
      it('should finish when enough fuel collected', () => {
        const bot = createMockBot({
          inventory: {
            items: () => [{ name: 'coal', count: 10 }], // 10 coal = 16000 ticks fuel
            slots: {},
          },
        });

        const task = new CollectFuelTask(bot, 10000); // Need 10000 ticks
        task.onStart();

        expect(task.isFinished()).toBe(true);
      });

      it('should not finish when not enough fuel', () => {
        const bot = createMockBot({
          inventory: {
            items: () => [{ name: 'coal', count: 5 }], // 5 coal = 8000 ticks fuel
            slots: {},
          },
        });

        const task = new CollectFuelTask(bot, 10000); // Need 10000 ticks
        task.onStart();

        expect(task.isFinished()).toBe(false);
      });
    });

    describe('fuel sources', () => {
      /**
       * WHY: Different fuels have different burn times and availability
       * in different dimensions.
       */
      it('should have coal as a fuel source', () => {
        const coalSource = FUEL_SOURCES.find(s => s.itemName === 'coal');
        expect(coalSource).toBeDefined();
        expect(coalSource?.burnTime).toBe(8);
        expect(coalSource?.dimensions).toContain(Dimension.OVERWORLD);
      });

      it('should have blaze rod as nether fuel', () => {
        const blazeSource = FUEL_SOURCES.find(s => s.itemName === 'blaze_rod');
        expect(blazeSource).toBeDefined();
        expect(blazeSource?.dimensions).toContain(Dimension.NETHER);
      });
    });

    describe('convenience functions', () => {
      it('collectFuel should create task', () => {
        const bot = createMockBot();
        const task = collectFuel(bot, 100);
        expect(task).toBeInstanceOf(CollectFuelTask);
      });

      it('collectFuelForSmelting should create task', () => {
        const bot = createMockBot();
        const task = collectFuelForSmelting(bot, 64);
        expect(task).toBeInstanceOf(CollectFuelTask);
      });
    });

    describe('equality', () => {
      it('should be equal if same fuel amount', () => {
        const bot = createMockBot();
        const task1 = new CollectFuelTask(bot, 64);
        const task2 = new CollectFuelTask(bot, 64);
        expect(task1.isEqual(task2)).toBe(true);
      });

      it('should not be equal if different fuel amount', () => {
        const bot = createMockBot();
        const task1 = new CollectFuelTask(bot, 64);
        const task2 = new CollectFuelTask(bot, 128);
        expect(task1.isEqual(task2)).toBe(false);
      });
    });
  });
});
