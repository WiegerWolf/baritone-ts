/**
 * Tests for Dodge Tasks
 *
 * These tests verify that dodge tasks work correctly:
 * - WHY: These tasks handle combat evasion mechanics.
 * - INTENT: Validate state machines, edge cases, and helper functions.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  DodgeProjectilesTask,
  dodgeProjectiles,
} from './DodgeProjectilesTask';
import {
  StrafeAndDodgeTask,
  strafeAndDodge,
} from './StrafeAndDodgeTask';
import { Vec3 } from 'vec3';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
      velocity: new Vec3(0, 0, 0),
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
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
    lookAt: mock(),
    equip: mock(),
    activateBlock: mock(),
    wake: mock(),
    isSleeping: false,
    ...overrides,
  };

  // Add Vec3 methods to position
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  baseBot.entity.position.floored = () => new Vec3(
    Math.floor(baseBot.entity.position.x),
    Math.floor(baseBot.entity.position.y),
    Math.floor(baseBot.entity.position.z)
  );
  baseBot.entity.position.minus = (other: Vec3) => new Vec3(
    baseBot.entity.position.x - other.x,
    baseBot.entity.position.y - other.y,
    baseBot.entity.position.z - other.z
  );

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
  pos.minus = (other: Vec3) => new Vec3(x - other.x, y - other.y, z - other.z);

  return {
    id,
    name,
    type: 'mob',
    position: pos,
    velocity: new Vec3(0, 0, 0),
    height: 1.8,
    isValid: true,
  };
}

describe('Dodge Tasks', () => {
  describe('DodgeProjectilesTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new DodgeProjectilesTask(bot);
      expect(task.displayName).toContain('DodgeProjectiles');
    });

    it('should create with custom distances', () => {
      const bot = createMockBot();
      const task = new DodgeProjectilesTask(bot, {
        dodgeDistanceH: 5,
        dodgeDistanceV: 2,
      });
      expect(task.displayName).toContain('5m');
    });

    /**
     * WHY: Task should finish when no projectiles detected.
     */
    it('should finish when no projectiles', () => {
      const bot = createMockBot({
        entities: {},
      });
      const task = new DodgeProjectilesTask(bot);
      task.onStart();
      task.onTick();
      expect(task.isFinished()).toBe(true);
    });

    /**
     * WHY: Task should detect incoming projectiles.
     */
    it('should detect arrow entities', () => {
      const arrow = createMockEntity(1, 'arrow', 10, 65, 0);
      arrow.velocity = new Vec3(-1, 0, 0); // Moving toward player

      const bot = createMockBot({
        entities: { 1: arrow },
      });
      const task = new DodgeProjectilesTask(bot);
      task.onStart();
      task.onTick();

      // Dodge initiated - should set control states
      expect(bot.clearControlStates).toHaveBeenCalled();
    });
  });

  describe('StrafeAndDodgeTask', () => {
    it('should create task', () => {
      const bot = createMockBot();
      const task = new StrafeAndDodgeTask(bot);
      expect(task.displayName).toBe('StrafeAndDodge');
    });

    it('should not finish (continuous task)', () => {
      const bot = createMockBot();
      const task = new StrafeAndDodgeTask(bot);
      task.onStart();
      task.onTick();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('helper functions', () => {
    it('dodgeProjectiles should create task', () => {
      const bot = createMockBot();
      const task = dodgeProjectiles(bot, 3, 1);
      expect(task).toBeInstanceOf(DodgeProjectilesTask);
    });

    it('strafeAndDodge should create task', () => {
      const bot = createMockBot();
      const task = strafeAndDodge(bot);
      expect(task).toBeInstanceOf(StrafeAndDodgeTask);
    });
  });
});

describe('Task equality', () => {
  it('dodge tasks should be equal if similar distances', () => {
    const bot = createMockBot();
    const task1 = new DodgeProjectilesTask(bot, { dodgeDistanceH: 2, dodgeDistanceV: 1 });
    const task2 = new DodgeProjectilesTask(bot, { dodgeDistanceH: 2, dodgeDistanceV: 1 });
    expect(task1.isEqual(task2)).toBe(true);
  });
});
