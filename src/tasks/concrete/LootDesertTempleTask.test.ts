/**
 * LootDesertTempleTask Tests
 *
 * WHY this task matters:
 * LootDesertTempleTask - Safely loots desert temples:
 *    - Disarms TNT trap (pressure plate)
 *    - Loots all 4 chests systematically
 *    Valuable early-game loot source.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';

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
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
    ...overrides,
  };

  return baseBot;
}

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

describe('Integration: Temple loot for speedrun', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  /**
   * WHY: Real gameplay often chains these tasks together.
   * - While exploring, loot temples found
   */
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
