/**
 * ConstructNetherPortalTask Tests
 *
 * WHY this task matters:
 * ConstructNetherPortalTask - Automates portal construction:
 *    - Finds lava lake for bucket method
 *    - Casts obsidian frame using water + lava
 *    - Clears interior and lights portal
 *    Essential for dimension travel.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';

import {
  ConstructNetherPortalTask,
  PortalConstructionState,
  constructPortalAt,
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
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
    ...overrides,
  };

  return baseBot;
}

// Mock item for testing
function createMockItem(name: string, count: number): any {
  return { name, count };
}

describe('ConstructNetherPortalTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('ConstructNetherPortalTask creation', () => {
    /**
     * WHY: Portal construction can be at a specific position or auto-located
     * near a lava lake for the bucket method.
     */
    it('should create task with auto-locate', () => {
      const task = new ConstructNetherPortalTask(bot);
      expect(task.displayName).toContain('ConstructNetherPortal');
      expect(task.displayName).toContain('searching');
    });

    it('should create task at specific position', () => {
      const task = ConstructNetherPortalTask.at(bot, 100, 64, 200);
      task.onStart(); // Initialize portal origin
      expect(task.displayName).toContain('100');
      expect(task.displayName).toContain('64');
      expect(task.displayName).toContain('200');
    });

    it('should create task via autoLocate factory', () => {
      const task = ConstructNetherPortalTask.autoLocate(bot);
      expect(task).toBeInstanceOf(ConstructNetherPortalTask);
      expect(task.getPortalOrigin()).toBeNull();
    });
  });

  describe('ConstructNetherPortalTask materials', () => {
    /**
     * WHY: Portal construction needs:
     * - 2 buckets (water + lava or both water/lava)
     * - Flint and steel or fire charge to light
     */
    it('should start in GETTING_MATERIALS state', () => {
      const task = new ConstructNetherPortalTask(bot);
      task.onStart();
      expect(task.getState()).toBe(PortalConstructionState.GETTING_MATERIALS);
    });

    it('should recognize when we have materials', () => {
      (bot.inventory as any).items = () => [
        createMockItem('water_bucket', 1),
        createMockItem('lava_bucket', 1),
        createMockItem('flint_and_steel', 1),
      ];

      const task = new ConstructNetherPortalTask(bot);
      task.onStart();
      const subtask = task.onTick();
      // Should move past GETTING_MATERIALS to SEARCHING_LOCATION
      expect(task.getState()).not.toBe(PortalConstructionState.GETTING_MATERIALS);
    });

    it('should accept fire charge as igniter', () => {
      (bot.inventory as any).items = () => [
        createMockItem('bucket', 2),
        createMockItem('fire_charge', 1),
      ];

      const task = new ConstructNetherPortalTask(bot);
      task.onStart();
      const subtask = task.onTick();
      expect(task.getState()).not.toBe(PortalConstructionState.GETTING_MATERIALS);
    });
  });

  describe('ConstructNetherPortalTask completion', () => {
    /**
     * WHY: Portal is complete when nether_portal block exists.
     * This happens after successful ignition of the obsidian frame.
     */
    it('should not be finished initially', () => {
      const task = new ConstructNetherPortalTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should be finished when portal block exists', () => {
      const portalOrigin = new BlockPos(100, 64, 200);
      (bot.blockAt as any) = (pos: Vec3) => {
        // Portal block is at origin + (0, 1, 0)
        if (pos.x === 100 && pos.y === 65 && pos.z === 200) {
          return { name: 'nether_portal' };
        }
        return null;
      };

      const task = ConstructNetherPortalTask.at(bot, 100, 64, 200);
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('ConstructNetherPortalTask equality', () => {
    it('should be equal if same position', () => {
      const task1 = ConstructNetherPortalTask.at(bot, 100, 64, 200);
      const task2 = ConstructNetherPortalTask.at(bot, 100, 64, 200);
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different position', () => {
      const task1 = ConstructNetherPortalTask.at(bot, 100, 64, 200);
      const task2 = ConstructNetherPortalTask.at(bot, 200, 64, 300);
      expect(task1.isEqual(task2)).toBe(false);
    });

    it('should be equal if both auto-locate', () => {
      const task1 = ConstructNetherPortalTask.autoLocate(bot);
      const task2 = ConstructNetherPortalTask.autoLocate(bot);
      expect(task1.isEqual(task2)).toBe(true);
    });
  });

  describe('Convenience functions', () => {
    it('constructPortalAt should create positioned task', () => {
      const task = constructPortalAt(bot, 100, 64, 200);
      expect(task).toBeInstanceOf(ConstructNetherPortalTask);
      task.onStart(); // Initialize the portal origin
      expect(task.getPortalOrigin()?.x).toBe(100);
    });

    it('constructPortal should create auto-locate task', () => {
      const task = constructPortal(bot);
      expect(task).toBeInstanceOf(ConstructNetherPortalTask);
      expect(task.getPortalOrigin()).toBeNull();
    });
  });
});
