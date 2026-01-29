import { describe, it, expect, mock, test } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  ClickSlotTask,
  EnsureFreeCursorSlotTask,
  ThrowCursorTask,
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

describe('EnsureFreeCursorSlotTask', () => {
  describe('Intent: Many inventory operations require empty cursor first', () => {
    test('should finish immediately if cursor is already empty', () => {
      const bot = createMockBot({ cursorItem: null });
      const task = new EnsureFreeCursorSlotTask(bot);

      task.tick();

      expect(task.isFinished()).toBe(true);
      expect(bot.clickWindow).not.toHaveBeenCalled();
    });

    test('should try to put cursor item in empty slot', () => {
      const cursorItem = { name: 'diamond', count: 5, stackSize: 64 };
      const bot = createMockBot({
        cursorItem,
        emptySlot: 15,
      });

      const task = new EnsureFreeCursorSlotTask(bot);

      bot.time.age = 5;
      // Call onTick directly to get the child task
      const childTask = (task as any).onTick();

      // Should delegate to a ClickSlotTask
      expect(childTask).toBeInstanceOf(ClickSlotTask);
    });
  });

  describe('Intent: Clear cursor by any means necessary', () => {
    test('should throw garbage items if no empty slot and no stackable items', () => {
      const cursorItem = { name: 'cobblestone', count: 64, stackSize: 64 };
      const bot = createMockBot({
        cursorItem,
        emptySlot: null, // No empty slots
        inventoryItems: [], // No items to stack with
      });

      const task = new EnsureFreeCursorSlotTask(bot);

      bot.time.age = 5;
      // First call onStart
      (task as any).onStart();
      // Call onTick directly to get the child task
      const childTask = (task as any).onTick();

      // Since it's garbage (cobblestone) and no other options, it will throw
      expect(childTask).toBeInstanceOf(ThrowCursorTask);
    });
  });
});
