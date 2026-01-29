/**
 * PickupFromContainerTask Tests
 *
 * Tests for item pickup from containers, including helper functions
 * for creating item targets and matching items against targets.
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

// Mock item for testing
function createMockItem(name: string, count: number): any {
  return { name, count };
}

import {
  PickupFromContainerTask,
  containerItemTarget,
  itemMatchesTarget,
  pickupFromContainer,
} from './StorageContainerTask';

describe('containerItemTarget helper', () => {
  /**
   * WHY: containerItemTarget creates a structured target for item operations.
   * This enables type-safe, consistent item targeting across all container tasks.
   */
  it('should create target with single item', () => {
    const target = containerItemTarget('diamond', 10);
    expect(target.items).toBe('diamond');
    expect(target.targetCount).toBe(10);
  });

  it('should create target with multiple items', () => {
    const target = containerItemTarget(['oak_planks', 'spruce_planks'], 20);
    expect(target.items).toEqual(['oak_planks', 'spruce_planks']);
    expect(target.targetCount).toBe(20);
  });
});

describe('itemMatchesTarget helper', () => {
  /**
   * WHY: itemMatchesTarget provides flexible item matching that handles
   * both exact names and partial matches (useful for wood variants, etc.).
   */
  it('should match exact item name', () => {
    const target = containerItemTarget('diamond', 10);
    expect(itemMatchesTarget('diamond', target)).toBe(true);
    expect(itemMatchesTarget('emerald', target)).toBe(false);
  });

  it('should match partial item name', () => {
    const target = containerItemTarget('planks', 10);
    expect(itemMatchesTarget('oak_planks', target)).toBe(true);
    expect(itemMatchesTarget('spruce_planks', target)).toBe(true);
  });

  it('should match from array of items', () => {
    const target = containerItemTarget(['coal', 'charcoal'], 10);
    expect(itemMatchesTarget('coal', target)).toBe(true);
    expect(itemMatchesTarget('charcoal', target)).toBe(true);
    expect(itemMatchesTarget('iron_ore', target)).toBe(false);
  });
});

describe('PickupFromContainerTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  /**
   * WHY: PickupFromContainerTask enables automated item retrieval from containers.
   * This is essential for:
   * - Restocking supplies from base chests
   * - Looting dungeon/temple chests
   * - Collecting smelted items from furnaces
   */
  const containerPos = new BlockPos(10, 64, 10);

  it('should create task with container position and targets', () => {
    const task = new PickupFromContainerTask(
      bot,
      containerPos,
      containerItemTarget('diamond', 5)
    );

    expect(task.displayName).toContain('PickupFromContainer');
    expect(task.displayName).toContain('10');
  });

  it('should not be finished initially when inventory is empty', () => {
    const task = new PickupFromContainerTask(
      bot,
      containerPos,
      containerItemTarget('diamond', 5)
    );

    // Empty inventory, hasn't collected anything yet
    expect(task.isFinished()).toBe(false);
  });

  it('should be finished when inventory has target items', () => {
    // Add items to inventory
    (bot.inventory as any).items = () => [
      createMockItem('diamond', 10)
    ];

    const task = new PickupFromContainerTask(
      bot,
      containerPos,
      containerItemTarget('diamond', 5)
    );

    expect(task.isFinished()).toBe(true);
  });

  it('should handle multiple targets', () => {
    const task = new PickupFromContainerTask(
      bot,
      containerPos,
      containerItemTarget('diamond', 5),
      containerItemTarget('emerald', 3)
    );

    // No items yet
    expect(task.isFinished()).toBe(false);
  });

  it('should be equal if same position and targets', () => {
    const task1 = new PickupFromContainerTask(
      bot,
      containerPos,
      containerItemTarget('diamond', 5)
    );
    const task2 = new PickupFromContainerTask(
      bot,
      containerPos,
      containerItemTarget('diamond', 5)
    );

    expect(task1.isEqual(task2)).toBe(true);
  });

  it('should not be equal if different position', () => {
    const task1 = new PickupFromContainerTask(
      bot,
      containerPos,
      containerItemTarget('diamond', 5)
    );
    const task2 = new PickupFromContainerTask(
      bot,
      new BlockPos(20, 64, 20),
      containerItemTarget('diamond', 5)
    );

    expect(task1.isEqual(task2)).toBe(false);
  });
});

describe('pickupFromContainer convenience function', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  const containerPos = new BlockPos(10, 64, 10);

  it('pickupFromContainer should create task with items', () => {
    const task = pickupFromContainer(
      bot,
      containerPos,
      { item: 'diamond', count: 5 },
      { item: 'emerald', count: 3 }
    );

    expect(task).toBeInstanceOf(PickupFromContainerTask);
  });
});
