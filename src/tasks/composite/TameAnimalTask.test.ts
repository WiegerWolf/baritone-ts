import { describe, it, expect } from 'bun:test';
import { TameAnimalTask, TameableAnimal } from './index';

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

describe('TameAnimalTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new TameAnimalTask(bot);
    expect(task.displayName).toContain('TameAnimal');
  });

  it('should create with specific animal type', () => {
    const bot = createMockBot();
    const task = new TameAnimalTask(bot, { animalType: TameableAnimal.CAT });
    expect(task.displayName).toContain('cat');
  });

  it('should create with multiple animals', () => {
    const bot = createMockBot();
    const task = new TameAnimalTask(bot, { maxAnimals: 3 });
    expect(task.displayName).toContain('0/3');
  });

  it('should start in SEARCHING state', () => {
    const bot = createMockBot();
    const task = new TameAnimalTask(bot);
    task.onStart();
    expect(task.displayName).toContain('SEARCHING');
  });

  it('should track tamed count', () => {
    const bot = createMockBot();
    const task = new TameAnimalTask(bot);
    task.onStart();
    expect(task.getTamedCount()).toBe(0);
  });

  it('should have no target at start', () => {
    const bot = createMockBot();
    const task = new TameAnimalTask(bot);
    task.onStart();
    expect(task.getTargetAnimal()).toBeNull();
  });

  it('should compare by animal type and max count', () => {
    const bot = createMockBot();
    const task1 = new TameAnimalTask(bot, { animalType: TameableAnimal.WOLF, maxAnimals: 1 });
    const task2 = new TameAnimalTask(bot, { animalType: TameableAnimal.WOLF, maxAnimals: 1 });
    const task3 = new TameAnimalTask(bot, { animalType: TameableAnimal.CAT, maxAnimals: 1 });
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });
});
