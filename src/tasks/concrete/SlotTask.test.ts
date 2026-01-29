/**
 * Unit tests for Slot Management Tasks
 *
 * Tests cover:
 * - ClickSlotTask: Atomic slot click operations
 * - EnsureFreeCursorSlotTask: Clear cursor slot
 * - EnsureFreeInventorySlotTask: Free inventory space
 * - ThrowCursorTask: Throw cursor item
 * - EnsureFreePlayerCraftingGridTask: Clear crafting grid
 *
 * Tests focus on INTENT (WHY these tasks exist) not just HOW they work.
 */

import { Vec3 } from 'vec3';
import {
  ClickSlotTask,
  SlotActionType,
  SlotConstants,
  EnsureFreeCursorSlotTask,
  EnsureFreeInventorySlotTask,
  EnsureFreePlayerCraftingGridTask,
  ThrowCursorTask,
  ReceiveCraftingOutputTask,
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
    clickWindow: jest.fn().mockResolvedValue(undefined),
    clearControlStates: jest.fn(),
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

describe('SlotConstants', () => {
  describe('Intent: Provide named constants for common slot indices', () => {
    test('should define standard slot indices', () => {
      expect(SlotConstants.CRAFT_OUTPUT).toBe(0);
      expect(SlotConstants.HOTBAR_START).toBe(36);
      expect(SlotConstants.OFFHAND).toBe(45);
      expect(SlotConstants.CURSOR).toBe(-999);
    });
  });
});

describe('SlotActionType', () => {
  describe('Intent: Mirror Minecraft slot action types', () => {
    test('should define standard action types', () => {
      expect(SlotActionType.PICKUP).toBe(0);
      expect(SlotActionType.QUICK_MOVE).toBe(1);
      expect(SlotActionType.SWAP).toBe(2);
      expect(SlotActionType.THROW).toBe(4);
    });
  });
});
