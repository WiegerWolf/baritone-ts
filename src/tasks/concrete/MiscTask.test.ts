/**
 * Tests for Miscellaneous Tasks
 *
 * WHY these tasks matter:
 * - CarveThenCollectTask: Carve blocks (like pumpkins) before collecting
 *   - Carved pumpkins needed for iron golems and jack-o-lanterns
 *   - Requires tool interaction, not just mining
 *
 * - HeroTask: Autonomous hostile mob clearing
 *   - Keeps area safe from hostile mobs
 *   - Collects XP orbs and mob drops
 *
 * - PlaceObsidianBucketTask: Create obsidian using bucket casting
 *   - Build cast frame, place lava, pour water to form obsidian
 *   - Alternative to mining obsidian with diamond pickaxe
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import {
  CarveThenCollectTask,
  CarveState,
  HeroTask,
  HeroState,
  PlaceObsidianBucketTask,
  ObsidianBucketState,
  collectCarvedPumpkins,
  beHero,
  placeObsidianWithBucket,
  HOSTILE_MOBS,
  HOSTILE_MOB_DROPS,
  OBSIDIAN_CAST_FRAME,
} from './MiscTask';
import { itemTarget } from './ResourceTask';

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
      items: mock().mockReturnValue([]),
      slots: {},
    },
    blockAt: mock().mockReturnValue({ name: 'air' }),
    entities: {},
    game: {
      dimension: 'minecraft:overworld',
    },
    food: 20,
    look: mock(),
    lookAt: mock(),
    attack: mock(),
    equip: mock(),
    activateItem: mock(),
    on: mock(),
    removeListener: mock(),
    once: mock(),
    emit: mock(),
  } as unknown as Bot;

  return mockBot;
}

describe('CarveThenCollectTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Task Creation', () => {
    it('WHY: Creates task to carve blocks before collecting', () => {
      const task = new CarveThenCollectTask(
        bot,
        itemTarget('carved_pumpkin', 5),
        ['carved_pumpkin'],
        itemTarget('pumpkin', 5),
        ['pumpkin'],
        'shears'
      );

      expect(task.displayName).toContain('CarveThenCollect');
      expect(task.displayName).toContain('carved_pumpkin');
    });

    it('WHY: collectCarvedPumpkins convenience function works', () => {
      const task = collectCarvedPumpkins(bot, 3);

      expect(task).toBeInstanceOf(CarveThenCollectTask);
      expect(task.displayName).toContain('carved_pumpkin');
    });
  });

  describe('State Machine', () => {
    it('WHY: Starts in GETTING_TOOL state', () => {
      const task = collectCarvedPumpkins(bot, 1);

      task.onStart();
      expect(task.getState()).toBe(CarveState.GETTING_TOOL);
    });

    it('WHY: All carving states are defined', () => {
      expect(CarveState.GETTING_TOOL).toBeDefined();
      expect(CarveState.FINDING_CARVED_BLOCK).toBeDefined();
      expect(CarveState.BREAKING_CARVED_BLOCK).toBeDefined();
      expect(CarveState.FINDING_CARVE_BLOCK).toBeDefined();
      expect(CarveState.CARVING_BLOCK).toBeDefined();
      expect(CarveState.COLLECTING_BLOCKS).toBeDefined();
      expect(CarveState.PLACING_BLOCKS).toBeDefined();
    });
  });

  describe('Equality', () => {
    it('WHY: Tasks with same target are equal', () => {
      const task1 = collectCarvedPumpkins(bot, 5);
      const task2 = collectCarvedPumpkins(bot, 5);

      expect(task1.isEqual(task2)).toBe(true);
    });
  });
});

describe('HeroTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Task Creation', () => {
    it('WHY: Creates task to clear hostile mobs', () => {
      const task = new HeroTask(bot);

      expect(task.displayName).toContain('Hero');
    });

    it('WHY: beHero convenience function works', () => {
      const task = beHero(bot);

      expect(task).toBeInstanceOf(HeroTask);
    });
  });

  describe('State Machine', () => {
    it('WHY: Starts in SEARCHING state', () => {
      const task = new HeroTask(bot);

      task.onStart();
      expect(task.getState()).toBe(HeroState.SEARCHING);
    });

    it('WHY: All hero states are defined', () => {
      expect(HeroState.EATING).toBeDefined();
      expect(HeroState.COLLECTING_XP).toBeDefined();
      expect(HeroState.KILLING_HOSTILE).toBeDefined();
      expect(HeroState.COLLECTING_DROPS).toBeDefined();
      expect(HeroState.SEARCHING).toBeDefined();
    });
  });

  describe('Behavior', () => {
    it('WHY: Never finishes (continuous task)', () => {
      const task = new HeroTask(bot);

      expect(task.isFinished()).toBe(false);
    });

    it('WHY: Returns wander task when no hostiles found', () => {
      const task = new HeroTask(bot);
      task.onStart();
      const subtask = task.onTick();

      // Should be searching (wandering)
      expect(task.getState()).toBe(HeroState.SEARCHING);
    });

    it('WHY: Detects hostile mobs', () => {
      // Add hostile mob
      (bot as any).entities = {
        '1': { name: 'zombie', position: new Vec3(10, 65, 10) },
      };

      const task = new HeroTask(bot);
      task.onStart();
      task.onTick();

      expect(task.getState()).toBe(HeroState.KILLING_HOSTILE);
    });

    it('WHY: Prioritizes eating when low on food', () => {
      (bot as any).food = 10; // Low food

      const task = new HeroTask(bot);
      task.onStart();
      task.onTick();

      expect(task.getState()).toBe(HeroState.EATING);
    });
  });

  describe('Equality', () => {
    it('WHY: All HeroTask instances are equal', () => {
      const task1 = new HeroTask(bot);
      const task2 = new HeroTask(bot);

      expect(task1.isEqual(task2)).toBe(true);
    });
  });
});

describe('PlaceObsidianBucketTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Task Creation', () => {
    it('WHY: Creates task to place obsidian using bucket casting', () => {
      const pos = new BlockPos(10, 60, 10);
      const task = new PlaceObsidianBucketTask(bot, pos);

      expect(task.displayName).toContain('PlaceObsidianBucket');
      expect(task.displayName).toContain('10');
      expect(task.displayName).toContain('60');
    });

    it('WHY: placeObsidianWithBucket convenience function works', () => {
      const pos = new BlockPos(5, 62, 5);
      const task = placeObsidianWithBucket(bot, pos);

      expect(task).toBeInstanceOf(PlaceObsidianBucketTask);
      expect(task.getPosition()).toBe(pos);
    });
  });

  describe('State Machine', () => {
    it('WHY: Starts in GETTING_WATER_BUCKET state', () => {
      const task = new PlaceObsidianBucketTask(bot, new BlockPos(0, 60, 0));

      task.onStart();
      expect(task.getState()).toBe(ObsidianBucketState.GETTING_WATER_BUCKET);
    });

    it('WHY: All obsidian bucket states are defined', () => {
      expect(ObsidianBucketState.GETTING_WATER_BUCKET).toBeDefined();
      expect(ObsidianBucketState.GETTING_LAVA_BUCKET).toBeDefined();
      expect(ObsidianBucketState.BUILDING_CAST).toBeDefined();
      expect(ObsidianBucketState.CLEARING_SPACE).toBeDefined();
      expect(ObsidianBucketState.POSITIONING).toBeDefined();
      expect(ObsidianBucketState.PLACING_LAVA).toBeDefined();
      expect(ObsidianBucketState.PLACING_WATER).toBeDefined();
      expect(ObsidianBucketState.CLEARING_WATER).toBeDefined();
      expect(ObsidianBucketState.FINISHED).toBeDefined();
    });
  });

  describe('Completion', () => {
    it('WHY: Finishes when obsidian is placed and water cleared', () => {
      const pos = new BlockPos(0, 60, 0);
      const task = new PlaceObsidianBucketTask(bot, pos);

      // Mock obsidian at position, no water above
      (bot.blockAt as any).mockImplementation((blockPos: Vec3) => {
        if (blockPos.y === 60) return { name: 'obsidian' };
        return { name: 'air' };
      });

      expect(task.isFinished()).toBe(true);
    });

    it('WHY: Not finished when water remains above', () => {
      const pos = new BlockPos(0, 60, 0);
      const task = new PlaceObsidianBucketTask(bot, pos);

      // Mock obsidian with water above
      (bot.blockAt as any).mockImplementation((blockPos: Vec3) => {
        if (blockPos.y === 60) return { name: 'obsidian' };
        if (blockPos.y === 61) return { name: 'water' };
        return { name: 'air' };
      });

      expect(task.isFinished()).toBe(false);
    });
  });

  describe('Equality', () => {
    it('WHY: Tasks with same position are equal', () => {
      const task1 = new PlaceObsidianBucketTask(bot, new BlockPos(10, 60, 10));
      const task2 = new PlaceObsidianBucketTask(bot, new BlockPos(10, 60, 10));

      expect(task1.isEqual(task2)).toBe(true);
    });

    it('WHY: Tasks with different positions are not equal', () => {
      const task1 = new PlaceObsidianBucketTask(bot, new BlockPos(10, 60, 10));
      const task2 = new PlaceObsidianBucketTask(bot, new BlockPos(20, 60, 20));

      expect(task1.isEqual(task2)).toBe(false);
    });
  });
});

describe('Constants', () => {
  describe('HOSTILE_MOBS', () => {
    it('WHY: Includes common overworld hostile mobs', () => {
      expect(HOSTILE_MOBS).toContain('zombie');
      expect(HOSTILE_MOBS).toContain('skeleton');
      expect(HOSTILE_MOBS).toContain('spider');
      expect(HOSTILE_MOBS).toContain('creeper');
    });

    it('WHY: Includes enderman for pearl collection', () => {
      expect(HOSTILE_MOBS).toContain('enderman');
    });

    it('WHY: Includes slime for slime ball collection', () => {
      expect(HOSTILE_MOBS).toContain('slime');
    });

    it('WHY: Includes mob variants', () => {
      expect(HOSTILE_MOBS).toContain('husk');
      expect(HOSTILE_MOBS).toContain('stray');
      expect(HOSTILE_MOBS).toContain('drowned');
    });
  });

  describe('HOSTILE_MOB_DROPS', () => {
    it('WHY: Includes common mob drops', () => {
      expect(HOSTILE_MOB_DROPS).toContain('rotten_flesh');
      expect(HOSTILE_MOB_DROPS).toContain('bone');
      expect(HOSTILE_MOB_DROPS).toContain('arrow');
      expect(HOSTILE_MOB_DROPS).toContain('string');
      expect(HOSTILE_MOB_DROPS).toContain('gunpowder');
    });

    it('WHY: Includes valuable drops', () => {
      expect(HOSTILE_MOB_DROPS).toContain('ender_pearl');
      expect(HOSTILE_MOB_DROPS).toContain('spider_eye');
    });
  });

  describe('OBSIDIAN_CAST_FRAME', () => {
    it('WHY: Has 6 frame positions for bucket casting', () => {
      expect(OBSIDIAN_CAST_FRAME.length).toBe(6);
    });

    it('WHY: Includes below position (floor)', () => {
      const below = OBSIDIAN_CAST_FRAME.find(v => v.y === -1);
      expect(below).toBeDefined();
    });

    it('WHY: Includes side positions (walls)', () => {
      const sides = OBSIDIAN_CAST_FRAME.filter(v => v.y === 0);
      expect(sides.length).toBeGreaterThanOrEqual(4);
    });

    it('WHY: Includes elevated position for water placement', () => {
      const elevated = OBSIDIAN_CAST_FRAME.find(v => v.y === 1);
      expect(elevated).toBeDefined();
    });
  });
});

describe('Integration Concepts', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Carving Workflow', () => {
    it('WHY: Carved pumpkins are needed for iron golems', () => {
      // Iron golem = 4 iron blocks + 1 carved pumpkin
      const task = collectCarvedPumpkins(bot, 1);
      expect(task.displayName).toContain('carved_pumpkin');
    });

    it('WHY: Shears are the carving tool for pumpkins', () => {
      // Pumpkin + shears right-click = carved pumpkin
      const task = new CarveThenCollectTask(
        bot,
        itemTarget('carved_pumpkin', 1),
        ['carved_pumpkin'],
        itemTarget('pumpkin', 1),
        ['pumpkin'],
        'shears'
      );

      task.onStart();
      // Without shears, stays in GETTING_TOOL
      expect(task.getState()).toBe(CarveState.GETTING_TOOL);
    });
  });

  describe('Hero Behavior', () => {
    it('WHY: Hero clears area of threats', () => {
      const task = beHero(bot);
      expect(task.isFinished()).toBe(false); // Continuous protection
    });

    it('WHY: Hero collects valuable mob drops', () => {
      // Ender pearls from endermen, gunpowder from creepers
      expect(HOSTILE_MOB_DROPS).toContain('ender_pearl');
      expect(HOSTILE_MOB_DROPS).toContain('gunpowder');
    });
  });

  describe('Obsidian Creation', () => {
    it('WHY: Bucket method creates obsidian without diamond pickaxe', () => {
      // Lava + Water = Obsidian
      // Cast prevents lava from spreading
      const task = placeObsidianWithBucket(bot, new BlockPos(0, 60, 0));
      expect(task.displayName).toContain('Obsidian');
    });

    it('WHY: Cast frame contains the lava safely', () => {
      // 6 blocks: floor, 4 walls, and 1 elevated for water placement
      expect(OBSIDIAN_CAST_FRAME.length).toBe(6);
    });
  });
});
