/**
 * Tests for CollectFuelTask
 *
 * These tests verify that the CollectFuelTask works correctly:
 * - WHY: Fuel gathering enables smelting for Minecraft progression.
 * - INTENT: Validate fuel calculation, fuel sources, and convenience functions.
 */

import {
  CollectFuelTask,
  collectFuel,
  collectFuelForSmelting,
  FUEL_SOURCES,
} from './CollectFuelTask';
import { Dimension } from './ResourceTask';
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
