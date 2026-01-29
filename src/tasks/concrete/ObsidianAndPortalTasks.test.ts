/**
 * Obsidian Collection and Portal Construction Tasks Tests
 *
 * These tests verify obsidian-related and portal construction functionality:
 *
 * WHY these tasks matter:
 * 1. CollectObsidianTask - Obsidian is essential for:
 *    - Nether portals (10-14 blocks)
 *    - Enchanting tables (4 blocks)
 *    - Ender chests (8 blocks)
 *    Requires diamond pickaxe (hardness 50).
 *
 * 2. ConstructNetherPortalTask - Automates portal construction:
 *    - Finds lava lake for bucket method
 *    - Casts obsidian frame using water + lava
 *    - Clears interior and lights portal
 *    Essential for dimension travel.
 *
 * 3. LootDesertTempleTask - Safely loots desert temples:
 *    - Disarms TNT trap (pressure plate)
 *    - Loots all 4 chests systematically
 *    Valuable early-game loot source.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';

// Import tasks
import {
  CollectObsidianTask,
  ObsidianCollectionState,
  collectObsidian,
  collectObsidianForPortal,
} from './CollectObsidianTask';

import {
  ConstructNetherPortalTask,
  PortalConstructionState,
  constructPortalAt,
  constructPortal,
} from './ConstructNetherPortalTask';

import {
  LootDesertTempleTask,
  TempleLootState,
  lootDesertTemple,
  lootDesertTempleFor,
} from './LootDesertTempleTask';

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
    game: { dimension: 'minecraft:overworld' },
    pathfinder: {
      setGoal: jest.fn(),
      goto: jest.fn(),
      isMoving: () => false,
    },
    setControlState: jest.fn(),
    clearControlStates: jest.fn(),
    look: jest.fn(),
    ...overrides,
  };

  return baseBot;
}

// Mock item for testing
function createMockItem(name: string, count: number): any {
  return { name, count };
}

describe('CollectObsidianTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('CollectObsidianTask creation', () => {
    /**
     * WHY: Obsidian collection requires configurable count for different uses:
     * - 10 blocks for minimal portal
     * - 14 blocks for full portal
     * - 4 blocks for enchanting table
     */
    it('should create task with default count', () => {
      const task = new CollectObsidianTask(bot);
      expect(task.displayName).toContain('CollectObsidian');
      expect(task.displayName).toContain('10'); // Default for portal
    });

    it('should create task with custom count', () => {
      const task = new CollectObsidianTask(bot, { count: 20 });
      expect(task.displayName).toContain('20');
    });

    it('should create task for portal (10 blocks)', () => {
      const task = CollectObsidianTask.forPortal(bot);
      expect(task.displayName).toContain('10');
    });

    it('should create task for full portal (14 blocks)', () => {
      const task = CollectObsidianTask.forFullPortal(bot);
      expect(task.displayName).toContain('14');
    });
  });

  describe('CollectObsidianTask completion', () => {
    /**
     * WHY: Task should complete when we have enough obsidian.
     * Obsidian stacks to 64, so we check inventory count.
     */
    it('should be finished when have enough obsidian', () => {
      (bot.inventory as any).items = () => [
        createMockItem('obsidian', 10),
      ];

      const task = new CollectObsidianTask(bot, { count: 10 });
      task.onStart();
      expect(task.isResourceFinished()).toBe(true);
    });

    it('should not be finished when lacking obsidian', () => {
      (bot.inventory as any).items = () => [
        createMockItem('obsidian', 5),
      ];

      const task = new CollectObsidianTask(bot, { count: 10 });
      task.onStart();
      expect(task.isResourceFinished()).toBe(false);
    });

    it('should count obsidian across multiple stacks', () => {
      (bot.inventory as any).items = () => [
        createMockItem('obsidian', 32),
        createMockItem('obsidian', 32),
      ];

      const task = new CollectObsidianTask(bot, { count: 50 });
      task.onStart();
      expect(task.isResourceFinished()).toBe(true);
    });
  });

  describe('CollectObsidianTask pickaxe requirement', () => {
    /**
     * WHY: Obsidian requires diamond or netherite pickaxe.
     * Hardness 50 means other tools take forever or don't work.
     */
    it('should recognize diamond pickaxe', () => {
      (bot.inventory as any).items = () => [
        createMockItem('diamond_pickaxe', 1),
      ];

      const task = new CollectObsidianTask(bot);
      task.onStart();
      task.onTick(); // State changes on tick
      // Task should proceed to mining, not getting pickaxe
      expect(task.getState()).not.toBe(ObsidianCollectionState.GETTING_PICKAXE);
    });

    it('should recognize netherite pickaxe', () => {
      (bot.inventory as any).items = () => [
        createMockItem('netherite_pickaxe', 1),
      ];

      const task = new CollectObsidianTask(bot);
      task.onStart();
      task.onTick(); // State changes on tick
      expect(task.getState()).not.toBe(ObsidianCollectionState.GETTING_PICKAXE);
    });

    it('should not proceed without proper pickaxe', () => {
      (bot.inventory as any).items = () => [
        createMockItem('iron_pickaxe', 1),
      ];

      const task = new CollectObsidianTask(bot);
      task.onStart();
      task.onTick();
      expect(task.getState()).toBe(ObsidianCollectionState.GETTING_PICKAXE);
    });
  });

  describe('CollectObsidianTask dimension awareness', () => {
    /**
     * WHY: Can't create obsidian in Nether because water evaporates instantly.
     * Must mine existing obsidian or return to Overworld.
     */
    it('should wander in Nether (cannot place water)', () => {
      (bot as any).game = { dimension: 'minecraft:the_nether' };
      (bot.inventory as any).items = () => [
        createMockItem('diamond_pickaxe', 1),
      ];

      const task = new CollectObsidianTask(bot);
      task.onStart();
      task.onTick();
      expect(task.getState()).toBe(ObsidianCollectionState.WANDERING);
    });

    it('should be able to create obsidian in Overworld', () => {
      (bot as any).game = { dimension: 'minecraft:overworld' };
      (bot.inventory as any).items = () => [
        createMockItem('diamond_pickaxe', 1),
      ];

      const task = new CollectObsidianTask(bot, { createFromLava: true });
      task.onStart();
      // Should search for lava or wander
      task.onTick();
      expect([
        ObsidianCollectionState.SEARCHING_LAVA,
        ObsidianCollectionState.WANDERING,
      ]).toContain(task.getState());
    });
  });

  describe('CollectObsidianTask equality', () => {
    it('should be equal if same count', () => {
      const task1 = new CollectObsidianTask(bot, { count: 10 });
      const task2 = new CollectObsidianTask(bot, { count: 10 });
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different count', () => {
      const task1 = new CollectObsidianTask(bot, { count: 10 });
      const task2 = new CollectObsidianTask(bot, { count: 14 });
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('collectObsidian should create task', () => {
      const task = collectObsidian(bot, 10);
      expect(task).toBeInstanceOf(CollectObsidianTask);
    });

    it('collectObsidianForPortal should create task for 10 blocks', () => {
      const task = collectObsidianForPortal(bot);
      expect(task).toBeInstanceOf(CollectObsidianTask);
    });
  });
});

describe('ConstructNetherPortalTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('ConstructNetherPortalTask creation', () => {
    /**
     * WHY: Portal construction can be at a specific position or auto-located
     * near a lava lake for the bucket method.
     */
    it('should create task with auto-locate', () => {
      const task = new ConstructNetherPortalTask(bot);
      expect(task.displayName).toContain('ConstructNetherPortal');
      expect(task.displayName).toContain('searching');
    });

    it('should create task at specific position', () => {
      const task = ConstructNetherPortalTask.at(bot, 100, 64, 200);
      task.onStart(); // Initialize portal origin
      expect(task.displayName).toContain('100');
      expect(task.displayName).toContain('64');
      expect(task.displayName).toContain('200');
    });

    it('should create task via autoLocate factory', () => {
      const task = ConstructNetherPortalTask.autoLocate(bot);
      expect(task).toBeInstanceOf(ConstructNetherPortalTask);
      expect(task.getPortalOrigin()).toBeNull();
    });
  });

  describe('ConstructNetherPortalTask materials', () => {
    /**
     * WHY: Portal construction needs:
     * - 2 buckets (water + lava or both water/lava)
     * - Flint and steel or fire charge to light
     */
    it('should start in GETTING_MATERIALS state', () => {
      const task = new ConstructNetherPortalTask(bot);
      task.onStart();
      expect(task.getState()).toBe(PortalConstructionState.GETTING_MATERIALS);
    });

    it('should recognize when we have materials', () => {
      (bot.inventory as any).items = () => [
        createMockItem('water_bucket', 1),
        createMockItem('lava_bucket', 1),
        createMockItem('flint_and_steel', 1),
      ];

      const task = new ConstructNetherPortalTask(bot);
      task.onStart();
      const subtask = task.onTick();
      // Should move past GETTING_MATERIALS to SEARCHING_LOCATION
      expect(task.getState()).not.toBe(PortalConstructionState.GETTING_MATERIALS);
    });

    it('should accept fire charge as igniter', () => {
      (bot.inventory as any).items = () => [
        createMockItem('bucket', 2),
        createMockItem('fire_charge', 1),
      ];

      const task = new ConstructNetherPortalTask(bot);
      task.onStart();
      const subtask = task.onTick();
      expect(task.getState()).not.toBe(PortalConstructionState.GETTING_MATERIALS);
    });
  });

  describe('ConstructNetherPortalTask completion', () => {
    /**
     * WHY: Portal is complete when nether_portal block exists.
     * This happens after successful ignition of the obsidian frame.
     */
    it('should not be finished initially', () => {
      const task = new ConstructNetherPortalTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should be finished when portal block exists', () => {
      const portalOrigin = new BlockPos(100, 64, 200);
      (bot.blockAt as any) = (pos: Vec3) => {
        // Portal block is at origin + (0, 1, 0)
        if (pos.x === 100 && pos.y === 65 && pos.z === 200) {
          return { name: 'nether_portal' };
        }
        return null;
      };

      const task = ConstructNetherPortalTask.at(bot, 100, 64, 200);
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('ConstructNetherPortalTask equality', () => {
    it('should be equal if same position', () => {
      const task1 = ConstructNetherPortalTask.at(bot, 100, 64, 200);
      const task2 = ConstructNetherPortalTask.at(bot, 100, 64, 200);
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different position', () => {
      const task1 = ConstructNetherPortalTask.at(bot, 100, 64, 200);
      const task2 = ConstructNetherPortalTask.at(bot, 200, 64, 300);
      expect(task1.isEqual(task2)).toBe(false);
    });

    it('should be equal if both auto-locate', () => {
      const task1 = ConstructNetherPortalTask.autoLocate(bot);
      const task2 = ConstructNetherPortalTask.autoLocate(bot);
      expect(task1.isEqual(task2)).toBe(true);
    });
  });

  describe('Convenience functions', () => {
    it('constructPortalAt should create positioned task', () => {
      const task = constructPortalAt(bot, 100, 64, 200);
      expect(task).toBeInstanceOf(ConstructNetherPortalTask);
      task.onStart(); // Initialize the portal origin
      expect(task.getPortalOrigin()?.x).toBe(100);
    });

    it('constructPortal should create auto-locate task', () => {
      const task = constructPortal(bot);
      expect(task).toBeInstanceOf(ConstructNetherPortalTask);
      expect(task.getPortalOrigin()).toBeNull();
    });
  });
});

describe('LootDesertTempleTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('LootDesertTempleTask creation', () => {
    /**
     * WHY: Desert temples have 4 chests arranged around a central point.
     * The center has a pressure plate that triggers TNT trap.
     */
    it('should create task at position', () => {
      const task = new LootDesertTempleTask(bot, new BlockPos(100, 64, 200));
      expect(task.displayName).toContain('LootDesertTemple');
      expect(task.displayName).toContain('100');
    });

    it('should create task via at factory', () => {
      const task = LootDesertTempleTask.at(bot, 100, 64, 200);
      expect(task).toBeInstanceOf(LootDesertTempleTask);
    });

    it('should create task via atVec3 factory', () => {
      const task = LootDesertTempleTask.atVec3(bot, new Vec3(100.5, 64.2, 200.8));
      expect(task.getTempleCenter().x).toBe(100);
      expect(task.getTempleCenter().z).toBe(200);
    });
  });

  describe('LootDesertTempleTask trap disarming', () => {
    /**
     * WHY: The pressure plate triggers TNT that destroys loot and kills player.
     * MUST be destroyed before approaching chests.
     */
    it('should detect pressure plate', () => {
      (bot.blockAt as any) = (pos: Vec3) => {
        if (pos.x === 100 && pos.y === 64 && pos.z === 200) {
          return { name: 'stone_pressure_plate' };
        }
        return null;
      };

      const task = LootDesertTempleTask.at(bot, 100, 64, 200);
      task.onStart();
      const subtask = task.onTick();
      expect(task.getState()).toBe(TempleLootState.DISARMING_TRAP);
    });

    it('should skip disarming if no pressure plate', () => {
      (bot.blockAt as any) = () => ({ name: 'sandstone' });

      const task = LootDesertTempleTask.at(bot, 100, 64, 200);
      task.onStart();
      const subtask = task.onTick();
      // Should proceed to looting
      expect(task.getState()).toBe(TempleLootState.LOOTING_CHEST);
    });
  });

  describe('LootDesertTempleTask completion', () => {
    /**
     * WHY: Temple has exactly 4 chests. Task is complete when all are looted.
     */
    it('should start with 0 chests looted', () => {
      const task = new LootDesertTempleTask(bot, new BlockPos(100, 64, 200));
      task.onStart();
      expect(task.getChestsLooted()).toBe(0);
    });

    it('should not be finished until all 4 chests looted', () => {
      const task = new LootDesertTempleTask(bot, new BlockPos(100, 64, 200));
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should be finished when 4 chests looted', () => {
      const task = new LootDesertTempleTask(bot, new BlockPos(100, 64, 200));
      task.onStart();
      // Simulate looting all 4 chests by advancing internal state
      (task as any).currentChest = 4;
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('LootDesertTempleTask wanted items', () => {
    /**
     * WHY: Can specify wanted items to look for (diamonds, emeralds, etc.)
     * or leave empty to take everything.
     */
    it('should accept wanted items list', () => {
      const task = new LootDesertTempleTask(bot, new BlockPos(100, 64, 200), {
        wantedItems: ['diamond', 'emerald', 'golden_apple'],
      });
      expect(task).toBeInstanceOf(LootDesertTempleTask);
    });

    it('should accept empty wanted items (take all)', () => {
      const task = new LootDesertTempleTask(bot, new BlockPos(100, 64, 200), {
        wantedItems: [],
      });
      expect(task).toBeInstanceOf(LootDesertTempleTask);
    });
  });

  describe('LootDesertTempleTask equality', () => {
    it('should be equal if same temple position', () => {
      const task1 = LootDesertTempleTask.at(bot, 100, 64, 200);
      const task2 = LootDesertTempleTask.at(bot, 100, 64, 200);
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different position', () => {
      const task1 = LootDesertTempleTask.at(bot, 100, 64, 200);
      const task2 = LootDesertTempleTask.at(bot, 200, 64, 300);
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('lootDesertTemple should create task', () => {
      const task = lootDesertTemple(bot, 100, 64, 200);
      expect(task).toBeInstanceOf(LootDesertTempleTask);
    });

    it('lootDesertTempleFor should create task with wanted items', () => {
      const task = lootDesertTempleFor(bot, 100, 64, 200, ['diamond', 'emerald']);
      expect(task).toBeInstanceOf(LootDesertTempleTask);
    });
  });
});

describe('Integration scenarios', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  /**
   * WHY: Real gameplay often chains these tasks together.
   * - Collect obsidian for portal
   * - Construct portal
   * - While exploring, loot temples found
   */
  describe('Obsidian to portal flow', () => {
    it('should collect then construct', () => {
      // First collect obsidian
      (bot.inventory as any).items = () => [
        createMockItem('diamond_pickaxe', 1),
        createMockItem('obsidian', 10),
        createMockItem('water_bucket', 1),
        createMockItem('lava_bucket', 1),
        createMockItem('flint_and_steel', 1),
      ];

      const collectTask = collectObsidian(bot, 10);
      collectTask.onStart();
      expect(collectTask.isResourceFinished()).toBe(true);

      // Then construct portal
      const constructTask = constructPortal(bot);
      constructTask.onStart();
      // After onTick, should move to searching for location (has materials)
      constructTask.onTick();
      expect(constructTask.getState()).toBe(PortalConstructionState.SEARCHING_LOCATION);
    });
  });

  describe('Temple loot for speedrun', () => {
    it('should prioritize TNT and string for speedrun', () => {
      // Speedrunners want TNT (for minecarts) and string (for wool -> bed)
      const task = lootDesertTempleFor(bot, 100, 64, 200, [
        'tnt',
        'string',
        'gold_ingot',
        'diamond',
      ]);

      expect(task).toBeInstanceOf(LootDesertTempleTask);
    });
  });
});
