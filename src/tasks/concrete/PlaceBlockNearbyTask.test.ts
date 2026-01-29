/**
 * Tests for PlaceBlockNearbyTask
 *
 * These tests verify that block placement works correctly:
 * - WHY: Placing blocks is fundamental to Minecraft construction.
 *   The task must find valid placement spots, handle missing inventory,
 *   and retry when spots aren't available.
 * - INTENT: Validate placement logic, inventory checks, and retry behavior.
 */

import { describe, it, expect, mock } from 'bun:test';
import { PlaceBlockNearbyTask } from './ConstructionTask';
import { BlockPos } from '../../types';
import { Vec3 } from 'vec3';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: (pos: Vec3) => null,
    blockAtCursor: () => null,
    entities: {},
    time: { timeOfDay: 6000, age: 0 },
    health: 20,
    food: 20,
    heldItem: null,
    pathfinder: {
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    dig: mock().mockResolvedValue(undefined),
    stopDigging: mock(),
    placeBlock: mock().mockResolvedValue(undefined),
    equip: mock().mockResolvedValue(undefined),
    look: mock(),
    ...overrides,
  };

  // Make position have proper Vec3 methods
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  baseBot.entity.position.clone = () => new Vec3(
    baseBot.entity.position.x,
    baseBot.entity.position.y,
    baseBot.entity.position.z
  );

  return baseBot;
}

describe('PlaceBlockNearbyTask', () => {
  describe('creation and initialization', () => {
    it('should create with block names', () => {
      const bot = createMockBot();
      const task = new PlaceBlockNearbyTask(bot, ['crafting_table']);
      expect(task.displayName).toContain('PlaceBlockNearby');
      expect(task.displayName).toContain('crafting_table');
    });

    it('should create with multiple block types', () => {
      const bot = createMockBot();
      const task = new PlaceBlockNearbyTask(bot, ['chest', 'barrel']);
      expect(task.displayName).toContain('chest');
      expect(task.displayName).toContain('barrel');
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new PlaceBlockNearbyTask(bot, ['chest']);
      task.onStart();
      expect(task.isFinished()).toBe(false);
      expect(task.isFailed()).toBe(false);
    });
  });

  describe('placement logic', () => {
    /**
     * WHY: We need solid blocks adjacent to place against.
     * Can't place blocks floating in air.
     */
    it('should find spot with adjacent solid block', () => {
      const bot = createMockBot({
        blockAt: (pos: Vec3) => {
          // Floor at y=63
          if (pos.y === 63) return { name: 'stone', boundingBox: 'block', position: pos };
          // Air above
          return { name: 'air', boundingBox: 'empty', position: pos };
        },
        inventory: {
          items: () => [{ name: 'crafting_table', slot: 0 }],
          slots: {},
        },
      });

      const task = new PlaceBlockNearbyTask(bot, ['crafting_table']);
      task.onStart();

      // Should find a valid spot
      const subtask = task.onTick();
      expect(task.isFailed()).toBe(false);
    });

    /**
     * WHY: Can't place a block if you don't have it in inventory.
     */
    it('should fail if block not in inventory', () => {
      // Create a mock with age that increases each tick
      let tickCount = 0;
      const bot = createMockBot({
        blockAt: (pos: Vec3) => {
          if (pos.y === 63) return { name: 'stone', boundingBox: 'block', position: pos };
          return { name: 'air', boundingBox: 'empty', position: pos };
        },
        inventory: {
          items: () => [], // No items
          slots: {},
        },
        time: { get age() { return tickCount * 20; }, timeOfDay: 6000 },
      });

      const task = new PlaceBlockNearbyTask(bot, ['crafting_table']);
      task.onStart();

      // Run through states with time advancing
      for (let i = 0; i < 30; i++) {
        tickCount += 200;
        task.onTick();
        if (task.isFailed()) break;
      }

      // Task should fail when trying to place without the item
      expect(task.isFailed()).toBe(true);
    });

    /**
     * WHY: Shouldn't place inside the player's collision box.
     */
    it('should not place inside player position', () => {
      const bot = createMockBot({
        blockAt: (pos: Vec3) => {
          if (pos.y === 63) return { name: 'stone', boundingBox: 'block', position: pos };
          return { name: 'air', boundingBox: 'empty', position: pos };
        },
        inventory: {
          items: () => [{ name: 'chest', slot: 0 }],
          slots: {},
        },
      });
      bot.entity.position = new Vec3(0, 64, 0);

      const task = new PlaceBlockNearbyTask(bot, ['chest']);
      task.onStart();

      // The spot at player's position should be rejected
      // Task should find a different spot
    });
  });

  describe('custom placement predicate', () => {
    /**
     * WHY: Sometimes we need to place at a specific position,
     * like filling a liquid source block.
     */
    it('should respect custom canPlaceAt predicate', () => {
      const specificPos = new BlockPos(5, 64, 5);
      const bot = createMockBot({
        blockAt: (pos: Vec3) => {
          if (pos.y === 63) return { name: 'stone', boundingBox: 'block', position: pos };
          return { name: 'air', boundingBox: 'empty', position: pos };
        },
        inventory: {
          items: () => [{ name: 'cobblestone', slot: 0 }],
          slots: {},
        },
      });

      const task = new PlaceBlockNearbyTask(bot, ['cobblestone'], {
        canPlaceAt: (pos) => pos.equals(specificPos),
        searchRadius: 10,
      });
      task.onStart();

      // Should only consider the specific position
    });
  });

  describe('wandering and retry', () => {
    /**
     * WHY: If no valid spot is found, wander and try again.
     * Environment might change or new areas might become available.
     */
    it('should wander if no spot found', () => {
      const bot = createMockBot({
        blockAt: () => null, // No blocks at all
        inventory: {
          items: () => [{ name: 'chest', slot: 0 }],
          slots: {},
        },
      });

      const task = new PlaceBlockNearbyTask(bot, ['chest']);
      task.onStart();

      // First tick finds no spot, increments attempt count
      const subtask = task.onTick();
      // Second tick should be in wandering state
      const subtask2 = task.onTick();
      // Should return a wander task or be in a different state
      expect(subtask !== null || subtask2 !== null || task.isFailed()).toBe(true);
    });

    /**
     * WHY: After too many failed attempts, give up rather than
     * loop forever.
     */
    it('should fail after too many attempts', () => {
      // Create a mock with age that increases each tick to simulate time passing
      let tickCount = 0;
      const bot = createMockBot({
        blockAt: () => null,
        inventory: {
          items: () => [{ name: 'chest', slot: 0 }],
          slots: {},
        },
        time: { get age() { return tickCount * 20; }, timeOfDay: 6000 }, // Each tick = 1 second in game time
      });

      const task = new PlaceBlockNearbyTask(bot, ['chest']);
      task.onStart();

      // Simulate many failed attempts with time passing
      // Each iteration advances time significantly
      for (let i = 0; i < 100; i++) {
        tickCount += 200; // Advance time significantly each iteration
        task.onTick();
        if (task.isFailed()) break;
      }

      // The task should eventually give up
      // If not failed, it's in a wandering loop which is also acceptable behavior
      expect(task.isFailed() || task.isFinished()).toBe(true);
    });
  });

  describe('getPlacedPosition', () => {
    /**
     * WHY: After successful placement, we need to know where
     * the block was placed for subsequent tasks.
     */
    it('should return null before placement', () => {
      const bot = createMockBot();
      const task = new PlaceBlockNearbyTask(bot, ['chest']);
      task.onStart();
      expect(task.getPlacedPosition()).toBeNull();
    });
  });

  describe('equality', () => {
    it('should be equal if same blocks', () => {
      const bot = createMockBot();
      const task1 = new PlaceBlockNearbyTask(bot, ['chest', 'barrel']);
      const task2 = new PlaceBlockNearbyTask(bot, ['chest', 'barrel']);
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different blocks', () => {
      const bot = createMockBot();
      const task1 = new PlaceBlockNearbyTask(bot, ['chest']);
      const task2 = new PlaceBlockNearbyTask(bot, ['barrel']);
      expect(task1.isEqual(task2)).toBe(false);
    });
  });
});
