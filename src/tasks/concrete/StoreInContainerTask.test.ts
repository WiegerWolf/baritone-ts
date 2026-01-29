/**
 * StoreInContainerTask Tests
 *
 * Tests for storing items into containers.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
      metadata: {},
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
    pathfinder: {
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
    clickWindow: mock(),
    closeWindow: mock(),
    ...overrides,
  };

  // Make position have proper Vec3 methods
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  return baseBot;
}

import {
  StoreInContainerTask,
  containerItemTarget,
  storeInContainer,
} from './StorageContainerTask';

describe('StoreInContainerTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  /**
   * WHY: StoreInContainerTask enables automated item storage.
   * This is essential for:
   * - Organizing items into storage systems
   * - Depositing collected resources at base
   * - Managing inventory space during exploration
   */
  const containerPos = new BlockPos(10, 64, 10);

  it('should create task with container position and targets', () => {
    const task = new StoreInContainerTask(
      bot,
      containerPos,
      containerItemTarget('cobblestone', 64)
    );

    expect(task.displayName).toContain('StoreInContainer');
  });

  it('should not be finished initially', () => {
    const task = new StoreInContainerTask(
      bot,
      containerPos,
      containerItemTarget('cobblestone', 64)
    );

    // Haven't stored anything yet
    expect(task.isFinished()).toBe(false);
  });

  it('should handle multiple storage targets', () => {
    const task = new StoreInContainerTask(
      bot,
      containerPos,
      containerItemTarget('cobblestone', 64),
      containerItemTarget('dirt', 64)
    );

    expect(task.isFinished()).toBe(false);
  });
});

describe('storeInContainer convenience function', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  const containerPos = new BlockPos(10, 64, 10);

  it('storeInContainer should create task with items', () => {
    const task = storeInContainer(
      bot,
      containerPos,
      { item: 'cobblestone', count: 64 }
    );

    expect(task).toBeInstanceOf(StoreInContainerTask);
  });
});
