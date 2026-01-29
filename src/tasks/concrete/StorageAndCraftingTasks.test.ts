/**
 * Storage Container and Inventory Crafting Tasks Tests
 *
 * These tests verify the storage and crafting functionality:
 *
 * WHY these tasks matter:
 * 1. PickupFromContainerTask - Enables retrieving items from containers,
 *    essential for restocking, looting structures, and resource management.
 *
 * 2. StoreInContainerTask - Enables depositing items into containers,
 *    essential for inventory management and creating storage bases.
 *
 * 3. LootContainerTask - Simplified looting that grabs all matching items,
 *    useful for quickly emptying chests during exploration.
 *
 * 4. CraftInInventoryTask - Uses the 2x2 inventory grid for quick crafting
 *    without needing a crafting table (planks, sticks, etc.).
 *
 * 5. InteractWithBlockTask - Enhanced block interaction supporting direction,
 *    item holding, and stuck detection.
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

// Mock item for testing
function createMockItem(name: string, count: number): any {
  return { name, count };
}

// Import tasks
import {
  PickupFromContainerTask,
  StoreInContainerTask,
  LootContainerTask,
  containerItemTarget,
  itemMatchesTarget,
  pickupFromContainer,
  storeInContainer,
  lootContainer,
} from './StorageContainerTask';

import {
  CraftInInventoryTask,
  CraftWithRecipeBookTask,
  INVENTORY_RECIPES,
  craftPlanks,
  craftSticks,
  craftCraftingTable,
} from './CraftInInventoryTask';

import {
  InteractWithBlockTask,
  Direction,
  InteractInput,
  ClickResponse,
  interactWithBlock,
  placeBlockAt,
} from './InteractWithBlockTask';

describe('Storage Container Tasks', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('containerItemTarget helper', () => {
    /**
     * WHY: containerItemTarget creates a structured target for item operations.
     * This enables type-safe, consistent item targeting across all container tasks.
     */
    it('should create target with single item', () => {
      const target = containerItemTarget('diamond', 10);
      expect(target.items).toBe('diamond');
      expect(target.targetCount).toBe(10);
    });

    it('should create target with multiple items', () => {
      const target = containerItemTarget(['oak_planks', 'spruce_planks'], 20);
      expect(target.items).toEqual(['oak_planks', 'spruce_planks']);
      expect(target.targetCount).toBe(20);
    });
  });

  describe('itemMatchesTarget helper', () => {
    /**
     * WHY: itemMatchesTarget provides flexible item matching that handles
     * both exact names and partial matches (useful for wood variants, etc.).
     */
    it('should match exact item name', () => {
      const target = containerItemTarget('diamond', 10);
      expect(itemMatchesTarget('diamond', target)).toBe(true);
      expect(itemMatchesTarget('emerald', target)).toBe(false);
    });

    it('should match partial item name', () => {
      const target = containerItemTarget('planks', 10);
      expect(itemMatchesTarget('oak_planks', target)).toBe(true);
      expect(itemMatchesTarget('spruce_planks', target)).toBe(true);
    });

    it('should match from array of items', () => {
      const target = containerItemTarget(['coal', 'charcoal'], 10);
      expect(itemMatchesTarget('coal', target)).toBe(true);
      expect(itemMatchesTarget('charcoal', target)).toBe(true);
      expect(itemMatchesTarget('iron_ore', target)).toBe(false);
    });
  });

  describe('PickupFromContainerTask', () => {
    /**
     * WHY: PickupFromContainerTask enables automated item retrieval from containers.
     * This is essential for:
     * - Restocking supplies from base chests
     * - Looting dungeon/temple chests
     * - Collecting smelted items from furnaces
     */
    const containerPos = new BlockPos(10, 64, 10);

    it('should create task with container position and targets', () => {
      const task = new PickupFromContainerTask(
        bot,
        containerPos,
        containerItemTarget('diamond', 5)
      );

      expect(task.displayName).toContain('PickupFromContainer');
      expect(task.displayName).toContain('10');
    });

    it('should not be finished initially when inventory is empty', () => {
      const task = new PickupFromContainerTask(
        bot,
        containerPos,
        containerItemTarget('diamond', 5)
      );

      // Empty inventory, hasn't collected anything yet
      expect(task.isFinished()).toBe(false);
    });

    it('should be finished when inventory has target items', () => {
      // Add items to inventory
      (bot.inventory as any).items = () => [
        createMockItem('diamond', 10)
      ];

      const task = new PickupFromContainerTask(
        bot,
        containerPos,
        containerItemTarget('diamond', 5)
      );

      expect(task.isFinished()).toBe(true);
    });

    it('should handle multiple targets', () => {
      const task = new PickupFromContainerTask(
        bot,
        containerPos,
        containerItemTarget('diamond', 5),
        containerItemTarget('emerald', 3)
      );

      // No items yet
      expect(task.isFinished()).toBe(false);
    });

    it('should be equal if same position and targets', () => {
      const task1 = new PickupFromContainerTask(
        bot,
        containerPos,
        containerItemTarget('diamond', 5)
      );
      const task2 = new PickupFromContainerTask(
        bot,
        containerPos,
        containerItemTarget('diamond', 5)
      );

      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different position', () => {
      const task1 = new PickupFromContainerTask(
        bot,
        containerPos,
        containerItemTarget('diamond', 5)
      );
      const task2 = new PickupFromContainerTask(
        bot,
        new BlockPos(20, 64, 20),
        containerItemTarget('diamond', 5)
      );

      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('StoreInContainerTask', () => {
    /**
     * WHY: StoreInContainerTask enables automated item storage.
     * This is essential for:
     * - Organizing items into storage systems
     * - Depositing collected resources at base
     * - Managing inventory space during exploration
     */
    const containerPos = new BlockPos(10, 64, 10);

    it('should create task with container position and targets', () => {
      const task = new StoreInContainerTask(
        bot,
        containerPos,
        containerItemTarget('cobblestone', 64)
      );

      expect(task.displayName).toContain('StoreInContainer');
    });

    it('should not be finished initially', () => {
      const task = new StoreInContainerTask(
        bot,
        containerPos,
        containerItemTarget('cobblestone', 64)
      );

      // Haven't stored anything yet
      expect(task.isFinished()).toBe(false);
    });

    it('should handle multiple storage targets', () => {
      const task = new StoreInContainerTask(
        bot,
        containerPos,
        containerItemTarget('cobblestone', 64),
        containerItemTarget('dirt', 64)
      );

      expect(task.isFinished()).toBe(false);
    });
  });

  describe('LootContainerTask', () => {
    /**
     * WHY: LootContainerTask is a simplified version for quickly grabbing
     * all items from a container. Useful for speedruns and exploration.
     */
    const containerPos = new BlockPos(10, 64, 10);

    it('should create task with container position', () => {
      const task = new LootContainerTask(bot, containerPos);
      expect(task.displayName).toContain('LootContainer');
    });

    it('should accept custom item filter', () => {
      const filter = (name: string) => name.includes('diamond');
      const task = new LootContainerTask(bot, containerPos, filter);
      expect(task).toBeDefined();
    });

    it('should not be finished until looting complete', () => {
      const task = new LootContainerTask(bot, containerPos);
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    const containerPos = new BlockPos(10, 64, 10);

    it('pickupFromContainer should create task with items', () => {
      const task = pickupFromContainer(
        bot,
        containerPos,
        { item: 'diamond', count: 5 },
        { item: 'emerald', count: 3 }
      );

      expect(task).toBeInstanceOf(PickupFromContainerTask);
    });

    it('storeInContainer should create task with items', () => {
      const task = storeInContainer(
        bot,
        containerPos,
        { item: 'cobblestone', count: 64 }
      );

      expect(task).toBeInstanceOf(StoreInContainerTask);
    });

    it('lootContainer should create task', () => {
      const task = lootContainer(bot, containerPos);
      expect(task).toBeInstanceOf(LootContainerTask);
    });
  });
});

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

  describe('Storage workflow', () => {
    /**
     * WHY: This tests a typical workflow where a bot:
     * 1. Loots a chest
     * 2. Stores items in a different chest
     */
    it('should create tasks for loot-and-store workflow', () => {
      const sourceChest = new BlockPos(10, 64, 10);
      const destChest = new BlockPos(20, 64, 20);

      // Loot from source
      const lootTask = lootContainer(bot, sourceChest);
      expect(lootTask).toBeInstanceOf(LootContainerTask);

      // Store in destination
      const storeTask = storeInContainer(bot, destChest, {
        item: 'diamond',
        count: 64,
      });
      expect(storeTask).toBeInstanceOf(StoreInContainerTask);
    });
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
