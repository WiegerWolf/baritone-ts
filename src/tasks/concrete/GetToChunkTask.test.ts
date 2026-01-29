/**
 * GetToChunkTask Tests
 *
 * WHY this task matters:
 * GetToChunkTask - Navigate to a general area (chunk) for exploration
 * or structure finding. More lenient than exact block navigation.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';

import {
  GetToChunkTask,
  getToChunk,
  getToChunkContaining,
} from './GetToChunkTask';

import {
  blockToChunk,
  chunkToBlock,
} from './ChunkSearchTask';

import { CollectFoodTask, collectFoodUntilFull } from './CollectFoodTask';

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
    game: { dimension: 'minecraft:overworld' },
    pathfinder: {
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
    ...overrides,
  };

  return baseBot;
}

describe('GetToChunkTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Chunk coordinate utilities', () => {
    /**
     * WHY: Chunks are 16x16 blocks. Converting between block and chunk
     * coordinates is essential for chunk-based navigation.
     */
    it('should convert block to chunk coordinates', () => {
      expect(blockToChunk(0, 0)).toEqual({ x: 0, z: 0 });
      expect(blockToChunk(15, 15)).toEqual({ x: 0, z: 0 });
      expect(blockToChunk(16, 16)).toEqual({ x: 1, z: 1 });
      expect(blockToChunk(-1, -1)).toEqual({ x: -1, z: -1 });
      expect(blockToChunk(-16, -16)).toEqual({ x: -1, z: -1 });
      expect(blockToChunk(-17, -17)).toEqual({ x: -2, z: -2 });
    });

    it('should convert chunk to block coordinates (returns center)', () => {
      // chunkToBlock returns Vec3 at center of chunk (chunk * 16 + 8)
      const chunk00 = chunkToBlock({ x: 0, z: 0 });
      expect(chunk00.x).toBe(8);
      expect(chunk00.z).toBe(8);

      const chunk11 = chunkToBlock({ x: 1, z: 1 });
      expect(chunk11.x).toBe(24); // 1 * 16 + 8
      expect(chunk11.z).toBe(24);

      const chunkNeg = chunkToBlock({ x: -1, z: -1 });
      expect(chunkNeg.x).toBe(-8); // -1 * 16 + 8
      expect(chunkNeg.z).toBe(-8);
    });
  });

  describe('GetToChunkTask creation', () => {
    /**
     * WHY: GetToChunkTask simplifies navigation when exact position
     * doesn't matter - just being in the right chunk is enough.
     */
    it('should create task with chunk coordinates', () => {
      const task = new GetToChunkTask(bot, 5, 10);
      expect(task.displayName).toContain('GetToChunk');
      expect(task.displayName).toContain('5');
      expect(task.displayName).toContain('10');
    });

    it('should create from block position', () => {
      const task = GetToChunkTask.fromBlockPos(bot, 100, 200);
      expect(task.getTargetChunk().x).toBe(6); // 100 / 16 = 6
      expect(task.getTargetChunk().z).toBe(12); // 200 / 16 = 12
    });

    it('should create from Vec3', () => {
      const task = GetToChunkTask.fromVec3(bot, new Vec3(32, 64, 48));
      expect(task.getTargetChunk().x).toBe(2);
      expect(task.getTargetChunk().z).toBe(3);
    });
  });

  describe('GetToChunkTask completion', () => {
    it('should be finished when in target chunk', () => {
      // Player at (0, 64, 0) is in chunk (0, 0)
      const task = new GetToChunkTask(bot, 0, 0);
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });

    it('should not be finished when in different chunk', () => {
      const task = new GetToChunkTask(bot, 5, 5);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('GetToChunkTask equality', () => {
    it('should be equal if same chunk', () => {
      const task1 = new GetToChunkTask(bot, 5, 10);
      const task2 = new GetToChunkTask(bot, 5, 10);
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different chunk', () => {
      const task1 = new GetToChunkTask(bot, 5, 10);
      const task2 = new GetToChunkTask(bot, 6, 10);
      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience functions', () => {
    it('getToChunk should create task', () => {
      const task = getToChunk(bot, 5, 10);
      expect(task).toBeInstanceOf(GetToChunkTask);
    });

    it('getToChunkContaining should create task from block', () => {
      const task = getToChunkContaining(bot, 100, 200);
      expect(task).toBeInstanceOf(GetToChunkTask);
      expect(task.getTargetChunk().x).toBe(6);
    });
  });
});

describe('Integration scenarios - Exploration workflow', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  /**
   * WHY: Exploration involves chunk-based navigation and resource
   * gathering. These tasks enable autonomous exploration.
   */
  it('should create tasks for exploration', () => {
    // Navigate to a chunk
    const chunkTask = getToChunk(bot, 10, 10);
    expect(chunkTask).toBeInstanceOf(GetToChunkTask);

    // Collect food while exploring
    const foodTask = collectFoodUntilFull(bot);
    expect(foodTask).toBeInstanceOf(CollectFoodTask);
  });
});
