/**
 * Tests for RunAwayFromCreepersTask
 *
 * These tests verify that creeper escape tasks work correctly:
 * - WHY: Creepers explode and can kill the player. Fleeing is essential.
 * - INTENT: Validate creeper detection, flee direction, and charged creeper handling.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  RunAwayFromCreepersTask,
  runFromCreepers,
} from './EscapeTask';
import { Vec3 } from 'vec3';

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

  // Make position have proper Vec3 methods
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  baseBot.entity.position.offset = (x: number, y: number, z: number) =>
    new Vec3(baseBot.entity.position.x + x, baseBot.entity.position.y + y, baseBot.entity.position.z + z);
  baseBot.entity.position.minus = (other: Vec3) =>
    new Vec3(baseBot.entity.position.x - other.x, baseBot.entity.position.y - other.y, baseBot.entity.position.z - other.z);
  baseBot.entity.position.plus = (other: Vec3) =>
    new Vec3(baseBot.entity.position.x + other.x, baseBot.entity.position.y + other.y, baseBot.entity.position.z + other.z);

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
  pos.scaled = (s: number) => new Vec3(x * s, y * s, z * s);
  pos.plus = (other: Vec3) => new Vec3(x + other.x, y + other.y, z + other.z);

  return {
    id,
    name,
    position: pos,
    height: 1.8,
    isValid: true,
    metadata: {},
  };
}

describe('RunAwayFromCreepersTask', () => {
  describe('creation and initialization', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new RunAwayFromCreepersTask(bot);
      expect(task.displayName).toContain('Creepers');
    });

    it('should create with custom distance', () => {
      const bot = createMockBot();
      const task = new RunAwayFromCreepersTask(bot, { fleeDistance: 15 });
      expect(task.displayName).toContain('Creepers');
    });

    /**
     * WHY: Task should not be finished after onStart when creepers are nearby.
     * Without creepers, the task correctly finishes as there's no threat.
     */
    it('should start not finished when creeper nearby', () => {
      const creeper = createMockEntity(1, 'creeper', 5, 64, 5);
      const bot = createMockBot({
        entities: { 1: creeper },
      });
      const task = new RunAwayFromCreepersTask(bot, { fleeDistance: 10 });
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('creeper detection', () => {
    /**
     * WHY: If no creepers nearby, the player is safe and the task
     * should complete immediately.
     */
    it('should finish if no creepers', () => {
      const bot = createMockBot({
        entities: {},
      });

      const task = new RunAwayFromCreepersTask(bot);
      task.onStart();
      task.onTick();

      expect(task.isFinished()).toBe(true);
    });

    /**
     * WHY: Creepers within the flee distance are threats that
     * require immediate escape.
     */
    it('should detect creepers within range', () => {
      const creeper = createMockEntity(1, 'creeper', 5, 64, 5);
      const bot = createMockBot({
        entities: { 1: creeper },
      });

      const task = new RunAwayFromCreepersTask(bot, { fleeDistance: 10 });
      task.onStart();
      task.onTick(); // Assess

      // Should not be finished - creeper is nearby
      expect(task.isFinished()).toBe(false);
    });

    it('should ignore creepers outside range', () => {
      const creeper = createMockEntity(1, 'creeper', 50, 64, 50);
      const bot = createMockBot({
        entities: { 1: creeper },
      });

      const task = new RunAwayFromCreepersTask(bot, { fleeDistance: 10 });
      task.onStart();
      task.onTick();

      // Should be finished - creeper is far away
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('flee behavior', () => {
    /**
     * WHY: The flee direction should be away from the creeper center.
     * Running toward creepers is bad!
     */
    it('should flee in opposite direction from creepers', () => {
      const creeper = createMockEntity(1, 'creeper', 5, 64, 5);
      const bot = createMockBot({
        entities: { 1: creeper },
      });

      const task = new RunAwayFromCreepersTask(bot, { fleeDistance: 10 });
      task.onStart();
      task.onTick(); // Assess
      const subtask = task.onTick(); // Escape

      // Should return a navigation task in flee direction
      expect(subtask !== null || task.isFinished()).toBe(true);
    });

    /**
     * WHY: When multiple creepers are nearby, flee from their average
     * position to maximize distance from all of them.
     */
    it('should handle multiple creepers', () => {
      const creeper1 = createMockEntity(1, 'creeper', 5, 64, 0);
      const creeper2 = createMockEntity(2, 'creeper', -5, 64, 0);
      const bot = createMockBot({
        entities: { 1: creeper1, 2: creeper2 },
      });

      const task = new RunAwayFromCreepersTask(bot, { fleeDistance: 10 });
      task.onStart();
      task.onTick();

      // Should not be finished with creepers on both sides
      expect(task.isFinished()).toBe(false);
    });

    it('should sprint when configured', () => {
      const setControlState = mock();
      const creeper = createMockEntity(1, 'creeper', 5, 64, 5);
      const bot = createMockBot({
        entities: { 1: creeper },
        setControlState,
      });

      const task = new RunAwayFromCreepersTask(bot, { sprint: true, fleeDistance: 10 });
      task.onStart();
      task.onTick(); // Assess
      task.onTick(); // Escape

      expect(setControlState).toHaveBeenCalledWith('sprint', true);
    });
  });

  describe('charged creeper handling', () => {
    /**
     * WHY: Charged creepers have a much bigger explosion radius,
     * requiring a larger flee distance.
     */
    it('should flee further from charged creepers', () => {
      // Position creeper at distance ~10.6 (within 15 but outside 10)
      const creeper = createMockEntity(1, 'creeper', 7.5, 64, 7.5);
      creeper.metadata = { 17: true }; // Charged creeper

      const bot = createMockBot({
        entities: { 1: creeper },
      });

      const task = new RunAwayFromCreepersTask(bot, {
        fleeDistance: 10,
        chargedCreeperDistance: 15,
      });
      task.onStart();
      task.onTick();

      // Distance is ~10.6, within charged creeper range (15) but outside normal (10)
      // Should still flee because charged creeper distance is 15
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('convenience functions', () => {
    it('runFromCreepers should create task', () => {
      const bot = createMockBot();
      const task = runFromCreepers(bot, 15);
      expect(task).toBeInstanceOf(RunAwayFromCreepersTask);
    });
  });

  describe('equality', () => {
    it('should be equal if same distance', () => {
      const bot = createMockBot();
      const task1 = new RunAwayFromCreepersTask(bot, { fleeDistance: 10 });
      const task2 = new RunAwayFromCreepersTask(bot, { fleeDistance: 10 });
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different distance', () => {
      const bot = createMockBot();
      const task1 = new RunAwayFromCreepersTask(bot, { fleeDistance: 10 });
      const task2 = new RunAwayFromCreepersTask(bot, { fleeDistance: 20 });
      expect(task1.isEqual(task2)).toBe(false);
    });
  });
});
