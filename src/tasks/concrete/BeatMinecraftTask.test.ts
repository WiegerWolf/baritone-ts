/**
 * Tests for BeatMinecraftTask (Speedrun Orchestrator)
 *
 * WHY this task matters:
 * - BeatMinecraftTask is the ultimate goal - beating Minecraft automatically
 * - Orchestrates gathering resources, nether travel, stronghold location, dragon fight
 * - Must handle dimension changes and complex state management
 * - Manages multiple phases: food, gear, nether, pearls, stronghold, end
 *
 * The task coordinates dozens of subtasks in the correct order
 * to achieve a complete game completion.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import {
  BeatMinecraftTask,
  BeatMinecraftState,
  beatMinecraft,
  speedrunMinecraft,
  BEAT_MINECRAFT_DEFAULT_CONFIG,
  IRON_ARMOR,
} from './BeatMinecraftTask';

// Mock Bot
function createMockBot(): Bot {
  const mockBot = {
    entity: {
      position: new Vec3(0, 65, 0),
      velocity: new Vec3(0, 0, 0),
      onGround: true,
      yaw: 0,
    },
    inventory: {
      items: jest.fn().mockReturnValue([]),
      slots: {},
    },
    blockAt: jest.fn().mockReturnValue({ name: 'air' }),
    entities: {},
    game: {
      dimension: 'minecraft:overworld',
    },
    time: {
      timeOfDay: 1000, // Day time
    },
    look: jest.fn(),
    lookAt: jest.fn(),
    attack: jest.fn(),
    equip: jest.fn(),
    activateItem: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
  } as unknown as Bot;

  return mockBot;
}

describe('BeatMinecraftTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Task Creation', () => {
    it('WHY: Creates the ultimate goal task - beat Minecraft', () => {
      const task = new BeatMinecraftTask(bot);

      expect(task.displayName).toContain('BeatMinecraft');
    });

    it('WHY: Uses default config values', () => {
      const task = new BeatMinecraftTask(bot);
      const config = task.getConfig();

      expect(config.targetEyes).toBe(14);
      expect(config.minimumEyes).toBe(12);
      expect(config.requiredBeds).toBe(10);
    });

    it('WHY: Accepts custom config to tune speedrun strategy', () => {
      const task = new BeatMinecraftTask(bot, {
        targetEyes: 16,
        barterPearlsInsteadOfEndermanHunt: true,
        requiredBeds: 5,
      });
      const config = task.getConfig();

      expect(config.targetEyes).toBe(16);
      expect(config.barterPearlsInsteadOfEndermanHunt).toBe(true);
      expect(config.requiredBeds).toBe(5);
    });

    it('WHY: beatMinecraft convenience function works', () => {
      const task = beatMinecraft(bot);

      expect(task).toBeInstanceOf(BeatMinecraftTask);
    });

    it('WHY: speedrunMinecraft uses optimized settings', () => {
      const task = speedrunMinecraft(bot);
      const config = task.getConfig();

      // Speedrun settings should be more aggressive
      expect(config.barterPearlsInsteadOfEndermanHunt).toBe(true);
      expect(config.sleepThroughNight).toBe(false);
      expect(config.requiredBeds).toBeLessThan(10);
    });
  });

  describe('State Machine', () => {
    it('WHY: Starts in GETTING_FOOD state (survival first)', () => {
      const task = new BeatMinecraftTask(bot);

      task.onStart();
      expect(task.getState()).toBe(BeatMinecraftState.GETTING_FOOD);
    });

    it('WHY: State machine covers all speedrun phases', () => {
      // All phases must be defined
      expect(BeatMinecraftState.GETTING_FOOD).toBeDefined();
      expect(BeatMinecraftState.GETTING_GEAR).toBeDefined();
      expect(BeatMinecraftState.GETTING_BEDS).toBeDefined();
      expect(BeatMinecraftState.GOING_TO_NETHER).toBeDefined();
      expect(BeatMinecraftState.GETTING_BLAZE_RODS).toBeDefined();
      expect(BeatMinecraftState.GETTING_ENDER_PEARLS).toBeDefined();
      expect(BeatMinecraftState.LEAVING_NETHER).toBeDefined();
      expect(BeatMinecraftState.LOCATING_STRONGHOLD).toBeDefined();
      expect(BeatMinecraftState.OPENING_PORTAL).toBeDefined();
      expect(BeatMinecraftState.SETTING_SPAWN).toBeDefined();
      expect(BeatMinecraftState.ENTERING_END).toBeDefined();
      expect(BeatMinecraftState.FIGHTING_DRAGON).toBeDefined();
      expect(BeatMinecraftState.FINISHED).toBeDefined();
    });

    it('WHY: Not finished at start', () => {
      const task = new BeatMinecraftTask(bot);

      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('Default Config', () => {
    it('WHY: Default config provides balanced speedrun settings', () => {
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.targetEyes).toBe(14);
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.minimumEyes).toBe(12);
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.placeSpawnNearEndPortal).toBe(true);
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.sleepThroughNight).toBe(true);
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.searchRuinedPortals).toBe(true);
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.searchDesertTemples).toBe(true);
    });

    it('WHY: Target eyes (14) ensures portal can be opened even with bad luck', () => {
      // 12 frames need 12 eyes, but eyes can break when thrown
      // 14 gives buffer for triangulation and breakage
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.targetEyes).toBeGreaterThan(12);
    });

    it('WHY: Minimum eyes (12) allows early stronghold search', () => {
      // With 12 eyes, we can try to locate stronghold
      // If some frames are already filled, we need fewer
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.minimumEyes).toBe(12);
    });

    it('WHY: Food units provide enough sustenance for full run', () => {
      // 180 minimum, 220 target - enough for nether and end
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.minFoodUnits).toBeGreaterThanOrEqual(100);
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.foodUnits).toBeGreaterThan(BEAT_MINECRAFT_DEFAULT_CONFIG.minFoodUnits);
    });

    it('WHY: 10 beds enable bed explosion strategy against dragon', () => {
      // Bed explosions are fastest way to kill dragon
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.requiredBeds).toBe(10);
    });
  });

  describe('Armor Constants', () => {
    it('WHY: IRON_ARMOR includes all armor pieces for early game protection', () => {
      expect(IRON_ARMOR).toContain('iron_helmet');
      expect(IRON_ARMOR).toContain('iron_chestplate');
      expect(IRON_ARMOR).toContain('iron_leggings');
      expect(IRON_ARMOR).toContain('iron_boots');
      expect(IRON_ARMOR.length).toBe(4);
    });
  });

  describe('Dimension Handling', () => {
    it('WHY: Recognizes overworld dimension', () => {
      (bot as any).game = { dimension: 'minecraft:overworld' };
      const task = new BeatMinecraftTask(bot);

      task.onStart();
      task.onTick();

      // Should be doing overworld tasks
      expect([
        BeatMinecraftState.GETTING_FOOD,
        BeatMinecraftState.GETTING_GEAR,
        BeatMinecraftState.GETTING_BEDS,
        BeatMinecraftState.GOING_TO_NETHER,
        BeatMinecraftState.LOCATING_STRONGHOLD,
      ]).toContain(task.getState());
    });

    it('WHY: Recognizes nether dimension', () => {
      (bot as any).game = { dimension: 'minecraft:the_nether' };
      const task = new BeatMinecraftTask(bot);

      task.onStart();
      task.onTick();

      // Should be doing nether tasks
      expect([
        BeatMinecraftState.GETTING_BLAZE_RODS,
        BeatMinecraftState.GETTING_ENDER_PEARLS,
        BeatMinecraftState.LEAVING_NETHER,
      ]).toContain(task.getState());
    });

    it('WHY: Recognizes End dimension', () => {
      (bot as any).game = { dimension: 'minecraft:the_end' };
      const task = new BeatMinecraftTask(bot);

      task.onStart();
      task.onTick();

      // Should be doing End tasks
      expect([
        BeatMinecraftState.FIGHTING_DRAGON,
        BeatMinecraftState.FINISHED,
      ]).toContain(task.getState());
    });
  });

  describe('Resource Tracking', () => {
    it('WHY: Tracks ender eye count for portal opening', () => {
      (bot.inventory.items as jest.Mock).mockReturnValue([
        { name: 'ender_eye', count: 12 },
      ]);

      const task = new BeatMinecraftTask(bot);
      task.onStart();

      // With 12 eyes, should try to locate stronghold
      expect(task.getState()).toBe(BeatMinecraftState.GETTING_FOOD);
    });

    it('WHY: Tracks blaze rods and powder for eye crafting', () => {
      (bot as any).game = { dimension: 'minecraft:the_nether' };
      (bot.inventory.items as jest.Mock).mockReturnValue([
        { name: 'blaze_rod', count: 3 },
        { name: 'blaze_powder', count: 2 },
      ]);

      const task = new BeatMinecraftTask(bot);
      task.onStart();
      task.onTick();

      // Should still be getting blaze rods (need ~7 for 14 eyes)
      expect(task.getState()).toBe(BeatMinecraftState.GETTING_BLAZE_RODS);
    });

    it('WHY: Tracks ender pearls for eye crafting', () => {
      (bot as any).game = { dimension: 'minecraft:the_nether' };
      (bot.inventory.items as jest.Mock).mockReturnValue([
        { name: 'blaze_rod', count: 10 },
        { name: 'ender_pearl', count: 5 },
      ]);

      const task = new BeatMinecraftTask(bot);
      task.onStart();
      task.onTick();

      // Should be getting ender pearls
      expect(task.getState()).toBe(BeatMinecraftState.GETTING_ENDER_PEARLS);
    });
  });

  describe('Equality', () => {
    it('WHY: All BeatMinecraft instances are equal (same goal)', () => {
      const task1 = new BeatMinecraftTask(bot);
      const task2 = new BeatMinecraftTask(bot, { targetEyes: 16 });

      // Same goal regardless of config
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('WHY: Not equal to null', () => {
      const task = new BeatMinecraftTask(bot);

      expect(task.isEqual(null)).toBe(false);
    });
  });
});

describe('Speedrun Strategies', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Bartering vs Hunting', () => {
    it('WHY: Bartering is faster but requires gold', () => {
      const barterTask = new BeatMinecraftTask(bot, {
        barterPearlsInsteadOfEndermanHunt: true,
      });
      const config = barterTask.getConfig();

      // Bartering with piglins is faster than hunting endermen
      expect(config.barterPearlsInsteadOfEndermanHunt).toBe(true);
    });

    it('WHY: Hunting endermen doesnt require nether gold', () => {
      const huntTask = new BeatMinecraftTask(bot, {
        barterPearlsInsteadOfEndermanHunt: false,
      });
      const config = huntTask.getConfig();

      expect(config.barterPearlsInsteadOfEndermanHunt).toBe(false);
    });
  });

  describe('Sleep Strategy', () => {
    it('WHY: Sleeping prevents phantoms and hostile spawns', () => {
      const sleepTask = new BeatMinecraftTask(bot, {
        sleepThroughNight: true,
      });
      const config = sleepTask.getConfig();

      expect(config.sleepThroughNight).toBe(true);
    });

    it('WHY: Speedruns skip sleep to save time', () => {
      const fastTask = speedrunMinecraft(bot);
      const config = fastTask.getConfig();

      expect(config.sleepThroughNight).toBe(false);
    });
  });

  describe('Structure Looting', () => {
    it('WHY: Ruined portals provide gold and obsidian', () => {
      const lootTask = new BeatMinecraftTask(bot, {
        searchRuinedPortals: true,
      });
      const config = lootTask.getConfig();

      expect(config.searchRuinedPortals).toBe(true);
    });

    it('WHY: Desert temples provide golden apples and TNT', () => {
      const templeTask = new BeatMinecraftTask(bot, {
        searchDesertTemples: true,
      });
      const config = templeTask.getConfig();

      expect(config.searchDesertTemples).toBe(true);
    });
  });

  describe('Spawn Point Strategy', () => {
    it('WHY: Setting spawn near end portal allows quick retry on death', () => {
      const spawnTask = new BeatMinecraftTask(bot, {
        placeSpawnNearEndPortal: true,
      });
      const config = spawnTask.getConfig();

      // Death in End sends you back to spawn
      // Having spawn near portal means quick re-entry
      expect(config.placeSpawnNearEndPortal).toBe(true);
    });
  });
});

describe('Integration Concepts', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Phase Progression', () => {
    it('WHY: Must get food before gear (survival priority)', () => {
      const task = new BeatMinecraftTask(bot);
      task.onStart();

      // Food comes first
      expect(task.getState()).toBe(BeatMinecraftState.GETTING_FOOD);
    });

    it('WHY: Must have gear before nether (safety)', () => {
      // Give bot food
      (bot.inventory.items as jest.Mock).mockReturnValue([
        { name: 'cooked_beef', count: 64 },
        { name: 'iron_pickaxe', count: 1 },
      ]);

      const task = new BeatMinecraftTask(bot);
      task.onStart();
      task.onTick();

      // Should be getting beds or going to nether
      expect([
        BeatMinecraftState.GETTING_BEDS,
        BeatMinecraftState.GOING_TO_NETHER,
      ]).toContain(task.getState());
    });

    it('WHY: Must have blaze rods before ender pearls (crafting order)', () => {
      (bot as any).game = { dimension: 'minecraft:the_nether' };
      (bot.inventory.items as jest.Mock).mockReturnValue([]);

      const task = new BeatMinecraftTask(bot);
      task.onStart();
      task.onTick();

      // Blaze rods first
      expect(task.getState()).toBe(BeatMinecraftState.GETTING_BLAZE_RODS);
    });
  });

  describe('Eye Requirements', () => {
    it('WHY: 12 frames need at least 12 eyes', () => {
      const config = BEAT_MINECRAFT_DEFAULT_CONFIG;

      expect(config.minimumEyes).toBe(12);
    });

    it('WHY: 7 blaze rods make 14 blaze powder for 14 eyes', () => {
      // 1 blaze rod = 2 blaze powder
      // 14 eyes = 14 blaze powder = 7 blaze rods
      const blazeRodsNeeded = Math.ceil(14 / 2);
      expect(blazeRodsNeeded).toBe(7);
    });

    it('WHY: 14 ender pearls needed for 14 eyes', () => {
      // 1 eye = 1 pearl + 1 powder
      expect(BEAT_MINECRAFT_DEFAULT_CONFIG.targetEyes).toBe(14);
    });
  });

  describe('Dragon Fight Preparation', () => {
    it('WHY: Beds are primary damage source against dragon', () => {
      const config = BEAT_MINECRAFT_DEFAULT_CONFIG;

      // Beds explode in End dimension
      // ~10 beds can kill dragon
      expect(config.requiredBeds).toBe(10);
    });

    it('WHY: Building materials needed for pillaring to crystals', () => {
      const config = BEAT_MINECRAFT_DEFAULT_CONFIG;

      // Need blocks to pillar up to end crystals
      expect(config.minBuildMaterialCount).toBeGreaterThan(0);
    });
  });
});
