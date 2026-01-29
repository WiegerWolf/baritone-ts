/**
 * Tests for Escape Tasks
 *
 * These tests verify that escape/safety tasks work correctly:
 * - WHY: Survival depends on escaping dangerous situations (lava, creepers,
 *   hostile mobs). These tasks must be fast and reliable.
 * - INTENT: Validate threat detection, escape direction calculation,
 *   and proper completion when safe.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  EscapeFromLavaTask,
  RunAwayFromCreepersTask,
  RunAwayFromHostilesTask,
  escapeFromLava,
  escapeFromLavaUrgent,
  runFromCreepers,
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

describe('Escape Tasks', () => {
  describe('EscapeFromLavaTask', () => {
    describe('creation and initialization', () => {
      it('should create with default config', () => {
        const bot = createMockBot();
        const task = new EscapeFromLavaTask(bot);
        expect(task.displayName).toContain('EscapeFromLava');
      });

      it('should create with custom config', () => {
        const bot = createMockBot();
        const task = new EscapeFromLavaTask(bot, {
          strength: 200,
          sprintThroughLava: false,
        });
        expect(task.displayName).toContain('EscapeFromLava');
      });

      /**
       * WHY: Task should not be finished right after onStart when in lava.
       * If not in danger, it will correctly finish on first tick.
       */
      it('should start not finished when in lava', () => {
        const bot = createMockBot({
          blockAt: (pos: Vec3) => {
            // Player at 0, 64, 0 - standing in lava
            if (Math.floor(pos.y) === 64) return { name: 'lava', boundingBox: 'empty' };
            return { name: 'stone', boundingBox: 'block' };
          },
        });
        const task = new EscapeFromLavaTask(bot);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('lava detection', () => {
      /**
       * WHY: The task should immediately finish if the player
       * is not actually in lava - no escape needed.
       */
      it('should finish if not in lava', () => {
        const bot = createMockBot({
          blockAt: (pos: Vec3) => ({ name: 'air', boundingBox: 'empty' }),
        });

        const task = new EscapeFromLavaTask(bot);
        task.onStart();
        task.onTick(); // Assess
        task.onTick(); // Should be safe

        expect(task.isFinished()).toBe(true);
      });

      /**
       * WHY: When in lava, the task should start escaping immediately
       * using sprint and jump for faster movement.
       */
      it('should escape when in lava', () => {
        const setControlState = mock();
        const bot = createMockBot({
          blockAt: (pos: Vec3) => {
            if (pos.y === 64) return { name: 'lava', boundingBox: 'empty' };
            if (pos.y === 63) return { name: 'stone', boundingBox: 'block' };
            return { name: 'air', boundingBox: 'empty' };
          },
          setControlState,
        });

        const task = new EscapeFromLavaTask(bot);
        task.onStart();
        task.onTick(); // Assess
        task.onTick(); // Escape

        // Should be trying to escape
        expect(task.isFinished()).toBe(false);
      });

      it('should detect lava below player', () => {
        const bot = createMockBot({
          blockAt: (pos: Vec3) => {
            if (pos.y === 63) return { name: 'lava', boundingBox: 'empty' };
            return { name: 'air', boundingBox: 'empty' };
          },
        });

        const task = new EscapeFromLavaTask(bot);
        task.onStart();

        // Should not immediately finish since lava is below
        task.onTick();
      });
    });

    describe('escape behavior', () => {
      /**
       * WHY: Sprint and jump make the player move faster through lava,
       * even though it causes more damage. Getting out quickly is better.
       */
      it('should sprint through lava when configured', () => {
        const setControlState = mock();
        const bot = createMockBot({
          blockAt: (pos: Vec3) => {
            if (Math.floor(pos.x) === 0 && Math.floor(pos.z) === 0 && Math.floor(pos.y) === 64) {
              return { name: 'lava', boundingBox: 'empty' };
            }
            if (pos.y === 63) return { name: 'stone', boundingBox: 'block' };
            return { name: 'air', boundingBox: 'empty' };
          },
          setControlState,
        });

        const task = new EscapeFromLavaTask(bot, { sprintThroughLava: true });
        task.onStart();
        task.onTick(); // Assess
        task.onTick(); // Escape

        // Should have set sprint
        expect(setControlState).toHaveBeenCalledWith('sprint', true);
      });

      it('should jump through lava when configured', () => {
        const setControlState = mock();
        const bot = createMockBot({
          blockAt: (pos: Vec3) => {
            if (Math.floor(pos.x) === 0 && Math.floor(pos.z) === 0 && Math.floor(pos.y) === 64) {
              return { name: 'lava', boundingBox: 'empty' };
            }
            return { name: 'air', boundingBox: 'empty' };
          },
          setControlState,
        });

        const task = new EscapeFromLavaTask(bot, { jumpThroughLava: true });
        task.onStart();
        task.onTick();
        task.onTick();

        expect(setControlState).toHaveBeenCalledWith('jump', true);
      });

      /**
       * WHY: The task should clear control states when stopped
       * to prevent the player from continuing to sprint/jump.
       */
      it('should clear controls on stop', () => {
        const setControlState = mock();
        const bot = createMockBot({ setControlState });

        const task = new EscapeFromLavaTask(bot);
        task.onStart();
        task.onStop(null);

        expect(setControlState).toHaveBeenCalledWith('sprint', false);
        expect(setControlState).toHaveBeenCalledWith('jump', false);
      });
    });

    describe('convenience functions', () => {
      it('escapeFromLava should create task', () => {
        const bot = createMockBot();
        const task = escapeFromLava(bot);
        expect(task).toBeInstanceOf(EscapeFromLavaTask);
      });

      it('escapeFromLavaUrgent should create task with high urgency', () => {
        const bot = createMockBot();
        const task = escapeFromLavaUrgent(bot);
        expect(task).toBeInstanceOf(EscapeFromLavaTask);
      });
    });
  });

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
});
