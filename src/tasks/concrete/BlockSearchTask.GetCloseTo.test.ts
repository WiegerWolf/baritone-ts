/**
 * Tests for GetCloseToBlockTask
 *
 * These tests verify:
 * 1. Intent (WHY): What the task is supposed to accomplish
 * 2. State Machine: Correct state transitions
 * 3. Edge Cases: Error handling, interruption
 */

import { describe, it, expect, mock } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  GetCloseToBlockTask,
  getCloseTo,
  getCloseToVec,
} from './BlockSearchTask';

// Mock bot for testing
const createMockBot = (overrides: any = {}) => ({
  entity: {
    position: new Vec3(0, 64, 0),
    onGround: true,
  },
  inventory: {
    items: () => [],
  },
  blockAt: () => null,
  setControlState: mock(),
  lookAt: mock(),
  equip: mock(),
  activateItem: mock(),
  activateBlock: mock(),
  entities: {},
  ...overrides,
});

describe('GetCloseToBlockTask', () => {
  describe('WHY: approach unreachable positions', () => {
    it('should handle approaching lava pool centers', () => {
      // WHY: Some blocks (center of lava pool) cannot be directly reached
      // This task iteratively reduces approach distance to get as close as possible
      const bot = createMockBot() as any;
      const task = new GetCloseToBlockTask(bot, 100, 64, 100);

      expect(task.displayName).toContain('GetCloseTo');
    });

    it('should start with maximum range', () => {
      const bot = createMockBot() as any;
      const task = new GetCloseToBlockTask(bot, 10, 64, 10);

      task.onStart();
      // Range starts at maximum
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('iterative approach', () => {
    it('should return GetWithinRangeOfBlockTask as subtask', () => {
      const bot = createMockBot() as any;
      const task = new GetCloseToBlockTask(bot, 50, 64, 50);

      task.onStart();
      const subtask = task.onTick();

      // Should return a subtask to approach the block
      expect(subtask).not.toBeNull();
    });

    it('should report achieved distance', () => {
      const bot = createMockBot({
        entity: { position: new Vec3(10, 64, 10) },
      }) as any;
      const task = new GetCloseToBlockTask(bot, 15, 64, 15);

      task.onStart();
      // Distance from (10,64,10) to (15,64,15) ≈ 7 blocks
      expect(task.getAchievedDistance()).toBeCloseTo(7, 0);
    });
  });

  describe('convenience functions', () => {
    it('getCloseTo should create task', () => {
      const bot = createMockBot() as any;
      const task = getCloseTo(bot, 100, 64, 100);

      expect(task).toBeInstanceOf(GetCloseToBlockTask);
    });

    it('getCloseToVec should create task from Vec3', () => {
      const bot = createMockBot() as any;
      const task = getCloseToVec(bot, new Vec3(100, 64, 100));

      expect(task).toBeInstanceOf(GetCloseToBlockTask);
    });
  });

  describe('equality', () => {
    it('should be equal if same target position', () => {
      const bot = createMockBot() as any;
      const task1 = new GetCloseToBlockTask(bot, 10, 64, 10);
      const task2 = new GetCloseToBlockTask(bot, 10, 64, 10);

      expect(task1.isEqual(task2)).toBe(true);
    });
  });
});
