import { describe, it, expect, mock, test } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  ThrowCursorTask,
  SlotActionType,
  SlotConstants,
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

describe('ThrowCursorTask', () => {
  describe('Intent: Dispose of unwanted items', () => {
    test('should click outside inventory to throw', () => {
      const bot = createMockBot({
        cursorItem: { name: 'dirt', count: 64 },
      });

      const task = new ThrowCursorTask(bot);
      task.tick();

      // Should click the CURSOR constant (-999 = outside inventory)
      expect(bot.clickWindow).toHaveBeenCalledWith(SlotConstants.CURSOR, 0, SlotActionType.PICKUP);
    });

    test('should finish immediately if cursor is empty', () => {
      const bot = createMockBot({ cursorItem: null });
      const task = new ThrowCursorTask(bot);

      task.tick();

      expect(task.isFinished()).toBe(true);
      expect(bot.clickWindow).not.toHaveBeenCalled();
    });
  });
});
