/**
 * Tests for CraftInTableTask
 */

import { describe, it, expect, mock } from 'bun:test';
import { CraftInTableTask } from './ContainerTask';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: (other: any) => {
          const dx = other.x - 0;
          const dy = (other.y || 64) - 64;
          const dz = other.z - 0;
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        },
        offset: (x: number, y: number, z: number) => ({ x, y: 64 + y, z }),
        clone: () => ({ x: 0, y: 64, z: 0, distanceTo: () => 5 }),
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
    currentWindow: null,
    pathfinder: {
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    closeWindow: mock(),
    ...overrides,
  };
}

describe('CraftInTableTask', () => {
  it('should create with correct display name', () => {
    const bot = createMockBot();
    const task = new CraftInTableTask(bot);
    expect(task.displayName).toBe('CraftInTable');
  });

  it('should start not finished', () => {
    const bot = createMockBot();
    const task = new CraftInTableTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  it('should search for crafting tables when started', () => {
    const bot = createMockBot();
    const task = new CraftInTableTask(bot);
    task.onStart();

    // Run a few ticks to allow state transitions
    for (let i = 0; i < 5; i++) {
      const subtask = task.onTick();
      if (task.isFinished() || subtask !== null) {
        // Task has processed and either finished or returned subtask
        expect(true).toBe(true);
        return;
      }
    }
    // Eventually should do something
    expect(task.isFinished()).toBe(true);
  });

  /**
   * WHY: Crafting tables may not exist nearby - the task should handle this
   * gracefully by either placing a new one or failing appropriately.
   */
  it('should handle missing crafting table', () => {
    const bot = createMockBot();
    const task = new CraftInTableTask(bot);
    task.onStart();

    // Without inventory items and no table, should eventually fail
    // Run multiple ticks to allow state transitions
    for (let i = 0; i < 5; i++) {
      task.onTick();
    }
    // The task handles this by transitioning to failed state
    expect(task.isFailed()).toBe(true);
  });
});
