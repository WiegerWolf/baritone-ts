/**
 * Tests for Bed Tasks
 *
 * These tests verify that bed tasks work correctly:
 * - WHY: Bed tasks handle spawn point setting and sleeping mechanics.
 * - INTENT: Validate state machines, edge cases, and helper functions.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  PlaceBedAndSetSpawnTask,
  SleepInBedTask,
  placeBedAndSetSpawn,
  sleepInBed,
} from './BedTask';
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

describe('Bed Tasks', () => {
  describe('PlaceBedAndSetSpawnTask', () => {
    it('should create task', () => {
      const bot = createMockBot();
      const task = new PlaceBedAndSetSpawnTask(bot);
      expect(task.displayName).toBe('PlaceBedAndSetSpawn');
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new PlaceBedAndSetSpawnTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    /**
     * WHY: Beds explode in the nether/end, so task should fail.
     */
    it('should fail in nether dimension', () => {
      const bot = createMockBot({
        game: { dimension: 'minecraft:the_nether' },
      });
      const task = new PlaceBedAndSetSpawnTask(bot);
      task.onStart();
      task.onTick();
      expect(task.isFailed()).toBe(true);
    });

    it('should search for beds in overworld', () => {
      const bot = createMockBot();
      const task = new PlaceBedAndSetSpawnTask(bot);
      task.onStart();
      task.onTick();
      // Task starts searching (not finished, not failed)
      expect(task.isFinished()).toBe(false);
      expect(task.isFailed()).toBe(false);
    });
  });

  describe('SleepInBedTask', () => {
    it('should create task', () => {
      const bot = createMockBot();
      const task = new SleepInBedTask(bot);
      expect(task.displayName).toBe('SleepInBed');
    });

    /**
     * WHY: Task should finish if already sleeping.
     */
    it('should finish if already sleeping', () => {
      const bot = createMockBot({
        isSleeping: true,
      });
      const task = new SleepInBedTask(bot);
      task.onStart();
      task.onTick();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('helper functions', () => {
    it('placeBedAndSetSpawn should create task', () => {
      const bot = createMockBot();
      const task = placeBedAndSetSpawn(bot);
      expect(task).toBeInstanceOf(PlaceBedAndSetSpawnTask);
    });

    it('sleepInBed should create task', () => {
      const bot = createMockBot();
      const task = sleepInBed(bot);
      expect(task).toBeInstanceOf(SleepInBedTask);
    });
  });
});

describe('Task equality', () => {
  it('bed tasks should be equal if same config', () => {
    const bot = createMockBot();
    const task1 = new PlaceBedAndSetSpawnTask(bot, { stayInBed: false });
    const task2 = new PlaceBedAndSetSpawnTask(bot, { stayInBed: false });
    expect(task1.isEqual(task2)).toBe(true);
  });
});
