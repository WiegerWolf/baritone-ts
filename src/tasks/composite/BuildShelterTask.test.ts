import { describe, it, expect } from 'bun:test';
import { BuildShelterTask, ShelterType } from './index';

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

describe('BuildShelterTask', () => {
  it('should create dirt hut', () => {
    const bot = createMockBot();
    const task = new BuildShelterTask(bot, { type: ShelterType.DIRT_HUT });
    expect(task.displayName).toContain('DIRT_HUT');
  });

  it('should create wood cabin', () => {
    const bot = createMockBot();
    const task = new BuildShelterTask(bot, { type: ShelterType.WOOD_CABIN });
    expect(task.displayName).toContain('WOOD_CABIN');
  });

  it('should start in FINDING_LOCATION state', () => {
    const bot = createMockBot();
    const task = new BuildShelterTask(bot);
    task.onStart();
    expect(task.displayName).toContain('FINDING_LOCATION');
  });
});
