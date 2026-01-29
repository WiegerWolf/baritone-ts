import { describe, it, expect, mock, test } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  ReceiveCraftingOutputTask,
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

describe('ReceiveCraftingOutputTask', () => {
  describe('Intent: Retrieve crafted items from crafting grid', () => {
    test('should not click if no output available', () => {
      const bot = createMockBot();
      bot.inventory.slots = Array(46).fill(null);
      bot.inventory.slots[0] = null; // No crafting output

      const task = new ReceiveCraftingOutputTask(bot);
      task.tick();

      expect(bot.clickWindow).not.toHaveBeenCalled();
    });

    test('should shift-click to receive output', () => {
      const bot = createMockBot();
      bot.inventory.slots = Array(46).fill(null);
      bot.inventory.slots[0] = { name: 'crafting_table', count: 1 };

      const task = new ReceiveCraftingOutputTask(bot);
      task.tick();

      expect(bot.clickWindow).toHaveBeenCalledWith(0, 0, SlotActionType.QUICK_MOVE);
    });

    test('should verify target item if specified', () => {
      const bot = createMockBot();
      bot.inventory.slots = Array(46).fill(null);
      bot.inventory.slots[0] = { name: 'stick', count: 4 }; // Different item

      const task = new ReceiveCraftingOutputTask(bot, 'crafting_table');
      task.tick();

      // Should not click because item doesn't match
      expect(bot.clickWindow).not.toHaveBeenCalled();
    });
  });
});
