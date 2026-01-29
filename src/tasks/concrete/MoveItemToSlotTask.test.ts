import { describe, it, expect, mock, test } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  ClickSlotTask,
  MoveItemToSlotTask,
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

describe('MoveItemToSlotTask', () => {
  describe('Intent: Move items between specific slots', () => {
    test('should pick up from source then place at destination', () => {
      const bot = createMockBot();

      const task = new MoveItemToSlotTask(bot, 10, 20);

      // First onTick: pick up
      const pickupTask = (task as any).onTick();
      expect(pickupTask).toBeInstanceOf(ClickSlotTask);

      // Simulate cursor now has item
      bot.inventory.cursor = { name: 'diamond', count: 1 };

      // After pickup task completes, place phase
      (task as any).onTick(); // Update phase
      const placeTask = (task as any).onTick();
      expect(placeTask).toBeInstanceOf(ClickSlotTask);
    });

    test('should identify equal tasks', () => {
      const bot = createMockBot();
      const task1 = new MoveItemToSlotTask(bot, 10, 20);
      const task2 = new MoveItemToSlotTask(bot, 10, 20);
      const task3 = new MoveItemToSlotTask(bot, 10, 21);

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });
});
