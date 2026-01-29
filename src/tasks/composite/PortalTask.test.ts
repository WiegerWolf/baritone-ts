import { describe, it, expect } from 'bun:test';
import { PortalTask, PortalType } from './index';

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

describe('PortalTask', () => {
  it('should create for nether portal', () => {
    const bot = createMockBot();
    const task = new PortalTask(bot, { portalType: PortalType.NETHER });
    expect(task.displayName).toContain('NETHER');
  });

  it('should create for end portal', () => {
    const bot = createMockBot();
    const task = new PortalTask(bot, { portalType: PortalType.END });
    expect(task.displayName).toContain('END');
  });

  it('should start in FINDING_PORTAL state', () => {
    const bot = createMockBot();
    const task = new PortalTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  it('should convert overworld to nether coordinates', () => {
    const result = PortalTask.overworldToNether(800, 800);
    expect(result.x).toBe(100);
    expect(result.z).toBe(100);
  });

  it('should convert nether to overworld coordinates', () => {
    const result = PortalTask.netherToOverworld(100, 100);
    expect(result.x).toBe(800);
    expect(result.z).toBe(800);
  });

  it('should create with build option', () => {
    const bot = createMockBot();
    const task = new PortalTask(bot, {
      portalType: PortalType.NETHER,
      buildIfNeeded: true,
    });
    expect(task.displayName).toContain('NETHER');
  });
});
