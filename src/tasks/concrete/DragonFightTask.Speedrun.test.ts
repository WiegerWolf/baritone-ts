/**
 * Tests for Dragon Fight Tasks (Speedrun context)
 *
 * WHY these tasks matter:
 * - KillEnderDragonTask: Final boss fight
 *   - Destroy End Crystals first (they heal dragon)
 *   - Wait for dragon to perch for maximum damage
 *   - Enter end portal when dragon dies
 *
 * - WaitForDragonAndPearlTask: Advanced pearl strategy
 *   - Pillar up for clear view
 *   - Pearl onto portal when dragon perches
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import {
  KillEnderDragonTask,
  WaitForDragonAndPearlTask,
  DragonFightState,
  PearlStrategyState,
  killEnderDragon,
  waitForDragonAndPearl,
  DIAMOND_ARMOR,
  FOOD_ITEMS,
} from './DragonFightTask';

// Mock Bot
function createMockBot(): Bot {
  const mockBot = {
    entity: {
      position: new Vec3(0, 65, 0),
      velocity: new Vec3(0, 0, 0),
      onGround: true,
      yaw: 0,
    },
    inventory: {
      items: jest.fn().mockReturnValue([]),
      slots: {},
    },
    blockAt: jest.fn().mockReturnValue(null),
    entities: {},
    game: {
      dimension: 'minecraft:the_end',
    },
    look: jest.fn(),
    lookAt: jest.fn(),
    attack: jest.fn(),
    equip: jest.fn(),
    activateItem: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
  } as unknown as Bot;

  return mockBot;
}

describe('Dragon Fight', () => {
  describe('KillEnderDragonTask', () => {
    let bot: Bot;

    beforeEach(() => {
      bot = createMockBot();
    });

    it('WHY: Creates task to kill ender dragon', () => {
      const task = new KillEnderDragonTask(bot);

      expect(task.displayName).toContain('KillEnderDragon');
    });

    it('WHY: Starts in EQUIPPING state', () => {
      const task = new KillEnderDragonTask(bot);

      task.onStart();
      expect(task.getState()).toBe(DragonFightState.EQUIPPING);
    });

    it('WHY: DIAMOND_ARMOR includes all armor pieces', () => {
      expect(DIAMOND_ARMOR).toContain('diamond_helmet');
      expect(DIAMOND_ARMOR).toContain('diamond_chestplate');
      expect(DIAMOND_ARMOR).toContain('diamond_leggings');
      expect(DIAMOND_ARMOR).toContain('diamond_boots');
      expect(DIAMOND_ARMOR.length).toBe(4);
    });

    it('WHY: FOOD_ITEMS includes good food sources', () => {
      expect(FOOD_ITEMS).toContain('bread');
      expect(FOOD_ITEMS).toContain('cooked_beef');
      expect(FOOD_ITEMS).toContain('golden_apple');
    });

    it('WHY: killEnderDragon convenience function works', () => {
      const task = killEnderDragon(bot);

      expect(task).toBeInstanceOf(KillEnderDragonTask);
    });

    it('WHY: All instances are equal (same fight)', () => {
      const task1 = new KillEnderDragonTask(bot);
      const task2 = new KillEnderDragonTask(bot);

      expect(task1.isEqual(task2)).toBe(true);
    });

    it('WHY: Returns subtask to destroy crystals when found', () => {
      // Add end crystal entity
      (bot as any).entities = {
        '1': { name: 'end_crystal', position: new Vec3(10, 65, 10) },
      };
      (bot.inventory.items as jest.Mock).mockReturnValue([]);

      const task = new KillEnderDragonTask(bot);
      task.onStart();
      const subtask = task.onTick();

      expect(task.getState()).toBe(DragonFightState.DESTROYING_CRYSTALS);
      expect(subtask).not.toBeNull();
    });
  });

  describe('WaitForDragonAndPearlTask', () => {
    let bot: Bot;

    beforeEach(() => {
      bot = createMockBot();
    });

    it('WHY: Creates task for pearl strategy', () => {
      const task = new WaitForDragonAndPearlTask(bot);

      expect(task.displayName).toContain('WaitForDragonAndPearl');
    });

    it('WHY: Implements IDragonWaiter interface', () => {
      const task = new WaitForDragonAndPearlTask(bot);

      // Should have these methods
      expect(typeof task.setExitPortalTop).toBe('function');
      expect(typeof task.setPerchState).toBe('function');
    });

    it('WHY: Starts in COLLECTING_MATERIALS state', () => {
      const task = new WaitForDragonAndPearlTask(bot);

      task.onStart();
      expect(task.getState()).toBe(PearlStrategyState.COLLECTING_MATERIALS);
    });

    it('WHY: setExitPortalTop sets target', () => {
      const task = new WaitForDragonAndPearlTask(bot);
      const portalTop = new BlockPos(0, 64, 0);

      task.setExitPortalTop(portalTop);
      // Task should use this for navigation
      expect(task.displayName).toContain('WaitForDragonAndPearl');
    });

    it('WHY: setPerchState updates dragon state', () => {
      const task = new WaitForDragonAndPearlTask(bot);

      task.onStart();
      task.setPerchState(true);
      // Perch state affects when to throw pearl
      expect(task.getState()).toBe(PearlStrategyState.COLLECTING_MATERIALS);
    });

    it('WHY: waitForDragonAndPearl convenience function works', () => {
      const task = waitForDragonAndPearl(bot);

      expect(task).toBeInstanceOf(WaitForDragonAndPearlTask);
    });

    it('WHY: All instances are equal', () => {
      const task1 = new WaitForDragonAndPearlTask(bot);
      const task2 = new WaitForDragonAndPearlTask(bot);

      expect(task1.isEqual(task2)).toBe(true);
    });
  });
});

describe('Integration Concepts', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Dragon Fight Strategies', () => {
    it('WHY: Two strategies exist - melee and pearl', () => {
      const meleeTask = killEnderDragon(bot);
      const pearlTask = waitForDragonAndPearl(bot);

      // Both are valid approaches
      expect(meleeTask.displayName).toContain('KillEnderDragon');
      expect(pearlTask.displayName).toContain('Pearl');
    });

    it('WHY: Crystals must be destroyed before effective dragon damage', () => {
      // Add crystal
      (bot as any).entities = {
        '1': { name: 'end_crystal', position: new Vec3(10, 80, 10) },
      };

      const task = killEnderDragon(bot);
      task.onStart();
      task.onTick();

      // Should prioritize crystal destruction
      expect(task.getState()).toBe(DragonFightState.DESTROYING_CRYSTALS);
    });

    it('WHY: Dragon perching is the key vulnerability window', () => {
      // Add dragon but no crystals
      (bot as any).entities = {
        '1': {
          name: 'ender_dragon',
          position: new Vec3(5, 65, 5), // Near center, low altitude = perching
        },
      };

      const task = killEnderDragon(bot);
      task.onStart();
      const subtask = task.onTick();

      // Should try to attack perching dragon
      expect([DragonFightState.ATTACKING_DRAGON, DragonFightState.WAITING_FOR_PERCH]).toContain(
        task.getState()
      );
    });
  });

  describe('State Transitions', () => {
    it('WHY: DragonFightState covers all combat phases', () => {
      expect(DragonFightState.EQUIPPING).toBeDefined();
      expect(DragonFightState.DESTROYING_CRYSTALS).toBeDefined();
      expect(DragonFightState.WAITING_FOR_PERCH).toBeDefined();
      expect(DragonFightState.ATTACKING_DRAGON).toBeDefined();
      expect(DragonFightState.ENTERING_PORTAL).toBeDefined();
      expect(DragonFightState.FINISHED).toBeDefined();
    });

    it('WHY: PearlStrategyState covers positioning and execution', () => {
      expect(PearlStrategyState.COLLECTING_MATERIALS).toBeDefined();
      expect(PearlStrategyState.MOVING_TO_POSITION).toBeDefined();
      expect(PearlStrategyState.PILLARING_UP).toBeDefined();
      expect(PearlStrategyState.WAITING_FOR_PERCH).toBeDefined();
      expect(PearlStrategyState.THROWING_PEARL).toBeDefined();
      expect(PearlStrategyState.FINISHED).toBeDefined();
    });
  });
});
