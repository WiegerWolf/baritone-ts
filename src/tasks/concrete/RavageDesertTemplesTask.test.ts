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
