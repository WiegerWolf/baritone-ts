import { describe, it, expect, mock } from 'bun:test';
import { EquipTask, EquipmentSlot } from './index';

function createMockBot(): any {
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: () => 5,
        offset: (x: number, y: number, z: number) => ({ x, y: 64 + y, z }),
        clone: () => ({ x: 0, y: 64, z: 0 }),
      },
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    entities: {},
    time: { timeOfDay: 6000, age: 0 },
    health: 20,
    food: 20,
    heldItem: null,
    pathfinder: {
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    dig: mock(),
    placeBlock: mock(),
    equip: mock(),
    attack: mock(),
    activateItem: mock(),
    deactivateItem: mock(),
    activateBlock: mock(),
    activateEntity: mock(),
    toss: mock(),
    clickWindow: mock(),
    look: mock(),
    craft: mock(),
  };
}

describe('EquipTask', () => {
  it('should create for hand slot', () => {
    const bot = createMockBot();
    const task = new EquipTask(bot, 'diamond_sword', EquipmentSlot.HAND);
    expect(task.displayName).toContain('Equip');
  });

  it('should create for off-hand', () => {
    const bot = createMockBot();
    const task = new EquipTask(bot, 'shield', EquipmentSlot.OFF_HAND);
    expect(task.displayName).toContain('Equip');
  });

  it('should create for armor slots', () => {
    const bot = createMockBot();
    const helmet = new EquipTask(bot, 'diamond_helmet', EquipmentSlot.HEAD);
    const chest = new EquipTask(bot, 'diamond_chestplate', EquipmentSlot.CHEST);
    const legs = new EquipTask(bot, 'diamond_leggings', EquipmentSlot.LEGS);
    const boots = new EquipTask(bot, 'diamond_boots', EquipmentSlot.FEET);

    expect(helmet.displayName).toContain('Equip');
    expect(chest.displayName).toContain('Equip');
    expect(legs.displayName).toContain('Equip');
    expect(boots.displayName).toContain('Equip');
  });
});
