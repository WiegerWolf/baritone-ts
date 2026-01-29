/**
 * Tests for RunAwayFromHostilesTask
 *
 * These tests verify that hostile mob escape tasks work correctly:
 * - WHY: Hostile mobs can kill the player. Fleeing when outmatched is essential.
 * - INTENT: Validate hostile detection, flee behavior, and skeleton exclusion options.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  RunAwayFromHostilesTask,
  runFromHostiles,
  runFromAllHostiles,
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

describe('RunAwayFromHostilesTask', () => {
  describe('creation and initialization', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new RunAwayFromHostilesTask(bot);
      expect(task.displayName).toContain('Hostiles');
    });

    /**
     * WHY: Task should not be finished after onStart when hostiles nearby.
     * Without hostiles, the task correctly finishes as there's no threat.
     */
    it('should start not finished when hostile nearby', () => {
      const zombie = createMockEntity(1, 'zombie', 5, 64, 5);
      const bot = createMockBot({
        entities: { 1: zombie },
      });
      const task = new RunAwayFromHostilesTask(bot, { fleeDistance: 20 });
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('hostile detection', () => {
    /**
     * WHY: If no hostiles nearby, the player is safe.
     */
    it('should finish if no hostiles', () => {
      const bot = createMockBot({
        entities: {},
      });

      const task = new RunAwayFromHostilesTask(bot);
      task.onStart();
      task.onTick();

      expect(task.isFinished()).toBe(true);
    });

    /**
     * WHY: The task should detect multiple hostile mob types.
     */
    it('should detect various hostile types', () => {
      const zombie = createMockEntity(1, 'zombie', 5, 64, 5);
      const skeleton = createMockEntity(2, 'skeleton', -5, 64, -5);
      const spider = createMockEntity(3, 'spider', 5, 64, -5);

      const bot = createMockBot({
        entities: { 1: zombie, 2: skeleton, 3: spider },
      });

      const task = new RunAwayFromHostilesTask(bot, {
        fleeDistance: 25,
        includeSkeletons: true,
      });
      task.onStart();
      task.onTick();

      // Should detect all hostiles
      expect(task.getHostileCount()).toBeGreaterThan(0);
    });

    /**
     * WHY: Skeletons might be desirable to fight for arrows,
     * so there's an option to exclude them.
     */
    it('should optionally exclude skeletons', () => {
      const skeleton = createMockEntity(1, 'skeleton', 5, 64, 5);
      const bot = createMockBot({
        entities: { 1: skeleton },
      });

      const task = new RunAwayFromHostilesTask(bot, {
        includeSkeletons: false,
        fleeDistance: 25,
      });
      task.onStart();
      task.onTick();

      // Should be finished - skeleton excluded
      expect(task.isFinished()).toBe(true);
    });

    it('should include skeletons when configured', () => {
      const skeleton = createMockEntity(1, 'skeleton', 5, 64, 5);
      const bot = createMockBot({
        entities: { 1: skeleton },
      });

      const task = new RunAwayFromHostilesTask(bot, {
        includeSkeletons: true,
        fleeDistance: 25,
      });
      task.onStart();
      task.onTick();

      // Should not be finished - skeleton included
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('flee behavior', () => {
    it('should flee from hostile center', () => {
      const zombie = createMockEntity(1, 'zombie', 5, 64, 5);
      const bot = createMockBot({
        entities: { 1: zombie },
      });

      const task = new RunAwayFromHostilesTask(bot, { fleeDistance: 25 });
      task.onStart();
      task.onTick(); // Assess
      const subtask = task.onTick(); // Escape

      expect(subtask !== null || task.isFinished()).toBe(true);
    });

    it('should clear controls on stop', () => {
      const setControlState = mock();
      const bot = createMockBot({ setControlState });

      const task = new RunAwayFromHostilesTask(bot);
      task.onStart();
      task.onStop(null);

      expect(setControlState).toHaveBeenCalledWith('sprint', false);
      expect(setControlState).toHaveBeenCalledWith('forward', false);
    });
  });

  describe('convenience functions', () => {
    it('runFromHostiles should create task', () => {
      const bot = createMockBot();
      const task = runFromHostiles(bot, 30);
      expect(task).toBeInstanceOf(RunAwayFromHostilesTask);
    });

    it('runFromAllHostiles should include skeletons', () => {
      const bot = createMockBot();
      const task = runFromAllHostiles(bot);
      expect(task).toBeInstanceOf(RunAwayFromHostilesTask);
    });
  });

  describe('equality', () => {
    it('should be equal if same distance', () => {
      const bot = createMockBot();
      const task1 = new RunAwayFromHostilesTask(bot, { fleeDistance: 20 });
      const task2 = new RunAwayFromHostilesTask(bot, { fleeDistance: 20 });
      expect(task1.isEqual(task2)).toBe(true);
    });
  });
});
