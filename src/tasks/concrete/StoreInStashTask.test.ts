/**
 * Tests for StoreInStashTask
 *
 * WHY this task matters:
 * - Organized storage is essential for long-term survival
 * - Keeps valuable items in a known, safe location
 * - Prevents inventory overflow during expeditions
 * - Tracks what's been deposited to avoid duplicates
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import { BlockRange, blockRangeAround } from '../../utils/BlockRange';
import { itemTarget } from './ResourceTask';
import {
  StoreInStashTask,
  StashStorageState,
  storeInStash,
  STORAGE_BLOCKS,
} from './StoreInStashTask';

// Mock Bot
function createMockBot(): Bot {
  const mockBot = {
    entity: {
      position: new Vec3(0, 65, 0),
      velocity: new Vec3(0, 0, 0),
    },
    inventory: {
      items: mock().mockReturnValue([]),
      slots: {},
    },
    blockAt: mock().mockReturnValue(null),
    game: {
      dimension: 'minecraft:overworld',
    },
    on: mock(),
    removeListener: mock(),
    once: mock(),
    emit: mock(),
  } as unknown as Bot;

  return mockBot;
}

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
      (bot.inventory.items as ReturnType<typeof mock>).mockReturnValue([]);

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
      (bot.inventory.items as ReturnType<typeof mock>).mockReturnValue([
        { name: 'diamond', count: 10 },
      ]);
      (bot.blockAt as ReturnType<typeof mock>).mockReturnValue(null);

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
      (bot.blockAt as ReturnType<typeof mock>).mockImplementation((pos: Vec3) => {
        if (pos.x === 110 && pos.y === 65 && pos.z === 110) {
          return { name: 'chest' };
        }
        return null;
      });
      (bot.inventory.items as ReturnType<typeof mock>).mockReturnValue([
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
});
