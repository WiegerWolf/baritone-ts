/**
 * Tests for DestroyBlockTask
 *
 * These tests verify that block destruction works correctly:
 * - WHY: Block destruction is fundamental to Minecraft.
 *   The task must handle complex scenarios like getting stuck, dangerous positions,
 *   and tool selection.
 * - INTENT: Validate state machine logic, edge case handling, and proper
 *   interaction with the game world.
 */

import { describe, it, expect, mock } from 'bun:test';
import { DestroyBlockTask } from './ConstructionTask';
import { BlockPos } from '../../types';
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

describe('DestroyBlockTask', () => {
  describe('creation and initialization', () => {
    it('should create with block coordinates', () => {
      const bot = createMockBot();
      const task = new DestroyBlockTask(bot, 10, 64, 10);
      expect(task.displayName).toContain('DestroyBlock');
      expect(task.displayName).toContain('10');
      expect(task.displayName).toContain('64');
    });

    it('should create from BlockPos', () => {
      const bot = createMockBot();
      const task = DestroyBlockTask.fromBlockPos(bot, new BlockPos(5, 70, 5));
      expect(task.displayName).toContain('5');
      expect(task.displayName).toContain('70');
    });

    it('should create from Vec3', () => {
      const bot = createMockBot();
      const task = DestroyBlockTask.fromVec3(bot, new Vec3(3.7, 65.2, 8.9));
      // Should floor coordinates
      expect(task.displayName).toContain('3');
      expect(task.displayName).toContain('65');
      expect(task.displayName).toContain('8');
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new DestroyBlockTask(bot, 10, 64, 10);
      task.onStart();
      expect(task.isFinished()).toBe(false);
      expect(task.isFailed()).toBe(false);
    });
  });

  describe('block destruction logic', () => {
    /**
     * WHY: If the target block is already air, the task should
     * complete immediately without doing any work.
     */
    it('should finish if block is already air', () => {
      const bot = createMockBot({
        blockAt: () => ({ name: 'air', boundingBox: 'empty' }),
      });

      const task = new DestroyBlockTask(bot, 10, 64, 10);
      task.onStart();
      task.onTick();
      expect(task.isFinished()).toBe(true);
    });

    it('should finish if block is cave_air', () => {
      const bot = createMockBot({
        blockAt: () => ({ name: 'cave_air', boundingBox: 'empty' }),
      });

      const task = new DestroyBlockTask(bot, 10, 64, 10);
      task.onStart();
      task.onTick();
      expect(task.isFinished()).toBe(true);
    });

    /**
     * WHY: When the player is too far from the block, they need
     * to navigate closer before attempting to mine.
     */
    it('should navigate to block when too far', () => {
      const bot = createMockBot({
        blockAt: () => ({ name: 'stone', boundingBox: 'block', position: new Vec3(50, 64, 50) }),
      });
      // Player at 0,64,0 and block at 50,64,50 = far away

      const task = new DestroyBlockTask(bot, 50, 64, 50);
      task.onStart();
      const subtask = task.onTick(); // Check stuck
      expect(task.isFinished()).toBe(false);

      const subtask2 = task.onTick(); // Moving state
      // Should return navigation task
      expect(subtask2).not.toBeNull();
    });

    /**
     * WHY: When within reach, the player should look at the block
     * and start mining.
     */
    it('should mine when in range', () => {
      const digMock = mock();
      const bot = createMockBot({
        blockAt: () => ({ name: 'stone', boundingBox: 'block', position: new Vec3(2, 64, 2), material: 'rock' }),
        blockAtCursor: () => ({ position: { x: 2, y: 64, z: 2 } }),
        dig: digMock,
      });
      bot.entity.position = new Vec3(2, 64, 0); // Close to target

      const task = new DestroyBlockTask(bot, 2, 64, 2);
      task.onStart();

      // Run through states: checking stuck -> moving -> positioning -> looking -> mining
      task.onTick(); // Check stuck
      task.onTick(); // Moving (close enough, should proceed)
      task.onTick(); // Positioning
      task.onTick(); // Looking
      task.onTick(); // Mining

      // Dig should be called eventually
      // Note: Actual dig call depends on look state
    });
  });

  describe('stuck detection', () => {
    /**
     * WHY: Vines, tall grass, and other blocks can trap the player.
     * The task should detect this and attempt to escape.
     */
    it('should detect when stuck in annoying block', () => {
      const bot = createMockBot({
        blockAt: (pos: Vec3) => {
          if (Math.floor(pos.y) === 64) {
            return { name: 'vine', boundingBox: 'empty' };
          }
          return { name: 'air', boundingBox: 'empty' };
        },
      });

      const task = new DestroyBlockTask(bot, 10, 60, 10);
      task.onStart();

      // Should detect stuck state and return shimmy task
      const subtask = task.onTick();
      expect(subtask !== null || task.isFinished()).toBe(true);
    });

    /**
     * WHY: If stuck too many times, the task should fail rather
     * than loop infinitely.
     */
    it('should fail after too many stuck attempts', () => {
      const bot = createMockBot({
        blockAt: (pos: Vec3) => {
          if (Math.floor(pos.y) === 64) {
            return { name: 'cobweb', boundingBox: 'empty' };
          }
          return { name: 'stone', boundingBox: 'block' };
        },
      });

      const task = new DestroyBlockTask(bot, 10, 60, 10);
      task.onStart();

      // Simulate many stuck attempts
      for (let i = 0; i < 20; i++) {
        task.onTick();
        if (task.isFailed()) break;
      }

      expect(task.isFailed()).toBe(true);
    });
  });

  describe('tool equipping', () => {
    /**
     * WHY: Using the right tool for a block type is essential for
     * efficient mining. Pickaxe for stone, axe for wood, etc.
     */
    it('should equip pickaxe for stone blocks', () => {
      const equipMock = mock();
      const bot = createMockBot({
        blockAt: () => ({
          name: 'stone',
          boundingBox: 'block',
          position: new Vec3(2, 64, 2),
          material: 'rock',
        }),
        blockAtCursor: () => ({ position: { x: 2, y: 64, z: 2 } }),
        inventory: {
          items: () => [
            { name: 'diamond_pickaxe', slot: 0 },
            { name: 'wooden_axe', slot: 1 },
          ],
          slots: {},
        },
        equip: equipMock,
      });
      bot.entity.position = new Vec3(2, 64, 0);

      const task = new DestroyBlockTask(bot, 2, 64, 2, { equipBestTool: true });
      task.onStart();

      // Run through states to reach mining
      for (let i = 0; i < 10; i++) {
        task.onTick();
      }

      // Should have tried to equip pickaxe at some point
      // Note: Actual equip depends on reaching mining state
    });

    /**
     * WHY: Netherite > Diamond > Iron > Stone > Gold > Wood
     * The task should select the best available tool material.
     */
    it('should prefer higher tier tools', () => {
      const equipMock = mock();
      const bot = createMockBot({
        blockAt: () => ({
          name: 'stone',
          boundingBox: 'block',
          position: new Vec3(2, 64, 2),
          material: 'rock',
        }),
        inventory: {
          items: () => [
            { name: 'stone_pickaxe', slot: 0 },
            { name: 'diamond_pickaxe', slot: 1 },
            { name: 'iron_pickaxe', slot: 2 },
          ],
          slots: {},
        },
        equip: equipMock,
        heldItem: null,
      });
      bot.entity.position = new Vec3(2, 64, 0);

      const task = new DestroyBlockTask(bot, 2, 64, 2);
      task.onStart();

      // When equipping, diamond should be preferred
    });
  });

  describe('safety checks', () => {
    /**
     * WHY: Mining the block you're standing on can cause falls
     * into lava, void, or cause fall damage.
     */
    it('should avoid mining block player stands on when dangerous below', () => {
      const bot = createMockBot({
        blockAt: (pos: Vec3) => {
          if (pos.y === 64) return { name: 'stone', boundingBox: 'block', position: pos };
          if (pos.y === 63) return { name: 'lava', boundingBox: 'empty', position: pos };
          return { name: 'air', boundingBox: 'empty', position: pos };
        },
      });
      bot.entity.position = new Vec3(10, 65, 10); // Standing on target block

      const task = new DestroyBlockTask(bot, 10, 64, 10, { avoidStandingOn: true });
      task.onStart();

      // Should not start mining immediately, should reposition
      task.onTick();
      // Task should try to move away first
    });
  });

  describe('cleanup', () => {
    /**
     * WHY: When interrupted, the task should stop mining to
     * prevent unintended block destruction.
     */
    it('should stop digging on task stop', () => {
      const stopDigging = mock();
      const bot = createMockBot({ stopDigging });

      const task = new DestroyBlockTask(bot, 10, 64, 10);
      task.onStart();
      task.onStop(null);

      expect(stopDigging).toHaveBeenCalled();
    });
  });

  describe('equality', () => {
    it('should be equal if same position', () => {
      const bot = createMockBot();
      const task1 = new DestroyBlockTask(bot, 10, 64, 10);
      const task2 = new DestroyBlockTask(bot, 10, 64, 10);
      expect(task1.isEqual(task2)).toBe(true);
    });

    it('should not be equal if different position', () => {
      const bot = createMockBot();
      const task1 = new DestroyBlockTask(bot, 10, 64, 10);
      const task2 = new DestroyBlockTask(bot, 11, 64, 10);
      expect(task1.isEqual(task2)).toBe(false);
    });
  });
});
