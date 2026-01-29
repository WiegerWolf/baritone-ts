/**
 * Tests for ContainerType utilities, detection, and state transitions
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  ContainerType,
  getContainerBlocks,
  isContainerBlock,
  CraftInTableTask,
} from './ContainerTask';

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

describe('ContainerType utilities', () => {
  describe('getContainerBlocks', () => {
    it('should return correct blocks for chest', () => {
      const blocks = getContainerBlocks(ContainerType.CHEST);
      expect(blocks).toContain('chest');
    });

    it('should return multiple blocks for shulker boxes (all colors)', () => {
      const blocks = getContainerBlocks(ContainerType.SHULKER_BOX);
      expect(blocks.length).toBeGreaterThan(1);
      expect(blocks).toContain('shulker_box');
      expect(blocks).toContain('white_shulker_box');
      expect(blocks).toContain('red_shulker_box');
    });

    it('should return multiple blocks for anvils (damage states)', () => {
      const blocks = getContainerBlocks(ContainerType.ANVIL);
      expect(blocks).toContain('anvil');
      expect(blocks).toContain('chipped_anvil');
      expect(blocks).toContain('damaged_anvil');
    });

    it('should return single block for furnace', () => {
      const blocks = getContainerBlocks(ContainerType.FURNACE);
      expect(blocks).toEqual(['furnace']);
    });
  });

  describe('isContainerBlock', () => {
    it('should return true for matching container', () => {
      expect(isContainerBlock('chest', ContainerType.CHEST)).toBe(true);
      expect(isContainerBlock('furnace', ContainerType.FURNACE)).toBe(true);
    });

    it('should return true for partial matches', () => {
      expect(isContainerBlock('trapped_chest', ContainerType.CHEST)).toBe(true);
    });

    it('should return true for colored shulker boxes', () => {
      expect(isContainerBlock('blue_shulker_box', ContainerType.SHULKER_BOX)).toBe(true);
      expect(isContainerBlock('pink_shulker_box', ContainerType.SHULKER_BOX)).toBe(true);
    });

    it('should return false for non-matching blocks', () => {
      expect(isContainerBlock('stone', ContainerType.CHEST)).toBe(false);
      expect(isContainerBlock('chest', ContainerType.FURNACE)).toBe(false);
    });
  });
});

describe('Container type detection', () => {
  /**
   * WHY: Different containers require different window handling.
   * We need to correctly identify container types from block names.
   */
  it('should detect chest container type', () => {
    expect(isContainerBlock('chest', ContainerType.CHEST)).toBe(true);
    expect(isContainerBlock('trapped_chest', ContainerType.CHEST)).toBe(true);
    expect(isContainerBlock('ender_chest', ContainerType.ENDER_CHEST)).toBe(true);
  });

  it('should detect furnace container types', () => {
    expect(isContainerBlock('furnace', ContainerType.FURNACE)).toBe(true);
    expect(isContainerBlock('blast_furnace', ContainerType.BLAST_FURNACE)).toBe(true);
    expect(isContainerBlock('smoker', ContainerType.SMOKER)).toBe(true);
  });

  it('should detect crafting stations', () => {
    expect(isContainerBlock('crafting_table', ContainerType.CRAFTING_TABLE)).toBe(true);
    expect(isContainerBlock('smithing_table', ContainerType.SMITHING_TABLE)).toBe(true);
  });
});

describe('Container task state transitions', () => {
  /**
   * WHY: State machines should have predictable transitions.
   * This test verifies the container task state flow.
   */
  it('should follow correct state sequence', () => {
    const bot = createMockBot();
    const task = new CraftInTableTask(bot);

    // Initial state
    task.onStart();
    expect(task.isFinished()).toBe(false);
    expect(task.isFailed()).toBe(false);

    // Without container, should transition to failed (can't place without item)
    // Run multiple ticks to allow state transitions
    for (let i = 0; i < 5; i++) {
      task.onTick();
    }
    expect(task.isFailed()).toBe(true);
  });
});
