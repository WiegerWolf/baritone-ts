import { describe, it, expect, mock, test } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  ClickSlotTask,
  EnsureFreeCursorSlotTask,
  EnsureFreeInventorySlotTask,
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

describe('EnsureFreeInventorySlotTask', () => {
  describe('Intent: Before picking up items, we need inventory space', () => {
    test('should finish immediately if slot is already free', () => {
      const bot = createMockBot({ emptySlot: 10 });
      const task = new EnsureFreeInventorySlotTask(bot);

      task.tick();

      expect(task.isFinished()).toBe(true);
    });

    test('should clear cursor first if cursor has item', () => {
      const bot = createMockBot({
        cursorItem: { name: 'diamond', count: 1, stackSize: 64 },
        emptySlot: null,
      });

      const task = new EnsureFreeInventorySlotTask(bot);
      // Call onStart first
      (task as any).onStart();
      // Call onTick directly
      const childTask = (task as any).onTick();

      expect(childTask).toBeInstanceOf(EnsureFreeCursorSlotTask);
    });

    test('should find garbage to throw when no empty slots', () => {
      const bot = createMockBot({
        cursorItem: null,
        emptySlot: null,
        inventoryItems: [
          { name: 'diamond_pickaxe', count: 1, slot: 10 },
          { name: 'cobblestone', count: 64, slot: 11 },
        ],
      });

      // Preserve pickaxe - should pick up cobblestone to throw
      const task = new EnsureFreeInventorySlotTask(bot, ['pickaxe']);
      // Call onStart first
      (task as any).onStart();
      // Call onTick directly
      const childTask = (task as any).onTick();

      // Should pick up cobblestone (slot 11) to throw, not the pickaxe
      expect(childTask).toBeInstanceOf(ClickSlotTask);
    });
  });
});
