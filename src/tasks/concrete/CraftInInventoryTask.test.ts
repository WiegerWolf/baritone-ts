/**
 * Inventory Crafting Tasks Tests
 *
 * These tests verify the crafting functionality:
 *
 * WHY these tasks matter:
 * 1. CraftInInventoryTask - Uses the 2x2 inventory grid for quick crafting
 *    without needing a crafting table (planks, sticks, etc.).
 *
 * 2. CraftWithRecipeBookTask - Recipe book crafting is faster when supported,
 *    as it auto-fills the crafting grid.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

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
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
    clickWindow: mock(),
    closeWindow: mock(),
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

// Mock item for testing
function createMockItem(name: string, count: number): any {
  return { name, count };
}

// Import tasks
import {
  CraftInInventoryTask,
  INVENTORY_RECIPES,
  craftPlanks,
  craftSticks,
  craftCraftingTable,
} from './CraftInInventoryTask';
import { CraftWithRecipeBookTask } from './CraftWithRecipeBookTask';

describe('Inventory Crafting Tasks', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('INVENTORY_RECIPES', () => {
    /**
     * WHY: Pre-defined recipes for common 2x2 crafts that don't need
     * a crafting table. These enable quick crafting during early game.
     */
    it('should have planks recipes', () => {
      expect(INVENTORY_RECIPES.oak_planks).toBeDefined();
      expect(INVENTORY_RECIPES.oak_planks.output).toBe('oak_planks');
      expect(INVENTORY_RECIPES.oak_planks.outputCount).toBe(4);
    });

    it('should have stick recipe', () => {
      expect(INVENTORY_RECIPES.stick).toBeDefined();
      expect(INVENTORY_RECIPES.stick.output).toBe('stick');
      expect(INVENTORY_RECIPES.stick.outputCount).toBe(4);
    });

    it('should have crafting_table recipe', () => {
      expect(INVENTORY_RECIPES.crafting_table).toBeDefined();
      expect(INVENTORY_RECIPES.crafting_table.output).toBe('crafting_table');
      expect(INVENTORY_RECIPES.crafting_table.outputCount).toBe(1);
    });

    it('should have torch recipe', () => {
      expect(INVENTORY_RECIPES.torch).toBeDefined();
      expect(INVENTORY_RECIPES.torch.output).toBe('torch');
      expect(INVENTORY_RECIPES.torch.outputCount).toBe(4);
    });
  });

  describe('CraftInInventoryTask', () => {
    /**
     * WHY: CraftInInventoryTask uses the 2x2 inventory grid for quick crafting.
     * This is essential for:
     * - Converting logs to planks without a crafting table
     * - Making sticks for tools
     * - Crafting a crafting table itself
     */
    it('should create task with recipe target', () => {
      const task = new CraftInInventoryTask(bot, {
        recipe: INVENTORY_RECIPES.oak_planks,
        targetCount: 8,
      });

      expect(task.displayName).toContain('CraftInInventory');
      expect(task.displayName).toContain('8');
      expect(task.displayName).toContain('oak_planks');
    });

    it('should not be finished initially', () => {
      const task = new CraftInInventoryTask(bot, {
        recipe: INVENTORY_RECIPES.oak_planks,
        targetCount: 8,
      });

      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should be finished when have enough items', () => {
      // Add items to inventory
      (bot.inventory as any).items = () => [
        createMockItem('oak_planks', 10)
      ];

      const task = new CraftInInventoryTask(bot, {
        recipe: INVENTORY_RECIPES.oak_planks,
        targetCount: 8,
      });

      task.onStart();
      task.onTick();

      expect(task.isFinished()).toBe(true);
    });

    it('should use static craft method', () => {
      const task = CraftInInventoryTask.craft(bot, 'oak_planks', 8);
      expect(task).toBeInstanceOf(CraftInInventoryTask);
    });

    it('should return null for unknown recipe', () => {
      const task = CraftInInventoryTask.craft(bot, 'unknown_item', 1);
      expect(task).toBeNull();
    });

    it('should be equal if same recipe and count', () => {
      const task1 = new CraftInInventoryTask(bot, {
        recipe: INVENTORY_RECIPES.oak_planks,
        targetCount: 8,
      });
      const task2 = new CraftInInventoryTask(bot, {
        recipe: INVENTORY_RECIPES.oak_planks,
        targetCount: 8,
      });

      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different count', () => {
      const task1 = new CraftInInventoryTask(bot, {
        recipe: INVENTORY_RECIPES.oak_planks,
        targetCount: 8,
      });
      const task2 = new CraftInInventoryTask(bot, {
        recipe: INVENTORY_RECIPES.oak_planks,
        targetCount: 16,
      });

      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('CraftWithRecipeBookTask', () => {
    /**
     * WHY: Recipe book crafting is faster when supported, as it
     * auto-fills the crafting grid. This task provides a fallback.
     */
    it('should create task with output and count', () => {
      const task = new CraftWithRecipeBookTask(bot, 'oak_planks', 8);
      expect(task.displayName).toContain('CraftWithRecipeBook');
    });

    it('should not be finished initially', () => {
      const task = new CraftWithRecipeBookTask(bot, 'oak_planks', 8);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('craftPlanks should create task for planks', () => {
      const task = craftPlanks(bot, 'oak_log', 16);
      expect(task).toBeInstanceOf(CraftInInventoryTask);
    });

    it('craftSticks should create task for sticks', () => {
      const task = craftSticks(bot, 8);
      expect(task).toBeInstanceOf(CraftInInventoryTask);
    });

    it('craftCraftingTable should create task', () => {
      const task = craftCraftingTable(bot);
      expect(task).toBeInstanceOf(CraftInInventoryTask);
    });
  });
});

describe('Integration scenarios', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Early game crafting workflow', () => {
    /**
     * WHY: This tests a typical early game progression:
     * 1. Craft logs into planks
     * 2. Craft planks into sticks
     * 3. Craft planks into crafting table
     */
    it('should create tasks for early game crafting', () => {
      // Punch tree, got logs
      const planksTask = craftPlanks(bot, 'oak_log', 4);
      expect(planksTask).toBeInstanceOf(CraftInInventoryTask);

      // Make sticks for tools
      const sticksTask = craftSticks(bot, 8);
      expect(sticksTask).toBeInstanceOf(CraftInInventoryTask);

      // Make crafting table for better recipes
      const tableTask = craftCraftingTable(bot);
      expect(tableTask).toBeInstanceOf(CraftInInventoryTask);
    });
  });
});
