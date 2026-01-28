/**
 * Tests for Trading, MLG, and Chunk Search Tasks
 *
 * These tests verify:
 * 1. Intent - What each task is supposed to accomplish (WHY)
 * 2. State Machine - Correct state transitions
 * 3. Edge Cases - Error handling and boundary conditions
 */

import { Vec3 } from 'vec3';
import {
  TradeWithPiglinsTask,
  tradeWithPiglins,
  tradeForEnderPearls,
  MLGBucketTask,
  MLGBucketMonitorTask,
  mlgBucket,
  monitorForMLG,
  shouldMLG,
  blockToChunk,
  chunkToBlock,
  SearchChunkForBlockTask,
  SearchChunkByConditionTask,
  searchForBlocks,
  searchForStronghold,
  searchForNetherFortress,
  itemTarget,
} from '../src/tasks/concrete';
import type { ChunkPos } from '../src/tasks/concrete';

// Mock bot for testing (similar to MiscTasks.test.ts)
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

describe('Trading Tasks', () => {
  describe('TradeWithPiglinsTask', () => {
    describe('creation and initialization', () => {
      it('should create task with item targets', () => {
        const bot = createMockBot({
          game: { dimension: 'minecraft:the_nether' },
        });
        const task = new TradeWithPiglinsTask(bot, [itemTarget('ender_pearl', 4)]);
        expect(task.displayName).toContain('TradeWithPiglins');
        expect(task.displayName).toContain('ender_pearl');
      });

      it('should start not finished', () => {
        const bot = createMockBot({
          game: { dimension: 'minecraft:the_nether' },
        });
        const task = new TradeWithPiglinsTask(bot, [itemTarget('ender_pearl', 4)]);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('dimension checking', () => {
      it('should fail if not in nether', () => {
        const bot = createMockBot({
          game: { dimension: 'minecraft:overworld' },
          inventory: { items: () => [{ name: 'gold_ingot', count: 8 }] },
        });
        const task = new TradeWithPiglinsTask(bot, [itemTarget('ender_pearl', 4)]);
        task.onStart();
        task.onTick();
        // Task should mark itself as failed
        expect(task.isFailed()).toBe(true);
      });
    });

    describe('gold checking', () => {
      it('should fail if no gold in inventory', () => {
        const bot = createMockBot({
          game: { dimension: 'minecraft:the_nether' },
          inventory: { items: () => [] },
        });
        const task = new TradeWithPiglinsTask(bot, [itemTarget('ender_pearl', 4)]);
        task.onStart();
        task.onTick();
        expect(task.isFailed()).toBe(true);
      });

      it('should proceed if gold is available', () => {
        const bot = createMockBot({
          game: { dimension: 'minecraft:the_nether' },
          inventory: { items: () => [{ name: 'gold_ingot', count: 8 }] },
        });
        const task = new TradeWithPiglinsTask(bot, [itemTarget('ender_pearl', 4)]);
        task.onStart();
        task.onTick();
        // Should not fail - will be looking for piglins
        expect(task.isFailed()).toBe(false);
      });
    });

    describe('convenience functions', () => {
      it('tradeWithPiglins should create task', () => {
        const bot = createMockBot();
        const task = tradeWithPiglins(bot, 'ender_pearl', 4);
        expect(task).toBeInstanceOf(TradeWithPiglinsTask);
        expect(task.displayName).toContain('ender_pearl');
      });

      it('tradeForEnderPearls should create task for pearls', () => {
        const bot = createMockBot();
        const task = tradeForEnderPearls(bot, 12);
        expect(task).toBeInstanceOf(TradeWithPiglinsTask);
        expect(task.displayName).toContain('ender_pearl');
      });
    });

    describe('equality', () => {
      it('should be equal to another piglin trade task', () => {
        const bot = createMockBot();
        const task1 = tradeWithPiglins(bot, 'ender_pearl', 4);
        const task2 = tradeWithPiglins(bot, 'fire_charge', 8);
        // All piglin trades are effectively equal per implementation
        expect(task1.isEqual(task2)).toBe(true);
      });

      it('should not be equal to null', () => {
        const bot = createMockBot();
        const task = tradeWithPiglins(bot, 'ender_pearl', 4);
        expect(task.isEqual(null)).toBe(false);
      });
    });
  });
});

describe('MLG Tasks', () => {
  describe('MLGBucketTask', () => {
    describe('creation and initialization', () => {
      it('should create with default config', () => {
        const bot = createMockBot();
        const task = new MLGBucketTask(bot);
        expect(task.displayName).toBe('MLGBucket');
      });

      it('should create with custom config', () => {
        const bot = createMockBot();
        const task = new MLGBucketTask(bot, {
          minFallDistance: 8,
          placeHeight: 3,
          pickupWater: false,
        });
        expect(task.displayName).toBe('MLGBucket');
      });

      it('should start not finished', () => {
        const bot = createMockBot();
        const task = new MLGBucketTask(bot);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('water bucket detection', () => {
      it('should fail if no water bucket in inventory', () => {
        const bot = createMockBot({
          inventory: { items: () => [] },
          entity: {
            position: new Vec3(0, 100, 0),
            velocity: new Vec3(0, -1, 0),
            onGround: false,
          },
          game: { dimension: 'minecraft:overworld' },
        });
        const task = new MLGBucketTask(bot);
        task.onStart();
        // Simulate several ticks of falling
        task.onTick();
        task.onTick();
        expect(task.isFailed()).toBe(true);
      });

      it('should not fail immediately with water bucket', () => {
        const bot = createMockBot({
          inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
          entity: {
            position: new Vec3(0, 100, 0),
            velocity: new Vec3(0, 0, 0),
            onGround: true,
          },
          game: { dimension: 'minecraft:overworld' },
        });
        const task = new MLGBucketTask(bot);
        task.onStart();
        task.onTick();
        expect(task.isFailed()).toBe(false);
      });
    });

    describe('dimension handling', () => {
      it('should fail in nether (water evaporates)', () => {
        const bot = createMockBot({
          inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
          entity: {
            position: new Vec3(0, 100, 0),
            velocity: new Vec3(0, -1, 0),
            onGround: false,
          },
          game: { dimension: 'minecraft:the_nether' },
        });
        const task = new MLGBucketTask(bot);
        task.onStart();
        task.onTick();
        expect(task.isFailed()).toBe(true);
      });
    });

    describe('equality', () => {
      it('should be equal to another MLG bucket task', () => {
        const bot = createMockBot();
        const task1 = new MLGBucketTask(bot);
        const task2 = new MLGBucketTask(bot);
        expect(task1.isEqual(task2)).toBe(true);
      });
    });
  });

  describe('MLGBucketMonitorTask', () => {
    describe('creation', () => {
      it('should create monitor task', () => {
        const bot = createMockBot();
        const task = new MLGBucketMonitorTask(bot);
        expect(task.displayName).toBe('MLGBucketMonitor');
      });

      it('should start not finished', () => {
        const bot = createMockBot({
          entity: {
            position: new Vec3(0, 64, 0),
            velocity: new Vec3(0, 0, 0),
            onGround: true,
          },
        });
        const task = new MLGBucketMonitorTask(bot);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('fall detection', () => {
      it('should not trigger when on ground', () => {
        const bot = createMockBot({
          entity: {
            position: new Vec3(0, 64, 0),
            velocity: new Vec3(0, 0, 0),
            onGround: true,
          },
          inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
        });
        const task = new MLGBucketMonitorTask(bot);
        task.onStart();
        const result = task.onTick();
        expect(result).toBeNull();
      });
    });

    describe('equality', () => {
      it('should be equal to another MLG monitor task', () => {
        const bot = createMockBot();
        const task1 = new MLGBucketMonitorTask(bot);
        const task2 = new MLGBucketMonitorTask(bot);
        expect(task1.isEqual(task2)).toBe(true);
      });
    });
  });

  describe('convenience functions', () => {
    it('mlgBucket should create MLGBucketTask', () => {
      const bot = createMockBot();
      const task = mlgBucket(bot);
      expect(task).toBeInstanceOf(MLGBucketTask);
    });

    it('monitorForMLG should create MLGBucketMonitorTask', () => {
      const bot = createMockBot();
      const task = monitorForMLG(bot, 6);
      expect(task).toBeInstanceOf(MLGBucketMonitorTask);
    });

    it('shouldMLG should return false when not falling', () => {
      const bot = createMockBot({
        entity: {
          position: new Vec3(0, 64, 0),
          velocity: new Vec3(0, 0, 0),
        },
        inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
      });
      expect(shouldMLG(bot)).toBe(false);
    });

    it('shouldMLG should return false without water bucket', () => {
      const bot = createMockBot({
        entity: {
          position: new Vec3(0, 100, 0),
          velocity: new Vec3(0, -1, 0),
        },
        inventory: { items: () => [] },
      });
      expect(shouldMLG(bot)).toBe(false);
    });

    it('shouldMLG should return false in nether', () => {
      const bot = createMockBot({
        entity: {
          position: new Vec3(0, 100, 0),
          velocity: new Vec3(0, -1, 0),
        },
        inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
        game: { dimension: 'minecraft:the_nether' },
      });
      expect(shouldMLG(bot)).toBe(false);
    });
  });
});

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

describe('Task WHY/Intent Tests', () => {
  /**
   * These tests verify the PURPOSE (WHY) of each task, not just the mechanics.
   */

  describe('TradeWithPiglinsTask intent', () => {
    it('exists to automate piglin bartering for progression items', () => {
      // WHY: Piglins are the only way to get certain items in the nether
      // like ender pearls (for end portal) and fire resistance potions
      const bot = createMockBot();
      const task = tradeForEnderPearls(bot, 12);

      // The task should target ender pearls specifically
      expect(task.displayName.toLowerCase()).toContain('ender_pearl');

      // The task is designed for nether use
      // (will fail in overworld by design)
    });
  });

  describe('MLGBucketTask intent', () => {
    it('exists to prevent death from fall damage', () => {
      // WHY: Fall damage is a major cause of death. MLG bucket saves lives.
      // The technique requires precise timing that's hard for humans.
      const bot = createMockBot();
      const task = mlgBucket(bot);

      // The task is named after the technique
      expect(task.displayName).toContain('MLG');
    });

    it('only works in overworld and end (water evaporates in nether)', () => {
      // WHY: Physical game mechanics require dimension awareness
      const netherBot = createMockBot({
        game: { dimension: 'minecraft:the_nether' },
        inventory: { items: () => [{ name: 'water_bucket', count: 1 }] },
        entity: {
          position: new Vec3(0, 100, 0),
          velocity: new Vec3(0, -1, 0),
          onGround: false,
        },
      });

      const task = new MLGBucketTask(netherBot);
      task.onStart();
      task.onTick();

      // Should recognize it can't work in nether
      expect(task.isFailed()).toBe(true);
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
});
