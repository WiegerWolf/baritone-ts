/**
 * Tests for Portal Tasks
 *
 * These tests verify that portal tasks work correctly:
 * - WHY: Portal tasks handle crucial dimension travel mechanics.
 * - INTENT: Validate state machines, edge cases, and helper functions.
 */

import {
  EnterNetherPortalTask,
  GoToDimensionTask,
  enterNether,
  returnToOverworld,
  goToDimension,
} from '../composite/PortalTask';
import { Dimension } from './ResourceTask';
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
    setControlState: jest.fn(),
    clearControlStates: jest.fn(),
    look: jest.fn(),
    lookAt: jest.fn(),
    equip: jest.fn(),
    activateBlock: jest.fn(),
    wake: jest.fn(),
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

describe('Portal Tasks', () => {
  describe('EnterNetherPortalTask', () => {
    it('should create with target dimension', () => {
      const bot = createMockBot();
      const task = new EnterNetherPortalTask(bot, Dimension.NETHER);
      expect(task.displayName).toContain('Nether');
    });

    it('should throw for End dimension', () => {
      const bot = createMockBot();
      expect(() => new EnterNetherPortalTask(bot, Dimension.END))
        .toThrow("Can't build a nether portal to the End");
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new EnterNetherPortalTask(bot, Dimension.NETHER);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    /**
     * WHY: Task should finish when player reaches target dimension.
     */
    it('should finish when in target dimension', () => {
      const bot = createMockBot({
        game: { dimension: 'minecraft:the_nether' },
      });
      const task = new EnterNetherPortalTask(bot, Dimension.NETHER);
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('GoToDimensionTask', () => {
    it('should create with target dimension', () => {
      const bot = createMockBot();
      const task = new GoToDimensionTask(bot, Dimension.NETHER);
      expect(task.displayName).toContain('Nether');
    });

    it('should finish when already in target dimension', () => {
      const bot = createMockBot({
        game: { dimension: 'minecraft:the_nether' },
      });
      const task = new GoToDimensionTask(bot, Dimension.NETHER);
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('helper functions', () => {
    it('enterNether should create task', () => {
      const bot = createMockBot();
      const task = enterNether(bot);
      expect(task).toBeInstanceOf(EnterNetherPortalTask);
    });

    it('returnToOverworld should create task', () => {
      const bot = createMockBot();
      const task = returnToOverworld(bot);
      expect(task).toBeInstanceOf(EnterNetherPortalTask);
    });

    it('goToDimension should create task', () => {
      const bot = createMockBot();
      const task = goToDimension(bot, Dimension.NETHER);
      expect(task).toBeInstanceOf(GoToDimensionTask);
    });
  });
});

describe('Task equality', () => {
  it('portal tasks should be equal if same dimension', () => {
    const bot = createMockBot();
    const task1 = new EnterNetherPortalTask(bot, Dimension.NETHER);
    const task2 = new EnterNetherPortalTask(bot, Dimension.NETHER);
    expect(task1.isEqual(task2)).toBe(true);
  });
});
