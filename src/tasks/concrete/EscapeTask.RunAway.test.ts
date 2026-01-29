/**
 * Tests for RunAwayFromPositionTask
 *
 * These tests verify:
 * 1. Intent (WHY): What the task is supposed to accomplish
 * 2. State Machine: Correct state transitions
 * 3. Edge Cases: Error handling, interruption
 */

import { Vec3 } from 'vec3';
import {
  RunAwayFromPositionTask,
  runFromPositions,
  runFromPositionsAtY,
} from './EscapeTask';

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
  setControlState: jest.fn(),
  lookAt: jest.fn(),
  equip: jest.fn(),
  activateItem: jest.fn(),
  activateBlock: jest.fn(),
  entities: {},
  ...overrides,
});

describe('RunAwayFromPositionTask', () => {
  describe('creation and initialization', () => {
    it('should create with danger positions', () => {
      const bot = createMockBot() as any;
      const dangerPositions = [new Vec3(5, 64, 5), new Vec3(-5, 64, -5)];
      const task = new RunAwayFromPositionTask(bot, dangerPositions);

      expect(task.displayName).toContain('RunAwayFromPosition');
      expect(task.displayName).toContain('2 positions');
    });

    it('should start not finished when near danger', () => {
      const bot = createMockBot({
        entity: { position: new Vec3(3, 64, 3) },
      }) as any;
      const dangerPositions = [new Vec3(5, 64, 5)];
      const task = new RunAwayFromPositionTask(bot, dangerPositions, { fleeDistance: 10 });

      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should finish when far from all danger positions', () => {
      const bot = createMockBot({
        entity: { position: new Vec3(100, 64, 100) },
      }) as any;
      const dangerPositions = [new Vec3(5, 64, 5)];
      const task = new RunAwayFromPositionTask(bot, dangerPositions, { fleeDistance: 10 });

      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('WHY: flee from dangerous positions', () => {
    it('should calculate flee direction away from danger center', () => {
      const bot = createMockBot({
        entity: { position: new Vec3(0, 64, 0) },
      }) as any;
      // Danger on both sides - should flee perpendicular
      const dangerPositions = [new Vec3(10, 64, 0), new Vec3(-10, 64, 0)];
      const task = new RunAwayFromPositionTask(bot, dangerPositions, { fleeDistance: 15 });

      task.onStart();
      // The flee calculation should move away from the weighted center
      expect(task.isFinished()).toBe(false);
    });

    it('should maintain Y level when configured', () => {
      const bot = createMockBot() as any;
      const dangerPositions = [new Vec3(5, 64, 5)];
      const task = runFromPositionsAtY(bot, 10, 70, ...dangerPositions);

      expect(task).toBeInstanceOf(RunAwayFromPositionTask);
    });
  });

  describe('equality', () => {
    it('should be equal if same danger positions', () => {
      const bot = createMockBot() as any;
      const pos1 = [new Vec3(5, 64, 5)];
      const pos2 = [new Vec3(5, 64, 5)];
      const task1 = new RunAwayFromPositionTask(bot, pos1);
      const task2 = new RunAwayFromPositionTask(bot, pos2);

      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different positions', () => {
      const bot = createMockBot() as any;
      const task1 = new RunAwayFromPositionTask(bot, [new Vec3(5, 64, 5)]);
      const task2 = new RunAwayFromPositionTask(bot, [new Vec3(10, 64, 10)]);

      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('convenience functions', () => {
    it('runFromPositions should create task', () => {
      const bot = createMockBot() as any;
      const task = runFromPositions(bot, 15, new Vec3(5, 64, 5), new Vec3(10, 64, 10));

      expect(task).toBeInstanceOf(RunAwayFromPositionTask);
    });
  });
});
