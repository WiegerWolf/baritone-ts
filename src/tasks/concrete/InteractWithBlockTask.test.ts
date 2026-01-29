/**
 * InteractWithBlockTask Tests
 *
 * These tests verify the block interaction functionality:
 *
 * WHY this task matters:
 * InteractWithBlockTask - Enhanced block interaction supporting direction,
 * item holding, and stuck detection.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';

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
      setGoal: jest.fn(),
      goto: jest.fn(),
      isMoving: () => false,
    },
    setControlState: jest.fn(),
    clearControlStates: jest.fn(),
    look: jest.fn(),
    clickWindow: jest.fn(),
    closeWindow: jest.fn(),
    ...overrides,
  };

  // Make position have proper Vec3 methods
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  return baseBot;
}

// Import tasks
import {
  InteractWithBlockTask,
  Direction,
  InteractInput,
  ClickResponse,
  interactWithBlock,
  placeBlockAt,
} from './InteractWithBlockTask';

describe('InteractWithBlockTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Direction enum', () => {
    /**
     * WHY: Direction enum provides type-safe block face targeting.
     * This is essential for placing blocks against specific sides.
     */
    it('should have all six directions', () => {
      expect(Direction.DOWN).toBe('down');
      expect(Direction.UP).toBe('up');
      expect(Direction.NORTH).toBe('north');
      expect(Direction.SOUTH).toBe('south');
      expect(Direction.WEST).toBe('west');
      expect(Direction.EAST).toBe('east');
    });
  });

  describe('InteractInput enum', () => {
    /**
     * WHY: InteractInput distinguishes between left click (mining/attack)
     * and right click (use/interact) operations.
     */
    it('should have left and right click', () => {
      expect(InteractInput.LEFT_CLICK).toBe('left');
      expect(InteractInput.RIGHT_CLICK).toBe('right');
    });
  });

  describe('ClickResponse enum', () => {
    /**
     * WHY: ClickResponse provides feedback on interaction attempts,
     * enabling state machine logic in the task.
     */
    it('should have interaction states', () => {
      expect(ClickResponse.CANT_REACH).toBe('cant_reach');
      expect(ClickResponse.WAIT_FOR_CLICK).toBe('wait_for_click');
      expect(ClickResponse.CLICK_ATTEMPTED).toBe('click_attempted');
    });
  });

  describe('InteractWithBlockTask creation', () => {
    /**
     * WHY: InteractWithBlockTask is a foundation for many other tasks.
     * It handles complex interaction logic like direction, item equipping,
     * and stuck detection.
     */
    const target = new BlockPos(10, 64, 10);

    it('should create task with target', () => {
      const task = new InteractWithBlockTask(bot, { target });
      expect(task.displayName).toContain('InteractWithBlock');
    });

    it('should create task with item', () => {
      const task = InteractWithBlockTask.withItem(bot, target, 'water_bucket');
      expect(task.displayName).toContain('water_bucket');
    });

    it('should create right-click task', () => {
      const task = InteractWithBlockTask.rightClick(bot, target);
      expect(task).toBeDefined();
    });

    it('should create left-click task', () => {
      const task = InteractWithBlockTask.leftClick(bot, target);
      expect(task).toBeDefined();
    });

    it('should include direction in display name', () => {
      const task = InteractWithBlockTask.withItem(bot, target, 'cobblestone', Direction.NORTH);
      expect(task.displayName).toContain('from north');
    });
  });

  describe('InteractWithBlockTask state machine', () => {
    const target = new BlockPos(10, 64, 10);

    it('should not be finished initially', () => {
      const task = new InteractWithBlockTask(bot, { target });
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should not have interacted initially', () => {
      const task = new InteractWithBlockTask(bot, { target });
      task.onStart();
      expect(task.wasInteractionAttempted()).toBe(false);
    });

    it('should get click status', () => {
      const task = new InteractWithBlockTask(bot, { target });
      task.onStart();
      expect(task.getClickStatus()).toBe(ClickResponse.CANT_REACH);
    });
  });

  describe('InteractWithBlockTask equality', () => {
    const target1 = new BlockPos(10, 64, 10);
    const target2 = new BlockPos(20, 64, 20);

    it('should be equal if same config', () => {
      const task1 = new InteractWithBlockTask(bot, { target: target1 });
      const task2 = new InteractWithBlockTask(bot, { target: target1 });
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different target', () => {
      const task1 = new InteractWithBlockTask(bot, { target: target1 });
      const task2 = new InteractWithBlockTask(bot, { target: target2 });
      expect(task1.isEqual(task2)).toBe(false);
    });

    it('should not be equal if different direction', () => {
      const task1 = new InteractWithBlockTask(bot, { target: target1, direction: Direction.NORTH });
      const task2 = new InteractWithBlockTask(bot, { target: target1, direction: Direction.SOUTH });
      expect(task1.isEqual(task2)).toBe(false);
    });

    it('should not be equal if different input type', () => {
      const task1 = new InteractWithBlockTask(bot, { target: target1, input: InteractInput.LEFT_CLICK });
      const task2 = new InteractWithBlockTask(bot, { target: target1, input: InteractInput.RIGHT_CLICK });
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    const target = new BlockPos(10, 64, 10);

    it('interactWithBlock should create task', () => {
      const task = interactWithBlock(bot, target);
      expect(task).toBeInstanceOf(InteractWithBlockTask);
    });

    it('interactWithBlock should accept item', () => {
      const task = interactWithBlock(bot, target, 'water_bucket');
      expect(task).toBeInstanceOf(InteractWithBlockTask);
    });

    it('interactWithBlock should accept direction', () => {
      const task = interactWithBlock(bot, target, 'cobblestone', Direction.UP);
      expect(task).toBeInstanceOf(InteractWithBlockTask);
    });

    it('placeBlockAt should create task with direction', () => {
      const task = placeBlockAt(bot, target, 'cobblestone', Direction.NORTH);
      expect(task).toBeInstanceOf(InteractWithBlockTask);
    });
  });
});

describe('Integration scenarios', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Block interaction with items', () => {
    /**
     * WHY: This tests scenarios where blocks need specific items:
     * - Placing water with bucket
     * - Using flint and steel
     */
    it('should create tasks for item-based interactions', () => {
      const target = new BlockPos(10, 64, 10);

      // Place water
      const waterTask = InteractWithBlockTask.withItem(bot, target, 'water_bucket');
      expect(waterTask).toBeDefined();

      // Light portal
      const flintTask = InteractWithBlockTask.withItem(bot, target, 'flint_and_steel');
      expect(flintTask).toBeDefined();
    });
  });
});
