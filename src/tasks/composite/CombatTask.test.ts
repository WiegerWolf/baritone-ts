import { describe, it, expect } from 'bun:test';
import { CombatTask, CombatStyle } from './index';

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

describe('CombatTask', () => {
  it('should create with melee style', () => {
    const bot = createMockBot();
    const task = new CombatTask(bot, { style: CombatStyle.MELEE });
    expect(task.displayName).toContain('MELEE');
  });

  it('should create with hit-and-run style', () => {
    const bot = createMockBot();
    const task = new CombatTask(bot, { style: CombatStyle.HIT_AND_RUN });
    expect(task.displayName).toContain('HIT_AND_RUN');
  });

  it('should track kill count', () => {
    const bot = createMockBot();
    const task = new CombatTask(bot);
    task.onStart();
    expect(task.getKillCount()).toBe(0);
  });

  it('should accept target types', () => {
    const bot = createMockBot();
    const task = new CombatTask(bot, { targetTypes: ['zombie', 'skeleton'] });
    expect(task.displayName).toContain('Combat');
  });
});
