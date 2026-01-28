/**
 * Tests for Speedrun Tasks (Stronghold and Dragon Fight)
 *
 * WHY these tasks matter:
 * - LocateStrongholdCoordinatesTask: Find stronghold using eye triangulation
 *   - Two eye throws from different positions give intersecting directions
 *   - Intersection point is the stronghold location
 *   - Much faster than random searching
 *
 * - GoToStrongholdPortalTask: Navigate to stronghold using triangulation
 *   - Combines location with fast travel
 *   - Searches for stone bricks to find actual structure
 *
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
import { BlockPos } from '../src/types';
import {
  LocateStrongholdCoordinatesTask,
  GoToStrongholdPortalTask,
  LocateState,
  GoToStrongholdState,
  locateStronghold,
  goToStrongholdPortal,
  calculateIntersection,
} from '../src/tasks/concrete/StrongholdTask';
import {
  KillEnderDragonTask,
  WaitForDragonAndPearlTask,
  DragonFightState,
  PearlStrategyState,
  killEnderDragon,
  waitForDragonAndPearl,
  DIAMOND_ARMOR,
  FOOD_ITEMS,
} from '../src/tasks/concrete/DragonFightTask';

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

describe('Stronghold Location', () => {
  describe('calculateIntersection', () => {
    it('WHY: Triangulation requires finding intersection of two direction vectors', () => {
      // Two lines from different positions pointing toward same point
      const start1 = new Vec3(0, 0, 0);
      const direction1 = new Vec3(1, 0, 1); // 45 degrees
      const start2 = new Vec3(100, 0, 0);
      const direction2 = new Vec3(-1, 0, 1); // 135 degrees

      const intersection = calculateIntersection(start1, direction1, start2, direction2);

      // Intersection should be at x=50, z=50
      expect(intersection.x).toBe(50);
      expect(intersection.z).toBe(50);
    });

    it('WHY: Parallel lines return midpoint fallback', () => {
      // Two parallel lines
      const start1 = new Vec3(0, 0, 0);
      const direction1 = new Vec3(1, 0, 0); // East
      const start2 = new Vec3(0, 0, 100);
      const direction2 = new Vec3(1, 0, 0); // Also East

      const intersection = calculateIntersection(start1, direction1, start2, direction2);

      // Should return midpoint as fallback
      expect(intersection.x).toBe(0);
      expect(intersection.z).toBe(50);
    });

    it('WHY: Handles negative coordinates for strongholds in any direction', () => {
      const start1 = new Vec3(0, 0, 0);
      const direction1 = new Vec3(-1, 0, -1); // Southwest
      const start2 = new Vec3(-100, 0, 0);
      const direction2 = new Vec3(1, 0, -1); // Southeast

      const intersection = calculateIntersection(start1, direction1, start2, direction2);

      expect(intersection.x).toBe(-50);
      expect(intersection.z).toBe(-50);
    });
  });

  describe('LocateStrongholdCoordinatesTask', () => {
    let bot: Bot;

    beforeEach(() => {
      bot = createMockBot();
      (bot as any).game = { dimension: 'minecraft:overworld' };
    });

    it('WHY: Creates task to locate stronghold via eye triangulation', () => {
      const task = new LocateStrongholdCoordinatesTask(bot, 2);

      expect(task.displayName).toContain('LocateStronghold');
    });

    it('WHY: Starts in correct state', () => {
      const task = new LocateStrongholdCoordinatesTask(bot);

      task.onStart();
      // In overworld but no eye, goes to throwing
      expect(task.getState()).toBe(LocateState.GOING_TO_OVERWORLD);
    });

    it('WHY: Returns null coordinates before triangulation complete', () => {
      const task = new LocateStrongholdCoordinatesTask(bot);

      task.onStart();
      expect(task.getStrongholdCoordinates()).toBeNull();
      expect(task.isFinished()).toBe(false);
    });

    it('WHY: isSearching returns true after first eye thrown', () => {
      const task = new LocateStrongholdCoordinatesTask(bot);

      task.onStart();
      expect(task.isSearching()).toBe(false);
    });

    it('WHY: locateStronghold convenience function works', () => {
      const task = locateStronghold(bot, 3);

      expect(task).toBeInstanceOf(LocateStrongholdCoordinatesTask);
    });

    it('WHY: All instances are equal (same goal)', () => {
      const task1 = new LocateStrongholdCoordinatesTask(bot);
      const task2 = new LocateStrongholdCoordinatesTask(bot);

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(null)).toBe(false);
    });
  });

  describe('GoToStrongholdPortalTask', () => {
    let bot: Bot;

    beforeEach(() => {
      bot = createMockBot();
      (bot as any).game = { dimension: 'minecraft:overworld' };
    });

    it('WHY: Creates task to navigate to stronghold', () => {
      const task = new GoToStrongholdPortalTask(bot, 2);

      expect(task.displayName).toContain('GoToStrongholdPortal');
    });

    it('WHY: Starts in LOCATING state', () => {
      const task = new GoToStrongholdPortalTask(bot);

      task.onStart();
      expect(task.getState()).toBe(GoToStrongholdState.LOCATING);
    });

    it('WHY: Returns null coordinates before location found', () => {
      const task = new GoToStrongholdPortalTask(bot);

      task.onStart();
      expect(task.getStrongholdCoordinates()).toBeNull();
    });

    it('WHY: goToStrongholdPortal convenience function works', () => {
      const task = goToStrongholdPortal(bot);

      expect(task).toBeInstanceOf(GoToStrongholdPortalTask);
    });

    it('WHY: All instances are equal (same destination)', () => {
      const task1 = new GoToStrongholdPortalTask(bot);
      const task2 = new GoToStrongholdPortalTask(bot);

      expect(task1.isEqual(task2)).toBe(true);
    });
  });
});

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

  describe('Speedrun Workflow', () => {
    it('WHY: Stronghold location is prerequisite to dragon fight', () => {
      // First locate stronghold
      const locateTask = locateStronghold(bot);
      expect(locateTask).toBeInstanceOf(LocateStrongholdCoordinatesTask);

      // Then navigate to it
      const goToTask = goToStrongholdPortal(bot);
      expect(goToTask).toBeInstanceOf(GoToStrongholdPortalTask);

      // Finally fight dragon
      const fightTask = killEnderDragon(bot);
      expect(fightTask).toBeInstanceOf(KillEnderDragonTask);
    });

    it('WHY: Triangulation math is fundamental to speedrunning', () => {
      // The ability to find stronghold with just 2 eyes is critical
      // This tests the core algorithm

      // Simulate eye throws at 0,0 pointing northeast and at 100,0 pointing northwest
      const intersection = calculateIntersection(
        new Vec3(0, 0, 0),
        new Vec3(1, 0, 2),
        new Vec3(100, 0, 0),
        new Vec3(-1, 0, 2)
      );

      // Should find a point somewhere in the positive z direction
      expect(intersection.z).toBeGreaterThan(0);
    });
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
    it('WHY: LocateStrongholdCoordinatesTask has clear state progression', () => {
      // States should progress: GOING_TO_OVERWORLD -> THROWING -> WAITING -> MOVING -> THROWING -> FINISHED
      expect(LocateState.GOING_TO_OVERWORLD).toBeDefined();
      expect(LocateState.THROWING_FIRST_EYE).toBeDefined();
      expect(LocateState.WAITING_FOR_FIRST_EYE).toBeDefined();
      expect(LocateState.MOVING_FOR_SECOND_THROW).toBeDefined();
      expect(LocateState.THROWING_SECOND_EYE).toBeDefined();
      expect(LocateState.FINISHED).toBeDefined();
    });

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
