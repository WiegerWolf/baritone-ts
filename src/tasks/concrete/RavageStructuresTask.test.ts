/**
 * Tests for RavageDesertTemplesTask and RavageRuinedPortalsTask
 *
 * WHY these tasks matter:
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

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
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
      (bot.blockAt as ReturnType<typeof mock>).mockReturnValue(null);

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
      (bot.blockAt as ReturnType<typeof mock>).mockImplementation((pos: Vec3) => {
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
      (bot.blockAt as ReturnType<typeof mock>).mockReturnValue(null);

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

      (bot.blockAt as ReturnType<typeof mock>).mockImplementation((pos: Vec3) => {
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
      (bot.blockAt as ReturnType<typeof mock>).mockImplementation((pos: Vec3) => {
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
