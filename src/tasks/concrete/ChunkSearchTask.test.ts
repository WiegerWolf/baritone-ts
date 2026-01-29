/**
 * Tests for Chunk Search Tasks
 *
 * These tests verify:
 * 1. Intent - What each task is supposed to accomplish (WHY)
 * 2. State Machine - Correct state transitions
 * 3. Edge Cases - Error handling and boundary conditions
 */

import { Vec3 } from 'vec3';
import {
  blockToChunk,
  chunkToBlock,
  SearchChunkForBlockTask,
  SearchChunkByConditionTask,
  searchForBlocks,
  searchForStronghold,
  searchForNetherFortress,
} from './ChunkSearchTask';
import type { ChunkPos } from './ChunkSearchTask';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot: Record<string, any> = {
    entity: {
      position: new Vec3(0, 64, 0),
      velocity: new Vec3(0, 0, 0),
      onGround: true,
      yaw: 0,
      pitch: 0,
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    entities: {},
    game: {
      dimension: 'minecraft:overworld',
    },
    blockAt: () => null,
    lookAt: jest.fn(),
    look: jest.fn(),
    setControlState: jest.fn(),
    clearControlStates: jest.fn(),
    equip: jest.fn(),
    activateBlock: jest.fn(),
    useOn: jest.fn(),
    wake: jest.fn(),
  };

  // Deep merge overrides
  const result: Record<string, any> = { ...baseBot };
  for (const key of Object.keys(overrides)) {
    if (typeof overrides[key] === 'object' && overrides[key] !== null && !Array.isArray(overrides[key])) {
      result[key] = { ...baseBot[key], ...overrides[key] };
    } else {
      result[key] = overrides[key];
    }
  }

  return result;
}

describe('Chunk Search Tasks', () => {
  describe('chunk coordinate utilities', () => {
    it('blockToChunk should convert block coords to chunk coords', () => {
      expect(blockToChunk(0, 0)).toEqual({ x: 0, z: 0 });
      expect(blockToChunk(15, 15)).toEqual({ x: 0, z: 0 });
      expect(blockToChunk(16, 16)).toEqual({ x: 1, z: 1 });
      expect(blockToChunk(-1, -1)).toEqual({ x: -1, z: -1 });
      expect(blockToChunk(-16, -16)).toEqual({ x: -1, z: -1 });
      expect(blockToChunk(-17, -17)).toEqual({ x: -2, z: -2 });
    });

    it('chunkToBlock should convert chunk coords to center block', () => {
      const result1 = chunkToBlock({ x: 0, z: 0 });
      expect(result1.x).toBe(8);
      expect(result1.z).toBe(8);
      expect(result1.y).toBe(64); // Default Y

      const result2 = chunkToBlock({ x: 1, z: 1 }, 100);
      expect(result2.x).toBe(24);
      expect(result2.z).toBe(24);
      expect(result2.y).toBe(100);

      const result3 = chunkToBlock({ x: -1, z: -1 });
      expect(result3.x).toBe(-8);
      expect(result3.z).toBe(-8);
    });

    it('blockToChunk and chunkToBlock should be consistent', () => {
      const originalChunk: ChunkPos = { x: 5, z: -3 };
      const blockPos = chunkToBlock(originalChunk);
      const recoveredChunk = blockToChunk(blockPos.x, blockPos.z);
      expect(recoveredChunk).toEqual(originalChunk);
    });
  });

  describe('SearchChunkForBlockTask', () => {
    describe('creation and initialization', () => {
      it('should create with block names', () => {
        const bot = createMockBot();
        const task = new SearchChunkForBlockTask(bot, ['diamond_ore', 'deepslate_diamond_ore']);
        expect(task.displayName).toContain('SearchChunkForBlock');
        expect(task.displayName).toContain('diamond_ore');
      });

      it('should start not finished', () => {
        const bot = createMockBot();
        const task = new SearchChunkForBlockTask(bot, ['diamond_ore']);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('found positions', () => {
      it('should initially have no found positions', () => {
        const bot = createMockBot();
        const task = new SearchChunkForBlockTask(bot, ['diamond_ore']);
        task.onStart();
        expect(task.getFoundPositions()).toHaveLength(0);
      });
    });

    describe('search termination', () => {
      it('should fail after max chunks searched', () => {
        const bot = createMockBot({
          entity: { position: new Vec3(0, 64, 0) },
          blockAt: () => null, // No blocks found
        });
        const task = new SearchChunkForBlockTask(bot, ['diamond_ore'], 1, {
          maxChunksToSearch: 5,
          exploreWhenEmpty: false,
        });
        task.onStart();

        // Simulate multiple ticks - should eventually fail
        for (let i = 0; i < 10; i++) {
          if (task.isFinished()) break;
          task.onTick();
        }

        // With no chunks found and exploreWhenEmpty=false, should fail
        expect(task.isFinished()).toBe(true);
      });
    });

    describe('equality', () => {
      it('should be equal if same blocks', () => {
        const bot = createMockBot();
        const task1 = new SearchChunkForBlockTask(bot, ['diamond_ore']);
        const task2 = new SearchChunkForBlockTask(bot, ['diamond_ore']);
        expect(task1.isEqual(task2)).toBe(true);
      });

      it('should not be equal if different blocks', () => {
        const bot = createMockBot();
        const task1 = new SearchChunkForBlockTask(bot, ['diamond_ore']);
        const task2 = new SearchChunkForBlockTask(bot, ['gold_ore']);
        expect(task1.isEqual(task2)).toBe(false);
      });

      it('should not be equal to null', () => {
        const bot = createMockBot();
        const task = new SearchChunkForBlockTask(bot, ['diamond_ore']);
        expect(task.isEqual(null)).toBe(false);
      });
    });
  });

  describe('SearchChunkByConditionTask', () => {
    describe('creation', () => {
      it('should create with condition function', () => {
        const bot = createMockBot();
        const condition = (chunk: ChunkPos) => chunk.x === 0 && chunk.z === 0;
        const task = new SearchChunkByConditionTask(bot, condition);
        expect(task.displayName).toBe('SearchChunkByCondition');
      });

      it('should start not finished', () => {
        const bot = createMockBot();
        const task = new SearchChunkByConditionTask(bot, () => false);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('found chunks', () => {
      it('should initially have no found chunks', () => {
        const bot = createMockBot();
        const task = new SearchChunkByConditionTask(bot, () => false);
        task.onStart();
        expect(task.getFoundChunks()).toHaveLength(0);
      });
    });

    describe('equality', () => {
      it('should be equal if same condition function reference', () => {
        const bot = createMockBot();
        const condition = () => true;
        const task1 = new SearchChunkByConditionTask(bot, condition);
        const task2 = new SearchChunkByConditionTask(bot, condition);
        expect(task1.isEqual(task2)).toBe(true);
      });

      it('should not be equal if different condition functions', () => {
        const bot = createMockBot();
        const task1 = new SearchChunkByConditionTask(bot, () => true);
        const task2 = new SearchChunkByConditionTask(bot, () => false);
        expect(task1.isEqual(task2)).toBe(false);
      });
    });
  });

  describe('convenience functions', () => {
    it('searchForBlocks should create SearchChunkForBlockTask', () => {
      const bot = createMockBot();
      const task = searchForBlocks(bot, ['diamond_ore', 'gold_ore']);
      expect(task).toBeInstanceOf(SearchChunkForBlockTask);
    });

    it('searchForStronghold should search for end portal frames', () => {
      const bot = createMockBot();
      const task = searchForStronghold(bot);
      expect(task).toBeInstanceOf(SearchChunkForBlockTask);
      expect(task.displayName).toContain('end_portal_frame');
    });

    it('searchForNetherFortress should search for nether brick blocks', () => {
      const bot = createMockBot();
      const task = searchForNetherFortress(bot);
      expect(task).toBeInstanceOf(SearchChunkForBlockTask);
      expect(task.displayName).toContain('nether_bricks');
    });
  });
});

describe('SearchChunkForBlockTask intent', () => {
  it('exists to efficiently find blocks across large areas', () => {
    // WHY: Finding specific blocks (like stronghold frames) requires
    // systematic chunk-by-chunk searching, not random exploration
    const bot = createMockBot();
    const task = searchForStronghold(bot);

    // Searching for 12 frames = complete end portal
    expect(task.displayName).toContain('end_portal_frame');
  });

  it('chunk-based search is more efficient than block-by-block', () => {
    // WHY: Minecraft loads/unloads in chunks. Searching by chunk
    // aligns with how the world data is organized.
    const chunk1 = blockToChunk(100, 200);
    const chunk2 = blockToChunk(101, 200);

    // Blocks 100 and 101 are in the same chunk
    expect(chunk1).toEqual(chunk2);

    // So we only need to search that chunk once, not twice
  });
});
