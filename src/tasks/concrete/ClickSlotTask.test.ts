import { describe, it, expect, mock, test } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  ClickSlotTask,
  SlotActionType,
} from './SlotTask';

/**
 * Create a mock bot for testing
 */
function createMockBot(options: {
  cursorItem?: any;
  inventoryItems?: any[];
  emptySlot?: number | null;
} = {}): any {
  const inventoryItems = options.inventoryItems ?? [];

  const bot: any = {
    entity: {
      position: new Vec3(0, 64, 0),
      velocity: new Vec3(0, 0, 0),
      onGround: true,
    },
    health: 20,
    food: 20,
    time: { age: 0 },
    inventory: {
      cursor: options.cursorItem ?? null,
      items: () => inventoryItems,
      slots: Array(46).fill(null),
      firstEmptyInventorySlot: () => options.emptySlot !== undefined ? options.emptySlot : 10,
    },
    clickWindow: mock().mockResolvedValue(undefined),
    clearControlStates: mock(),
  };

  // Set up inventory slots from items
  for (const item of inventoryItems) {
    if (item.slot !== undefined) {
      bot.inventory.slots[item.slot] = item;
    }
  }

  return bot;
}

describe('ClickSlotTask', () => {
  describe('Intent: Provides atomic slot click operations', () => {
    test('should click the specified slot with left mouse button', () => {
      const bot = createMockBot();
      const task = new ClickSlotTask(bot, 10, 0, SlotActionType.PICKUP);

      // Advance time to pass cooldown
      bot.time.age = 5;
      task.tick();

      expect(bot.clickWindow).toHaveBeenCalledWith(10, 0, SlotActionType.PICKUP);
    });

    test('should click the specified slot with right mouse button', () => {
      const bot = createMockBot();
      const task = new ClickSlotTask(bot, 15, 1, SlotActionType.PICKUP);

      bot.time.age = 5;
      task.tick();

      expect(bot.clickWindow).toHaveBeenCalledWith(15, 1, SlotActionType.PICKUP);
    });

    test('should support shift-click (QUICK_MOVE)', () => {
      const bot = createMockBot();
      const task = new ClickSlotTask(bot, 10, 0, SlotActionType.QUICK_MOVE);

      bot.time.age = 5;
      task.tick();

      expect(bot.clickWindow).toHaveBeenCalledWith(10, 0, SlotActionType.QUICK_MOVE);
    });

    test('should finish after clicking once', () => {
      const bot = createMockBot();
      const task = new ClickSlotTask(bot, 10);

      expect(task.isFinished()).toBe(false);

      bot.time.age = 5;
      task.tick();

      expect(task.isFinished()).toBe(true);
    });

    test('should use default values for simple clicks', () => {
      const bot = createMockBot();
      const task = new ClickSlotTask(bot, 10);

      bot.time.age = 5;
      task.tick();

      // Default: left click (0), PICKUP action
      expect(bot.clickWindow).toHaveBeenCalledWith(10, 0, SlotActionType.PICKUP);
    });
  });

  describe('Intent: Tasks with same parameters should be equal', () => {
    test('should identify equal tasks', () => {
      const bot = createMockBot();
      const task1 = new ClickSlotTask(bot, 10, 0, SlotActionType.PICKUP);
      const task2 = new ClickSlotTask(bot, 10, 0, SlotActionType.PICKUP);

      expect(task1.isEqual(task2)).toBe(true);
    });

    test('should identify different tasks', () => {
      const bot = createMockBot();
      const task1 = new ClickSlotTask(bot, 10, 0, SlotActionType.PICKUP);
      const task2 = new ClickSlotTask(bot, 11, 0, SlotActionType.PICKUP);
      const task3 = new ClickSlotTask(bot, 10, 1, SlotActionType.PICKUP);

      expect(task1.isEqual(task2)).toBe(false);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });
});
