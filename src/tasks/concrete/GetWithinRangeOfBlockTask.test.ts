/**
 * Tests for GetWithinRangeOfBlockTask
 *
 * These tests verify that range-based block approach logic works correctly:
 * - WHY: Getting within range of a block is fundamental to interaction and navigation.
 * - INTENT: Validate range checking, navigation subtask creation, and convenience functions.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  GetWithinRangeOfBlockTask,
  getWithinRangeOf,
} from './BlockSearchTask';
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

describe('GetWithinRangeOfBlockTask', () => {
  describe('creation and initialization', () => {
    it('should create with position and range', () => {
      const bot = createMockBot();
      const task = new GetWithinRangeOfBlockTask(bot, 10, 64, 10, 5);
      expect(task.displayName).toContain('GetWithinRange');
      expect(task.displayName).toContain('10');
      expect(task.displayName).toContain('r=5');
    });

    it('should start not finished when far', () => {
      const bot = createMockBot();
      const task = new GetWithinRangeOfBlockTask(bot, 100, 64, 100, 5);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('range checking', () => {
    /**
     * WHY: The task should finish when the player is within
     * the specified range of the target position.
     */
    it('should finish when within range', () => {
      const bot = createMockBot();
      bot.entity.position = new Vec3(10, 64, 12); // 2 blocks from target
      bot.entity.position.distanceTo = (other: Vec3) => {
        const dx = other.x - bot.entity.position.x;
        const dy = other.y - bot.entity.position.y;
        const dz = other.z - bot.entity.position.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      };

      const task = new GetWithinRangeOfBlockTask(bot, 10, 64, 10, 5);
      task.onStart();

      expect(task.isFinished()).toBe(true);
    });

    /**
     * WHY: The task should NOT finish when outside the range.
     */
    it('should not finish when outside range', () => {
      const bot = createMockBot(); // At 0, 64, 0

      const task = new GetWithinRangeOfBlockTask(bot, 100, 64, 100, 5);
      task.onStart();

      expect(task.isFinished()).toBe(false);
    });

    it('should return navigation task when not in range', () => {
      const bot = createMockBot();
      const task = new GetWithinRangeOfBlockTask(bot, 50, 64, 50, 5);
      task.onStart();

      const subtask = task.onTick();
      expect(subtask).not.toBeNull();
    });
  });

  describe('convenience function', () => {
    it('getWithinRangeOf should create task', () => {
      const bot = createMockBot();
      const task = getWithinRangeOf(bot, 10, 64, 10, 5);
      expect(task).toBeInstanceOf(GetWithinRangeOfBlockTask);
    });
  });

  describe('equality', () => {
    it('should be equal if same position and range', () => {
      const bot = createMockBot();
      const task1 = new GetWithinRangeOfBlockTask(bot, 10, 64, 10, 5);
      const task2 = new GetWithinRangeOfBlockTask(bot, 10, 64, 10, 5);
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different position', () => {
      const bot = createMockBot();
      const task1 = new GetWithinRangeOfBlockTask(bot, 10, 64, 10, 5);
      const task2 = new GetWithinRangeOfBlockTask(bot, 20, 64, 20, 5);
      expect(task1.isEqual(task2)).toBe(false);
    });

    it('should not be equal if different range', () => {
      const bot = createMockBot();
      const task1 = new GetWithinRangeOfBlockTask(bot, 10, 64, 10, 5);
      const task2 = new GetWithinRangeOfBlockTask(bot, 10, 64, 10, 10);
      expect(task1.isEqual(task2)).toBe(false);
    });
  });
});
