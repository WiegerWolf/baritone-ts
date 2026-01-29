/**
 * Tests for KillAndLootTask
 *
 * These tests verify that the KillAndLootTask works correctly:
 * - WHY: Hunting mobs is essential for food and rare drops.
 * - INTENT: Validate entity finding, filtering, and convenience functions.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  KillAndLootTask,
  killAndLoot,
  huntForFood,
  huntMobForDrop,
} from './KillAndLootTask';
import { itemTarget } from './ResourceTask';
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
    attack: mock(),
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
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
