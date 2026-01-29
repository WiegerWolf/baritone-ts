/**
 * Tests for EscapeFromLavaTask
 *
 * These tests verify that the lava escape task works correctly:
 * - WHY: Survival depends on escaping lava quickly.
 * - INTENT: Validate lava detection, escape behavior, and proper completion when safe.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  EscapeFromLavaTask,
  escapeFromLava,
  escapeFromLavaUrgent,
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
