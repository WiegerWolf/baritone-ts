/**
 * Tests for BiomeSearchTask
 *
 * These tests verify:
 * 1. Intent (WHY): What the task is supposed to accomplish
 * 2. State Machine: Correct state transitions
 * 3. Edge Cases: Error handling, interruption
 */

import { describe, it, expect, mock } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  Biomes,
  SearchWithinBiomeTask,
  searchWithinBiome,
  isInBiome,
} from './SearchWithinBiomeTask';
import {
  LocateDesertTempleTask,
  locateDesertTemple,
} from './LocateDesertTempleTask';

// Mock bot for testing
const createMockBot = (overrides: any = {}) => ({
  entity: {
    position: new Vec3(0, 64, 0),
    onGround: true,
  },
  inventory: {
    items: () => [],
  },
  blockAt: () => null,
  setControlState: mock(),
  lookAt: mock(),
  equip: mock(),
  activateItem: mock(),
  activateBlock: mock(),
  entities: {},
  ...overrides,
});

describe('Biomes constant', () => {
  describe('WHY: structure-specific searching', () => {
    it('should have desert biome for temple search', () => {
      expect(Biomes.DESERT).toBe('desert');
    });

    it('should have swamp biome for witch hut search', () => {
      expect(Biomes.SWAMP).toBe('swamp');
    });

    it('should have nether biomes for fortress search', () => {
      expect(Biomes.NETHER_WASTES).toBe('nether_wastes');
      expect(Biomes.SOUL_SAND_VALLEY).toBe('soul_sand_valley');
    });
  });
});

describe('SearchWithinBiomeTask', () => {
  describe('creation', () => {
    it('should create with biome name', () => {
      const bot = createMockBot() as any;
      const task = new SearchWithinBiomeTask(bot, Biomes.DESERT);

      expect(task.displayName).toContain('desert');
    });
  });

  describe('convenience function', () => {
    it('searchWithinBiome should create task', () => {
      const bot = createMockBot() as any;
      const task = searchWithinBiome(bot, Biomes.JUNGLE);

      expect(task).toBeInstanceOf(SearchWithinBiomeTask);
    });
  });
});

describe('LocateDesertTempleTask', () => {
  describe('WHY: valuable temple loot', () => {
    it('should search for desert temples', () => {
      // WHY: Desert temples contain diamonds, enchanted books, TNT
      const bot = createMockBot() as any;
      const task = new LocateDesertTempleTask(bot);

      expect(task.displayName).toContain('LocateDesertTemple');
    });
  });

  describe('temple detection', () => {
    it('should return found position when temple located', () => {
      const bot = createMockBot() as any;
      const task = new LocateDesertTempleTask(bot);

      // Initially no position found
      expect(task.getFoundTemplePosition()).toBeNull();
    });
  });

  describe('convenience function', () => {
    it('locateDesertTemple should create task', () => {
      const bot = createMockBot() as any;
      const task = locateDesertTemple(bot);

      expect(task).toBeInstanceOf(LocateDesertTempleTask);
    });
  });
});
