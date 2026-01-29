import { describe, it, expect } from 'bun:test';
import { UseEffectTask, EffectType, EffectTrigger } from './index';

function createMockBot(): any {
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: () => 5,
        offset: () => ({ x: 1, y: 64, z: 1 }),
        clone: () => ({ x: 0, y: 64, z: 0 }),
        minus: () => ({ x: 0, y: 0, z: 0, scaled: () => ({ x: 0, y: 0, z: 0 }) }),
        plus: () => ({ x: 0, y: 64, z: 0 }),
      },
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    entities: {},
    time: { timeOfDay: 6000 },
    health: 20,
    food: 20,
    heldItem: null,
  };
}

describe('UseEffectTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new UseEffectTask(bot);
    expect(task.displayName).toContain('UseEffect');
  });

  it('should create with healing effect', () => {
    const bot = createMockBot();
    const task = new UseEffectTask(bot, { effectType: EffectType.HEALING });
    expect(task.displayName).toContain('healing');
  });

  it('should create with strength effect', () => {
    const bot = createMockBot();
    const task = new UseEffectTask(bot, { effectType: EffectType.STRENGTH });
    expect(task.displayName).toContain('strength');
  });

  it('should start with zero uses', () => {
    const bot = createMockBot();
    const task = new UseEffectTask(bot);
    task.onStart();
    expect(task.getUsesCount()).toBe(0);
  });

  it('should create with low health trigger', () => {
    const bot = createMockBot();
    const task = new UseEffectTask(bot, {
      effectType: EffectType.HEALING,
      trigger: EffectTrigger.LOW_HEALTH,
      healthThreshold: 8,
    });
    expect(task.displayName).toContain('UseEffect');
  });

  it('should create with immediate trigger', () => {
    const bot = createMockBot();
    const task = new UseEffectTask(bot, {
      effectType: EffectType.SPEED,
      trigger: EffectTrigger.IMMEDIATE,
    });
    expect(task.displayName).toContain('speed');
  });

  it('should compare effect type and trigger for equality', () => {
    const bot = createMockBot();
    const task1 = new UseEffectTask(bot, { effectType: EffectType.HEALING, trigger: EffectTrigger.LOW_HEALTH });
    const task2 = new UseEffectTask(bot, { effectType: EffectType.HEALING, trigger: EffectTrigger.LOW_HEALTH });
    const task3 = new UseEffectTask(bot, { effectType: EffectType.STRENGTH, trigger: EffectTrigger.LOW_HEALTH });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
