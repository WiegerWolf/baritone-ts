/**
 * Tests for ClearLiquidTask
 *
 * These tests verify that liquid clearing works correctly:
 * - WHY: Clearing liquids (water, lava) is needed for safe navigation
 *   and construction in Minecraft.
 * - INTENT: Validate liquid detection, placement delegation, and completion logic.
 */

import { describe, it, expect, mock } from 'bun:test';
import { ClearLiquidTask } from './ConstructionTask';
import { Vec3 } from 'vec3';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: (pos: Vec3) => null,
    blockAtCursor: () => null,
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
    dig: mock().mockResolvedValue(undefined),
    stopDigging: mock(),
    placeBlock: mock().mockResolvedValue(undefined),
    equip: mock().mockResolvedValue(undefined),
    look: mock(),
    ...overrides,
  };

  // Make position have proper Vec3 methods
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  baseBot.entity.position.clone = () => new Vec3(
    baseBot.entity.position.x,
    baseBot.entity.position.y,
    baseBot.entity.position.z
  );

  return baseBot;
}

describe('ClearLiquidTask', () => {
  it('should create with target position', () => {
    const bot = createMockBot();
    const task = new ClearLiquidTask(bot, 10, 64, 10);
    expect(task.displayName).toContain('ClearLiquid');
  });

  /**
   * WHY: If the liquid is already cleared (no longer there),
   * the task should complete immediately.
   */
  it('should finish if no liquid at position', () => {
    const bot = createMockBot({
      blockAt: () => ({ name: 'air', boundingBox: 'empty' }),
    });

    const task = new ClearLiquidTask(bot, 10, 64, 10);
    task.onStart();
    task.onTick();
    expect(task.isFinished()).toBe(true);
  });

  it('should create PlaceBlockNearbyTask for liquid', () => {
    const bot = createMockBot({
      blockAt: () => ({ name: 'water', boundingBox: 'empty' }),
      inventory: {
        items: () => [{ name: 'cobblestone', slot: 0 }],
        slots: {},
      },
    });

    const task = new ClearLiquidTask(bot, 10, 64, 10, 'cobblestone');
    task.onStart();
    const subtask = task.onTick();

    // Should return a place task
    expect(subtask).not.toBeNull();
  });

  it('should handle lava', () => {
    const bot = createMockBot({
      blockAt: () => ({ name: 'lava', boundingBox: 'empty' }),
      inventory: {
        items: () => [{ name: 'cobblestone', slot: 0 }],
        slots: {},
      },
    });

    const task = new ClearLiquidTask(bot, 10, 64, 10);
    task.onStart();
    const subtask = task.onTick();

    expect(subtask).not.toBeNull();
  });

  describe('equality', () => {
    it('should be equal if same position', () => {
      const bot = createMockBot();
      const task1 = new ClearLiquidTask(bot, 10, 64, 10);
      const task2 = new ClearLiquidTask(bot, 10, 64, 10);
      expect(task1.isEqual(task2)).toBe(true);
    });
  });
});
