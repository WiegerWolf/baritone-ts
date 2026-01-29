/**
 * Tests for StoreInStashTask and RavageStructuresTask
 *
 * WHY these tasks matter:
 * - StoreInStashTask: Organized storage is essential for long-term survival
 *   - Keeps valuable items in a known, safe location
 *   - Prevents inventory overflow during expeditions
 *   - Tracks what's been deposited to avoid duplicates
 *
 * - RavageDesertTemplesTask: Desert temples are high-value structures
 *   - Contains 4 chests with diamonds, emeralds, enchanted books
 *   - Must avoid TNT trap while looting
 *   - Continuous looting maximizes gains
 *
 * - RavageRuinedPortalsTask: Ruined portals provide nether gear
 *   - Contains obsidian, flint and steel, gold equipment
 *   - Identified by netherrack nearby
 *   - Helps prepare for nether entry
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import { BlockRange, blockRange, blockRangeAround } from '../../utils/BlockRange';
import { Dimension, itemTarget } from './ResourceTask';
import {
  StoreInStashTask,
  StashStorageState,
  storeInStash,
  STORAGE_BLOCKS,
} from './StoreInStashTask';
import {
  RavageDesertTemplesTask,
  RavageRuinedPortalsTask,
  RavageState,
  ravageDesertTemples,
  ravageRuinedPortals,
  DESERT_TEMPLE_LOOT,
  RUINED_PORTAL_LOOT,
} from './RavageStructuresTask';

// Mock Bot
function createMockBot(): Bot {
  const mockBot = {
    entity: {
      position: new Vec3(0, 65, 0),
      velocity: new Vec3(0, 0, 0),
    },
    inventory: {
      items: jest.fn().mockReturnValue([]),
      slots: {},
    },
    blockAt: jest.fn().mockReturnValue(null),
    game: {
      dimension: 'minecraft:overworld',
    },
    on: jest.fn(),
    removeListener: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
  } as unknown as Bot;

  return mockBot;
}

describe('BlockRange', () => {
  describe('Construction and Normalization', () => {
    it('WHY: Normalizes coordinates so start is always min corner', () => {
      // Create range with end < start
      const range = new BlockRange(
        new BlockPos(10, 70, 10),
        new BlockPos(0, 60, 0)
      );

      // Should normalize so start is min corner
      expect(range.start.x).toBe(0);
      expect(range.start.y).toBe(60);
      expect(range.start.z).toBe(0);
      expect(range.end.x).toBe(10);
      expect(range.end.y).toBe(70);
      expect(range.end.z).toBe(10);
    });

    it('WHY: fromPositions creates range from coordinates', () => {
      const range = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.NETHER);

      expect(range.start.equals(new BlockPos(0, 60, 0))).toBe(true);
      expect(range.end.equals(new BlockPos(10, 70, 10))).toBe(true);
      expect(range.dimension).toBe(Dimension.NETHER);
    });

    it('WHY: aroundPoint creates symmetric range around center', () => {
      const center = new BlockPos(100, 65, 100);
      const range = BlockRange.aroundPoint(center, 5, 3, 5);

      expect(range.start.equals(new BlockPos(95, 62, 95))).toBe(true);
      expect(range.end.equals(new BlockPos(105, 68, 105))).toBe(true);
    });

    it('WHY: aroundPointUniform uses same radius in all directions', () => {
      const center = new BlockPos(0, 0, 0);
      const range = BlockRange.aroundPointUniform(center, 10);

      expect(range.start.equals(new BlockPos(-10, -10, -10))).toBe(true);
      expect(range.end.equals(new BlockPos(10, 10, 10))).toBe(true);
    });
  });

  describe('Containment Checking', () => {
    let range: BlockRange;

    beforeEach(() => {
      range = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.OVERWORLD);
    });

    it('WHY: contains returns true for positions inside range', () => {
      expect(range.contains(new BlockPos(5, 65, 5))).toBe(true);
      expect(range.contains(new BlockPos(0, 60, 0))).toBe(true);
      expect(range.contains(new BlockPos(10, 70, 10))).toBe(true);
    });

    it('WHY: contains returns false for positions outside range', () => {
      expect(range.contains(new BlockPos(-1, 65, 5))).toBe(false);
      expect(range.contains(new BlockPos(5, 59, 5))).toBe(false);
      expect(range.contains(new BlockPos(11, 65, 5))).toBe(false);
    });

    it('WHY: contains checks dimension when specified', () => {
      const netherRange = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.NETHER);

      // Position is in range but wrong dimension
      expect(netherRange.contains(new BlockPos(5, 65, 5), Dimension.OVERWORLD)).toBe(false);
      expect(netherRange.contains(new BlockPos(5, 65, 5), Dimension.NETHER)).toBe(true);
      expect(netherRange.contains(new BlockPos(5, 65, 5))).toBe(true); // No dimension check
    });

    it('WHY: containsVec3 works with floating point positions', () => {
      expect(range.containsVec3(new Vec3(5.5, 65.9, 5.1))).toBe(true);
      expect(range.containsVec3(new Vec3(-0.1, 65, 5))).toBe(false);
    });
  });

  describe('Geometry Methods', () => {
    let range: BlockRange;

    beforeEach(() => {
      range = BlockRange.fromPositions(0, 60, 0, 10, 70, 10);
    });

    it('WHY: getCenter returns the middle of the range', () => {
      const center = range.getCenter();
      expect(center.x).toBe(5);
      expect(center.y).toBe(65);
      expect(center.z).toBe(5);
    });

    it('WHY: getSize returns dimensions including endpoints', () => {
      const size = range.getSize();
      expect(size.x).toBe(11); // 0-10 inclusive
      expect(size.y).toBe(11); // 60-70 inclusive
      expect(size.z).toBe(11);
    });

    it('WHY: getVolume returns total blocks in range', () => {
      expect(range.getVolume()).toBe(11 * 11 * 11);
    });

    it('WHY: expand grows the range in all directions', () => {
      const expanded = range.expand(5);

      expect(expanded.start.equals(new BlockPos(-5, 55, -5))).toBe(true);
      expect(expanded.end.equals(new BlockPos(15, 75, 15))).toBe(true);
    });
  });

  describe('Equality and String Representation', () => {
    it('WHY: equals checks all properties', () => {
      const range1 = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.OVERWORLD);
      const range2 = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.OVERWORLD);
      const range3 = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.NETHER);
      const range4 = BlockRange.fromPositions(1, 60, 0, 10, 70, 10, Dimension.OVERWORLD);

      expect(range1.equals(range2)).toBe(true);
      expect(range1.equals(range3)).toBe(false); // Different dimension
      expect(range1.equals(range4)).toBe(false); // Different start
    });

    it('WHY: toString provides readable representation', () => {
      const range = BlockRange.fromPositions(0, 60, 0, 10, 70, 10, Dimension.NETHER);
      const str = range.toString();

      expect(str).toContain('0,60,0');
      expect(str).toContain('10,70,10');
      expect(str).toContain('nether');
    });
  });

  describe('Position Generator', () => {
    it('WHY: positions iterator yields all blocks in range', () => {
      const smallRange = BlockRange.fromPositions(0, 0, 0, 1, 1, 1);
      const positions = Array.from(smallRange.positions());

      expect(positions.length).toBe(8); // 2x2x2 = 8
      expect(positions.some(p => p.x === 0 && p.y === 0 && p.z === 0)).toBe(true);
      expect(positions.some(p => p.x === 1 && p.y === 1 && p.z === 1)).toBe(true);
    });
  });

  describe('Convenience Functions', () => {
    it('WHY: blockRange creates range from coordinates', () => {
      const range = blockRange(0, 60, 0, 10, 70, 10);
      expect(range.start.equals(new BlockPos(0, 60, 0))).toBe(true);
      expect(range.end.equals(new BlockPos(10, 70, 10))).toBe(true);
    });

    it('WHY: blockRangeAround creates symmetric range', () => {
      const range = blockRangeAround(new BlockPos(100, 65, 100), 5);
      expect(range.start.equals(new BlockPos(95, 60, 95))).toBe(true);
      expect(range.end.equals(new BlockPos(105, 70, 105))).toBe(true);
    });
  });
});

describe('StoreInStashTask', () => {
  let bot: Bot;
  let stashRange: BlockRange;

  beforeEach(() => {
    bot = createMockBot();
    stashRange = BlockRange.fromPositions(100, 60, 100, 120, 70, 120);
  });

  describe('Task Creation', () => {
    it('WHY: Creates task to store specific items in designated area', () => {
      const task = new StoreInStashTask(bot, {
        items: [itemTarget('diamond', 10), itemTarget('iron_ingot', 64)],
        stashRange,
        getIfNotPresent: false,
      });

      expect(task.displayName).toContain('StoreInStash');
      expect(task.displayName).toContain('diamond');
      expect(task.displayName).toContain('iron_ingot');
    });

    it('WHY: storeItems static method simplifies creation', () => {
      const task = StoreInStashTask.storeItems(
        bot,
        stashRange,
        itemTarget('diamond', 10),
        itemTarget('gold_ingot', 32)
      );

      expect(task).toBeInstanceOf(StoreInStashTask);
      expect(task.getStashRange().equals(stashRange)).toBe(true);
    });

    it('WHY: storeInStash convenience function works', () => {
      const task = storeInStash(
        bot,
        stashRange,
        itemTarget('diamond', 10)
      );

      expect(task).toBeInstanceOf(StoreInStashTask);
    });
  });

  describe('State Management', () => {
    it('WHY: Starts in CHECKING_INVENTORY state', () => {
      const task = new StoreInStashTask(bot, {
        items: [itemTarget('diamond', 10)],
        stashRange,
        getIfNotPresent: false,
      });

      task.onStart();
      expect(task.getState()).toBe(StashStorageState.CHECKING_INVENTORY);
    });

    it('WHY: Finishes when no items to store', () => {
      // No items in inventory
      (bot.inventory.items as ReturnType<typeof jest.fn>).mockReturnValue([]);

      const task = new StoreInStashTask(bot, {
        items: [itemTarget('diamond', 10)],
        stashRange,
        getIfNotPresent: false,
      });

      task.onStart();
      const subtask = task.onTick();

      // Should finish since no diamonds in inventory
      expect(task.isFinished()).toBe(true);
    });

    it('WHY: Returns to TRAVELING_TO_STASH when no container found', () => {
      // Has items but no containers
      (bot.inventory.items as ReturnType<typeof jest.fn>).mockReturnValue([
        { name: 'diamond', count: 10 },
      ]);
      (bot.blockAt as ReturnType<typeof jest.fn>).mockReturnValue(null);

      const task = new StoreInStashTask(bot, {
        items: [itemTarget('diamond', 10)],
        stashRange,
        getIfNotPresent: false,
      });

      task.onStart();
      const subtask = task.onTick();

      expect(task.getState()).toBe(StashStorageState.TRAVELING_TO_STASH);
      expect(subtask).not.toBeNull();
    });
  });

  describe('Container Detection', () => {
    it('WHY: STORAGE_BLOCKS includes all valid container types', () => {
      expect(STORAGE_BLOCKS).toContain('chest');
      expect(STORAGE_BLOCKS).toContain('trapped_chest');
      expect(STORAGE_BLOCKS).toContain('barrel');
      expect(STORAGE_BLOCKS).toContain('shulker_box');
      // Check some colored shulker boxes
      expect(STORAGE_BLOCKS).toContain('white_shulker_box');
      expect(STORAGE_BLOCKS).toContain('black_shulker_box');
    });

    it('WHY: Finds container within stash range', () => {
      // Place a chest in the stash range
      const chestPos = new Vec3(110, 65, 110);
      (bot.blockAt as ReturnType<typeof jest.fn>).mockImplementation((pos: Vec3) => {
        if (pos.x === 110 && pos.y === 65 && pos.z === 110) {
          return { name: 'chest' };
        }
        return null;
      });
      (bot.inventory.items as ReturnType<typeof jest.fn>).mockReturnValue([
        { name: 'diamond', count: 10 },
      ]);

      const task = new StoreInStashTask(bot, {
        items: [itemTarget('diamond', 10)],
        stashRange,
        getIfNotPresent: false,
      });

      task.onStart();
      const subtask = task.onTick();

      expect(task.getState()).toBe(StashStorageState.STORING);
    });
  });

  describe('Task Equality', () => {
    it('WHY: isEqual compares all config properties', () => {
      const task1 = new StoreInStashTask(bot, {
        items: [itemTarget('diamond', 10)],
        stashRange,
        getIfNotPresent: false,
      });

      const task2 = new StoreInStashTask(bot, {
        items: [itemTarget('diamond', 10)],
        stashRange,
        getIfNotPresent: false,
      });

      const task3 = new StoreInStashTask(bot, {
        items: [itemTarget('diamond', 20)], // Different count
        stashRange,
        getIfNotPresent: false,
      });

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
      expect(task1.isEqual(null)).toBe(false);
    });
  });
});

describe('RavageDesertTemplesTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Task Creation', () => {
    it('WHY: Creates continuous temple looting task', () => {
      const task = new RavageDesertTemplesTask(bot);

      expect(task.displayName).toContain('RavageDesertTemples');
      expect(task.displayName).toContain('looted: 0');
    });

    it('WHY: ravageDesertTemples convenience function works', () => {
      const task = ravageDesertTemples(bot);

      expect(task).toBeInstanceOf(RavageDesertTemplesTask);
    });
  });

  describe('Loot Configuration', () => {
    it('WHY: DESERT_TEMPLE_LOOT includes valuable items', () => {
      // Valuables
      expect(DESERT_TEMPLE_LOOT).toContain('diamond');
      expect(DESERT_TEMPLE_LOOT).toContain('emerald');
      expect(DESERT_TEMPLE_LOOT).toContain('enchanted_book');
      expect(DESERT_TEMPLE_LOOT).toContain('golden_apple');
      expect(DESERT_TEMPLE_LOOT).toContain('enchanted_golden_apple');

      // Common items
      expect(DESERT_TEMPLE_LOOT).toContain('bone');
      expect(DESERT_TEMPLE_LOOT).toContain('rotten_flesh');
      expect(DESERT_TEMPLE_LOOT).toContain('gunpowder');
    });
  });

  describe('State Management', () => {
    it('WHY: Starts in SEARCHING state', () => {
      const task = new RavageDesertTemplesTask(bot);

      task.onStart();
      expect(task.getState()).toBe(RavageState.SEARCHING);
    });

    it('WHY: Never finishes - runs continuously', () => {
      const task = new RavageDesertTemplesTask(bot);

      task.onStart();
      task.onTick();

      expect(task.isFinished()).toBe(false);
    });

    it('WHY: Returns search task when no temple found', () => {
      (bot.blockAt as ReturnType<typeof jest.fn>).mockReturnValue(null);

      const task = new RavageDesertTemplesTask(bot);
      task.onStart();
      const subtask = task.onTick();

      expect(task.getState()).toBe(RavageState.SEARCHING);
      expect(subtask).not.toBeNull();
    });

    it('WHY: Tracks number of temples looted', () => {
      const task = new RavageDesertTemplesTask(bot);

      task.onStart();
      expect(task.getTemplesLooted()).toBe(0);
    });
  });

  describe('Temple Detection', () => {
    it('WHY: Identifies temple by stone pressure plate', () => {
      const pressurePlatePos = new Vec3(8, 45, 8); // Within search range
      (bot.blockAt as ReturnType<typeof jest.fn>).mockImplementation((pos: Vec3) => {
        if (Math.abs(pos.x - 8) < 1 && Math.abs(pos.y - 45) < 1 && Math.abs(pos.z - 8) < 1) {
          return { name: 'stone_pressure_plate' };
        }
        return null;
      });

      const task = new RavageDesertTemplesTask(bot);
      task.onStart();
      const subtask = task.onTick();

      // Should detect and start looting
      expect(task.getState()).toBe(RavageState.LOOTING);
    });
  });

  describe('Task Equality', () => {
    it('WHY: All RavageDesertTemplesTask instances are equal', () => {
      const task1 = new RavageDesertTemplesTask(bot);
      const task2 = new RavageDesertTemplesTask(bot);

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(null)).toBe(false);
    });
  });
});

describe('RavageRuinedPortalsTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
    (bot as any).game = { dimension: 'minecraft:overworld' };
  });

  describe('Task Creation', () => {
    it('WHY: Creates continuous portal looting task', () => {
      const task = new RavageRuinedPortalsTask(bot);

      expect(task.displayName).toContain('RavageRuinedPortals');
      expect(task.displayName).toContain('looted: 0');
    });

    it('WHY: ravageRuinedPortals convenience function works', () => {
      const task = ravageRuinedPortals(bot);

      expect(task).toBeInstanceOf(RavageRuinedPortalsTask);
    });
  });

  describe('Loot Configuration', () => {
    it('WHY: RUINED_PORTAL_LOOT includes nether-useful items', () => {
      // Key items for nether
      expect(RUINED_PORTAL_LOOT).toContain('obsidian');
      expect(RUINED_PORTAL_LOOT).toContain('flint_and_steel');
      expect(RUINED_PORTAL_LOOT).toContain('fire_charge');

      // Gold equipment
      expect(RUINED_PORTAL_LOOT).toContain('golden_helmet');
      expect(RUINED_PORTAL_LOOT).toContain('golden_chestplate');
      expect(RUINED_PORTAL_LOOT).toContain('golden_leggings');
      expect(RUINED_PORTAL_LOOT).toContain('golden_boots');

      // Other valuables
      expect(RUINED_PORTAL_LOOT).toContain('gold_block');
      expect(RUINED_PORTAL_LOOT).toContain('enchanted_golden_apple');
    });
  });

  describe('State Management', () => {
    it('WHY: Starts in SEARCHING state', () => {
      const task = new RavageRuinedPortalsTask(bot);

      task.onStart();
      expect(task.getState()).toBe(RavageState.SEARCHING);
    });

    it('WHY: Never finishes - runs continuously', () => {
      const task = new RavageRuinedPortalsTask(bot);

      task.onStart();
      task.onTick();

      expect(task.isFinished()).toBe(false);
    });

    it('WHY: Wanders when in nether (wrong dimension)', () => {
      (bot as any).game = { dimension: 'minecraft:the_nether' };

      const task = new RavageRuinedPortalsTask(bot);
      task.onStart();
      const subtask = task.onTick();

      expect(task.getState()).toBe(RavageState.WANDERING);
    });

    it('WHY: Tracks number of chests looted', () => {
      const task = new RavageRuinedPortalsTask(bot);

      task.onStart();
      expect(task.getChestsLooted()).toBe(0);
    });
  });

  describe('Portal Chest Detection', () => {
    it('WHY: Searches for portal chests with netherrack nearby', () => {
      // Ruined portals are identified by netherrack blocks near chests
      // The search scans a large area around the player looking for chests
      // then validates each by checking for netherrack within 4 blocks
      // and ensuring the chest is above y=50 and not underwater

      // Without a matching chest+netherrack combo in the search area,
      // the task will wander to find structures
      (bot.blockAt as ReturnType<typeof jest.fn>).mockReturnValue(null);

      const task = new RavageRuinedPortalsTask(bot);
      task.onStart();
      const subtask = task.onTick();

      // With no valid portal chest found, task should wander
      expect(task.getState()).toBe(RavageState.WANDERING);
      expect(subtask).not.toBeNull();
    });

    it('WHY: Skips underwater chests (not portals)', () => {
      // Chest with water above = ocean ruin/shipwreck
      const chestPos = new Vec3(8, 65, 8);

      (bot.blockAt as ReturnType<typeof jest.fn>).mockImplementation((pos: Vec3) => {
        if (Math.abs(pos.x - 8) < 1 && Math.abs(pos.y - 65) < 1 && Math.abs(pos.z - 8) < 1) {
          return { name: 'chest' };
        }
        if (Math.abs(pos.x - 8) < 1 && Math.abs(pos.y - 66) < 1 && Math.abs(pos.z - 8) < 1) {
          return { name: 'water' };
        }
        return null;
      });

      const task = new RavageRuinedPortalsTask(bot);
      task.onStart();
      const subtask = task.onTick();

      // Should skip and wander
      expect(task.getState()).toBe(RavageState.WANDERING);
    });

    it('WHY: Skips low-level chests (mineshafts, buried treasure)', () => {
      // Position bot low and chest low
      (bot.entity as any).position = new Vec3(0, 40, 0);

      // Chest at y=40 - below threshold
      (bot.blockAt as ReturnType<typeof jest.fn>).mockImplementation((pos: Vec3) => {
        if (Math.abs(pos.x) < 1 && Math.abs(pos.y - 40) < 1 && Math.abs(pos.z) < 1) {
          return { name: 'chest' };
        }
        return null;
      });

      const task = new RavageRuinedPortalsTask(bot);
      task.onStart();
      const subtask = task.onTick();

      // Should wander - chest too low
      expect(task.getState()).toBe(RavageState.WANDERING);
    });
  });

  describe('Task Equality', () => {
    it('WHY: All RavageRuinedPortalsTask instances are equal', () => {
      const task1 = new RavageRuinedPortalsTask(bot);
      const task2 = new RavageRuinedPortalsTask(bot);

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(null)).toBe(false);
    });
  });
});

describe('Integration Concepts', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('BlockRange for Stash Management', () => {
    it('WHY: BlockRange enables defining designated stash areas', () => {
      // Define a stash area around player's base
      const basePos = new BlockPos(100, 65, 200);
      const stashRange = blockRangeAround(basePos, 10);

      // Use for StoreInStashTask
      const task = storeInStash(
        bot,
        stashRange,
        itemTarget('diamond', 64),
        itemTarget('emerald', 32)
      );

      expect(task.getStashRange().contains(basePos)).toBe(true);
    });
  });

  describe('Continuous Looting Pattern', () => {
    it('WHY: Ravage tasks run indefinitely for maximum gain', () => {
      const templeTask = ravageDesertTemples(bot);
      const portalTask = ravageRuinedPortals(bot);

      templeTask.onStart();
      portalTask.onStart();

      // Multiple ticks should never finish
      for (let i = 0; i < 10; i++) {
        templeTask.onTick();
        portalTask.onTick();

        expect(templeTask.isFinished()).toBe(false);
        expect(portalTask.isFinished()).toBe(false);
      }
    });
  });

  describe('Structure Identification', () => {
    it('WHY: Different structures have unique identifiers', () => {
      // Desert temples: stone pressure plate (trap)
      // Ruined portals: netherrack nearby
      // This prevents misidentifying structures

      // Both ravage tasks use different detection methods
      const templeTask = new RavageDesertTemplesTask(bot);
      const portalTask = new RavageRuinedPortalsTask(bot);

      // They search for different block patterns
      expect(templeTask.displayName).toContain('DesertTemples');
      expect(portalTask.displayName).toContain('RuinedPortals');
    });
  });
});
