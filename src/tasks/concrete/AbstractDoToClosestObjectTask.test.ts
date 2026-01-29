/**
 * Tests for AbstractDoToClosestObjectTask
 *
 * WHY this task matters:
 * - AbstractDoToClosestObjectTask: Find and interact with the closest matching object
 * - DoToClosestObjectTask: Concrete implementation using configuration callbacks
 *
 * This provides a reusable pattern for tasks that need to find and act on nearby objects.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import {
  DoToClosestObjectTask,
  doToClosestObject,
  DoToClosestObjectConfig,
} from './AbstractDoToClosestObjectTask';
import { Task } from '../Task';

// Mock Bot
function createMockBot(): Bot {
  const mockBot = {
    entity: {
      position: new Vec3(0, 65, 0),
      velocity: new Vec3(0, 0, 0),
      onGround: true,
      yaw: 0,
    },
    inventory: {
      items: mock().mockReturnValue([]),
      slots: {},
    },
    blockAt: mock().mockReturnValue({ name: 'air' }),
    entities: {},
    game: {
      dimension: 'minecraft:overworld',
    },
    look: mock(),
    lookAt: mock(),
    attack: mock(),
    equip: mock(),
    activateItem: mock(),
    on: mock(),
    removeListener: mock(),
    once: mock(),
    emit: mock(),
  } as unknown as Bot;

  return mockBot;
}

// Test objects with positions
interface TestObject {
  id: number;
  pos: Vec3;
  valid: boolean;
}

// Simple mock task for testing
class MockGoalTask extends Task {
  constructor(bot: Bot, public readonly targetId: number) {
    super(bot);
  }
  get displayName() { return `MockGoal(${this.targetId})`; }
  onTick() { return null; }
  isFinished() { return false; }
  isEqual(other: any) { return other?.targetId === this.targetId; }
}

describe('AbstractDoToClosestObjectTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('DoToClosestObjectTask', () => {
    it('WHY: Creates task with configuration', () => {
      const objects: TestObject[] = [
        { id: 1, pos: new Vec3(10, 65, 10), valid: true },
      ];

      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: (pos) => {
          if (objects.length === 0) return null;
          return objects.reduce((closest, obj) =>
            obj.pos.distanceTo(pos) < closest.pos.distanceTo(pos) ? obj : closest
          );
        },
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: (obj) => obj.valid,
      };

      const task = new DoToClosestObjectTask(bot, config);
      expect(task.displayName).toBe('DoToClosestObject');
    });

    it('WHY: Starts without a target', () => {
      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => null,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();

      expect(task.getCurrentTarget()).toBeNull();
    });

    it('WHY: Finds closest object on tick', () => {
      const objects: TestObject[] = [
        { id: 1, pos: new Vec3(10, 65, 10), valid: true },
        { id: 2, pos: new Vec3(50, 65, 50), valid: true },
      ];

      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: (pos) => {
          if (objects.length === 0) return null;
          return objects.reduce((closest, obj) =>
            obj.pos.distanceTo(pos) < closest.pos.distanceTo(pos) ? obj : closest
          );
        },
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: (obj) => obj.valid,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();
      task.onTick();

      // Should select the closest object (id=1)
      expect(task.getCurrentTarget()?.id).toBe(1);
    });

    it('WHY: Wanders when no objects found', () => {
      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => null,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();
      const subtask = task.onTick();

      expect(task.wasWandering()).toBe(true);
      expect(subtask).not.toBeNull();
    });

    it('WHY: Invalidates target when no longer valid', () => {
      const objects: TestObject[] = [
        { id: 1, pos: new Vec3(10, 65, 10), valid: true },
      ];

      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        // Return null when object is invalid (simulating it being removed/destroyed)
        getClosestTo: () => objects[0]?.valid ? objects[0] : null,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: (obj) => obj.valid,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();
      task.onTick();

      expect(task.getCurrentTarget()?.id).toBe(1);

      // Invalidate the object
      objects[0].valid = false;
      task.onTick();

      // Target should be cleared (invalidated at start of tick)
      expect(task.getCurrentTarget()).toBeNull();
    });

    it('WHY: resetSearch clears target and heuristics', () => {
      const objects: TestObject[] = [
        { id: 1, pos: new Vec3(10, 65, 10), valid: true },
      ];

      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => objects[0],
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();
      task.onTick();

      expect(task.getCurrentTarget()).not.toBeNull();

      task.resetSearch();

      expect(task.getCurrentTarget()).toBeNull();
    });
  });

  describe('doToClosestObject convenience function', () => {
    it('WHY: Creates DoToClosestObjectTask with config', () => {
      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => null,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = doToClosestObject(bot, config);
      expect(task).toBeInstanceOf(DoToClosestObjectTask);
    });
  });

  describe('Heuristic Caching', () => {
    it('WHY: Caches target heuristics for better switching decisions', () => {
      const objects: TestObject[] = [
        { id: 1, pos: new Vec3(10, 65, 10), valid: true },
        { id: 2, pos: new Vec3(15, 65, 15), valid: true },
      ];

      let currentClosest = objects[0];

      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => currentClosest,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();

      // First tick - select object 1
      task.onTick();
      expect(task.getCurrentTarget()?.id).toBe(1);

      // Change closest to object 2
      currentClosest = objects[1];

      // Next tick - should consider switching
      task.onTick();

      // Since object 2 has no cached heuristic, should try it
      expect(task.getCurrentTarget()?.id).toBe(2);
    });

    it('WHY: Continues tasks that never finish by design', () => {
      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => null,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = new DoToClosestObjectTask(bot, config);
      expect(task.isFinished()).toBe(false);
    });
  });
});
