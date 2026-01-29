/**
 * Tests for PutOutFireTask
 *
 * These tests verify that fire extinguishing works correctly:
 * - WHY: Fire can spread and damage the player and structures.
 *   The task must detect fire and delegate to block destruction.
 * - INTENT: Validate fire detection, delegation to DestroyBlockTask, and completion logic.
 */

import { describe, it, expect, mock } from 'bun:test';
import { PutOutFireTask } from './ConstructionTask';
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

describe('PutOutFireTask', () => {
  it('should create with target position', () => {
    const bot = createMockBot();
    const task = new PutOutFireTask(bot, 10, 64, 10);
    expect(task.displayName).toContain('PutOutFire');
  });

  /**
   * WHY: Fire can be broken like any block. If it's not there,
   * we're done.
   */
  it('should finish if no fire at position', () => {
    const bot = createMockBot({
      blockAt: () => ({ name: 'air', boundingBox: 'empty' }),
    });

    const task = new PutOutFireTask(bot, 10, 64, 10);
    task.onStart();
    task.onTick();
    expect(task.isFinished()).toBe(true);
  });

  it('should create DestroyBlockTask for fire', () => {
    const bot = createMockBot({
      blockAt: () => ({ name: 'fire', boundingBox: 'empty', position: new Vec3(10, 64, 10) }),
    });

    const task = new PutOutFireTask(bot, 10, 64, 10);
    task.onStart();
    const subtask = task.onTick();

    // Should return a destroy task
    expect(subtask).not.toBeNull();
    expect(subtask?.displayName).toContain('Destroy');
  });

  describe('equality', () => {
    it('should be equal if same position', () => {
      const bot = createMockBot();
      const task1 = new PutOutFireTask(bot, 10, 64, 10);
      const task2 = new PutOutFireTask(bot, 10, 64, 10);
      expect(task1.isEqual(task2)).toBe(true);
    });
  });
});
