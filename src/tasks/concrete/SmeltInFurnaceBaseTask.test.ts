/**
 * Tests for SmeltInFurnaceBaseTask
 */

import { describe, it, expect, mock } from 'bun:test';
import { SmeltInFurnaceBaseTask } from './ContainerTask';

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

describe('SmeltInFurnaceBaseTask', () => {
  it('should create for regular furnace', () => {
    const bot = createMockBot();
    const task = new SmeltInFurnaceBaseTask(bot, 'furnace');
    expect(task.displayName).toContain('furnace');
  });

  it('should create for blast furnace', () => {
    const bot = createMockBot();
    const task = new SmeltInFurnaceBaseTask(bot, 'blast_furnace');
    expect(task.displayName).toContain('blast_furnace');
  });

  it('should create for smoker', () => {
    const bot = createMockBot();
    const task = new SmeltInFurnaceBaseTask(bot, 'smoker');
    expect(task.displayName).toContain('smoker');
  });

  /**
   * WHY: Different furnace types smelt different items.
   * Blast furnace = ores, smoker = food. Regular furnace = both.
   */
  it('should start not finished', () => {
    const bot = createMockBot();
    const task = new SmeltInFurnaceBaseTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });
});
