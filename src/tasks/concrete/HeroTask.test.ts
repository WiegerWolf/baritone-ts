import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import {
  HeroTask,
  HeroState,
  beHero,
  HOSTILE_MOB_DROPS,
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

describe('Hero Behavior', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

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
