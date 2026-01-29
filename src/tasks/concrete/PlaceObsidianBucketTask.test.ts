import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import {
  PlaceObsidianBucketTask,
  ObsidianBucketState,
  placeObsidianWithBucket,
  OBSIDIAN_CAST_FRAME,
} from './MiscTask';

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

describe('Obsidian Creation', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

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
