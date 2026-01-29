import { describe, it, expect } from 'bun:test';
import { RepairTask, RepairMethod } from './index';

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

describe('RepairTask', () => {
  it('should create with default config', () => {
    const bot = createMockBot();
    const task = new RepairTask(bot);
    expect(task.displayName).toContain('Repair');
  });

  it('should create with specific item', () => {
    const bot = createMockBot();
    const task = new RepairTask(bot, { itemToRepair: 'diamond_pickaxe' });
    expect(task.displayName).toContain('diamond_pickaxe');
  });

  it('should create with anvil method', () => {
    const bot = createMockBot();
    const task = new RepairTask(bot, { method: RepairMethod.ANVIL });
    expect(task.displayName).toContain('ANVIL');
  });

  it('should create with grindstone method', () => {
    const bot = createMockBot();
    const task = new RepairTask(bot, { method: RepairMethod.GRINDSTONE });
    expect(task.displayName).toContain('GRINDSTONE');
  });

  it('should start in FINDING_STATION state', () => {
    const bot = createMockBot();
    const task = new RepairTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  it('should provide repair material info', () => {
    expect(RepairTask.getRepairMaterial('diamond_pickaxe')).toBe('diamond');
    expect(RepairTask.getRepairMaterial('iron_sword')).toBe('iron_ingot');
    expect(RepairTask.getRepairMaterial('elytra')).toBe('phantom_membrane');
  });
});
