import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import {
  CarveThenCollectTask,
  CarveState,
  collectCarvedPumpkins,
} from './MiscTask';
import { itemTarget } from './ResourceTask';

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

describe('Carving Workflow', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

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
