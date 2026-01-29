/**
 * Tests for GoInDirectionXZTask
 *
 * These tests verify that directional movement works correctly:
 * - WHY: Moving in a direction is fundamental to exploration and navigation.
 * - INTENT: Validate directional movement, distance tracking, and convenience functions.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  GoInDirectionXZTask,
  goInDirection,
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

describe('GoInDirectionXZTask', () => {
  describe('creation and initialization', () => {
    it('should create with direction', () => {
      const bot = createMockBot();
      const task = new GoInDirectionXZTask(
        bot,
        new Vec3(0, 64, 0),
        new Vec3(1, 0, 0)
      );
      expect(task.displayName).toContain('GoInDirection');
    });

    it('should normalize direction vector', () => {
      const bot = createMockBot();
      const task = new GoInDirectionXZTask(
        bot,
        new Vec3(0, 64, 0),
        new Vec3(100, 0, 100) // Should normalize to ~0.707, 0, ~0.707
      );
      expect(task.displayName).toContain('GoInDirection');
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new GoInDirectionXZTask(
        bot,
        new Vec3(0, 64, 0),
        new Vec3(1, 0, 0),
        100
      );
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('directional movement', () => {
    /**
     * WHY: The task should move the player along the specified
     * XZ direction until the target distance is reached.
     */
    it('should return navigation subtask', () => {
      const bot = createMockBot();
      const task = new GoInDirectionXZTask(
        bot,
        new Vec3(0, 64, 0),
        new Vec3(1, 0, 0),
        100
      );
      task.onStart();

      const subtask = task.onTick();
      expect(subtask).not.toBeNull();
    });

    /**
     * WHY: Movement should continue until target distance is reached.
     */
    it('should finish when distance traveled', () => {
      const bot = createMockBot();
      bot.entity.position = new Vec3(100, 64, 0); // Moved 100 blocks in X
      bot.entity.position.distanceTo = () => 100;

      const task = new GoInDirectionXZTask(
        bot,
        new Vec3(0, 64, 0),
        new Vec3(1, 0, 0),
        50 // Only need to travel 50
      );
      task.onStart();
      task.onTick(); // Update distance

      expect(task.isFinished()).toBe(true);
    });
  });

  describe('convenience function', () => {
    it('goInDirection should create task', () => {
      const bot = createMockBot();
      const task = goInDirection(bot, 1, 0, 50);
      expect(task).toBeInstanceOf(GoInDirectionXZTask);
    });
  });

  describe('equality', () => {
    it('should be equal if same origin and direction', () => {
      const bot = createMockBot();
      const task1 = new GoInDirectionXZTask(bot, new Vec3(0, 64, 0), new Vec3(1, 0, 0));
      const task2 = new GoInDirectionXZTask(bot, new Vec3(0, 64, 0), new Vec3(1, 0, 0));
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different direction', () => {
      const bot = createMockBot();
      const task1 = new GoInDirectionXZTask(bot, new Vec3(0, 64, 0), new Vec3(1, 0, 0));
      const task2 = new GoInDirectionXZTask(bot, new Vec3(0, 64, 0), new Vec3(0, 0, 1));
      expect(task1.isEqual(task2)).toBe(false);
    });
  });
});
