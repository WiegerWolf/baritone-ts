import { describe, it, expect, mock, test } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  ClickSlotTask,
  EnsureFreePlayerCraftingGridTask,
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

describe('EnsureFreePlayerCraftingGridTask', () => {
  describe('Intent: Clear crafting grid before crafting or closing inventory', () => {
    test('should finish if crafting grid is empty', () => {
      const bot = createMockBot();
      bot.inventory.slots = Array(46).fill(null);

      const task = new EnsureFreePlayerCraftingGridTask(bot);
      task.tick();

      expect(task.isFinished()).toBe(true);
    });

    test('should quick-move items out of crafting grid', () => {
      const bot = createMockBot();
      bot.inventory.slots = Array(46).fill(null);
      bot.inventory.slots[1] = { name: 'stick', count: 2 }; // Item in crafting slot

      const task = new EnsureFreePlayerCraftingGridTask(bot);
      // Call onTick directly
      const childTask = (task as any).onTick();

      // Should shift-click to move item out
      expect(childTask).toBeInstanceOf(ClickSlotTask);
    });
  });
});
