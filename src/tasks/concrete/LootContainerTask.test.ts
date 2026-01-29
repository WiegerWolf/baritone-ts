/**
 * LootContainerTask Tests
 *
 * Tests for looting all items from containers, including
 * integration scenarios for loot-and-store workflows.
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
  LootContainerTask,
  StoreInContainerTask,
  lootContainer,
  storeInContainer,
} from './StorageContainerTask';

describe('LootContainerTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  /**
   * WHY: LootContainerTask is a simplified version for quickly grabbing
   * all items from a container. Useful for speedruns and exploration.
   */
  const containerPos = new BlockPos(10, 64, 10);

  it('should create task with container position', () => {
    const task = new LootContainerTask(bot, containerPos);
    expect(task.displayName).toContain('LootContainer');
  });

  it('should accept custom item filter', () => {
    const filter = (name: string) => name.includes('diamond');
    const task = new LootContainerTask(bot, containerPos, filter);
    expect(task).toBeDefined();
  });

  it('should not be finished until looting complete', () => {
    const task = new LootContainerTask(bot, containerPos);
    expect(task.isFinished()).toBe(false);
  });
});

describe('lootContainer convenience function', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  const containerPos = new BlockPos(10, 64, 10);

  it('lootContainer should create task', () => {
    const task = lootContainer(bot, containerPos);
    expect(task).toBeInstanceOf(LootContainerTask);
  });
});

describe('Integration scenarios', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Storage workflow', () => {
    /**
     * WHY: This tests a typical workflow where a bot:
     * 1. Loots a chest
     * 2. Stores items in a different chest
     */
    it('should create tasks for loot-and-store workflow', () => {
      const sourceChest = new BlockPos(10, 64, 10);
      const destChest = new BlockPos(20, 64, 20);

      // Loot from source
      const lootTask = lootContainer(bot, sourceChest);
      expect(lootTask).toBeInstanceOf(LootContainerTask);

      // Store in destination
      const storeTask = storeInContainer(bot, destChest, {
        item: 'diamond',
        count: 64,
      });
      expect(storeTask).toBeInstanceOf(StoreInContainerTask);
    });
  });
});
