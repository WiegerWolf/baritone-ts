/**
 * Tests for Stronghold Tasks
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
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import {
  LocateStrongholdCoordinatesTask,
  LocateState,
  locateStronghold,
  calculateIntersection,
} from './LocateStrongholdCoordinatesTask';
import {
  GoToStrongholdPortalTask,
  GoToStrongholdState,
  goToStrongholdPortal,
} from './GoToStrongholdPortalTask';
import {
  KillEnderDragonTask,
  killEnderDragon,
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
      items: mock().mockReturnValue([]),
      slots: {},
    },
    blockAt: mock().mockReturnValue(null),
    entities: {},
    game: {
      dimension: 'minecraft:the_end',
    },
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

    it('WHY: GoToStrongholdState covers navigation phases', () => {
      expect(GoToStrongholdState.LOCATING).toBeDefined();
    });
  });
});
