/**
 * Tests for PlaceStructureBlockTask
 *
 * WHY this task matters:
 * - PlaceStructureBlockTask: Place throwaway blocks at specific positions for construction
 *
 * This automates placing structural blocks from inventory at target positions.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import {
  PlaceStructureBlockTask,
  PlaceStructureBlockState,
  placeStructureBlock,
  placeStructureBlockAt,
} from './AdvancedConstructionTask';

// Mock Bot
function createMockBot(): Bot {
  const mockBot = {
    entity: {
      position: new Vec3(0, 65, 0),
      velocity: new Vec3(0, 0, 0),
      onGround: true,
      yaw: 0,
    },
    inventory: {
      items: mock().mockReturnValue([]),
      slots: {},
    },
    blockAt: mock().mockReturnValue({ name: 'air' }),
    entities: {},
    game: {
      dimension: 'minecraft:overworld',
    },
    look: mock(),
    lookAt: mock(),
    attack: mock(),
    equip: mock(),
    activateItem: mock(),
    on: mock(),
    removeListener: mock(),
    once: mock(),
    emit: mock(),
  } as unknown as Bot;

  return mockBot;
}

describe('PlaceStructureBlockTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Task Creation', () => {
    it('WHY: Creates task to place any throwaway block at position', () => {
      const pos = new BlockPos(10, 65, 20);
      const task = new PlaceStructureBlockTask(bot, pos);

      expect(task.displayName).toContain('PlaceStructureBlock');
      expect(task.displayName).toContain('10');
      expect(task.displayName).toContain('65');
      expect(task.displayName).toContain('20');
    });

    it('WHY: fromCoords factory creates task from coordinates', () => {
      const task = PlaceStructureBlockTask.fromCoords(bot, 5, 60, 15);

      expect(task).toBeInstanceOf(PlaceStructureBlockTask);
      expect(task.getPosition().x).toBe(5);
      expect(task.getPosition().y).toBe(60);
      expect(task.getPosition().z).toBe(15);
    });
  });

  describe('State Machine', () => {
    it('WHY: Starts in GETTING_BLOCK state', () => {
      const task = new PlaceStructureBlockTask(bot, new BlockPos(0, 65, 0));

      task.onStart();
      expect(task.getState()).toBe(PlaceStructureBlockState.GETTING_BLOCK);
    });

    it('WHY: All structure block states are defined', () => {
      expect(PlaceStructureBlockState.GETTING_BLOCK).toBeDefined();
      expect(PlaceStructureBlockState.PLACING).toBeDefined();
      expect(PlaceStructureBlockState.FINISHED).toBeDefined();
      expect(PlaceStructureBlockState.FAILED).toBeDefined();
    });

    it('WHY: Selects block from inventory', () => {
      // Ensure position is empty so we proceed to block selection
      (bot.blockAt as any).mockReturnValue({ name: 'air', boundingBox: 'empty' });
      // Mock inventory with cobblestone
      (bot.inventory.items as any).mockReturnValue([
        { name: 'cobblestone', count: 64 },
      ]);

      const task = new PlaceStructureBlockTask(bot, new BlockPos(0, 65, 0));
      task.onStart();
      task.onTick();

      expect(task.getSelectedBlock()).toBe('cobblestone');
      expect(task.getState()).toBe(PlaceStructureBlockState.PLACING);
    });

    it('WHY: Fails when no throwaway blocks available', () => {
      // Ensure position is empty so we proceed to block selection
      (bot.blockAt as any).mockReturnValue({ name: 'air', boundingBox: 'empty' });
      // Mock inventory with no throwaway blocks
      (bot.inventory.items as any).mockReturnValue([
        { name: 'diamond', count: 64 },
      ]);

      const task = new PlaceStructureBlockTask(bot, new BlockPos(0, 65, 0));
      task.onStart();
      task.onTick();

      expect(task.getState()).toBe(PlaceStructureBlockState.FAILED);
      expect(task.isFailed()).toBe(true);
    });
  });

  describe('Completion', () => {
    it('WHY: Finishes when block already placed at position', () => {
      (bot.blockAt as any).mockReturnValue({ name: 'stone', boundingBox: 'block' });

      const task = new PlaceStructureBlockTask(bot, new BlockPos(0, 65, 0));
      task.onStart();
      task.onTick();

      expect(task.getState()).toBe(PlaceStructureBlockState.FINISHED);
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('Equality', () => {
    it('WHY: Tasks with same position are equal', () => {
      const task1 = new PlaceStructureBlockTask(bot, new BlockPos(10, 65, 20));
      const task2 = new PlaceStructureBlockTask(bot, new BlockPos(10, 65, 20));

      expect(task1.isEqual(task2)).toBe(true);
    });

    it('WHY: Tasks with different positions are not equal', () => {
      const task1 = new PlaceStructureBlockTask(bot, new BlockPos(10, 65, 20));
      const task2 = new PlaceStructureBlockTask(bot, new BlockPos(30, 65, 40));

      expect(task1.isEqual(task2)).toBe(false);
    });
  });

  describe('Convenience Functions', () => {
    it('WHY: placeStructureBlock creates task with BlockPos', () => {
      const pos = new BlockPos(5, 65, 10);
      const task = placeStructureBlock(bot, pos);

      expect(task).toBeInstanceOf(PlaceStructureBlockTask);
      expect(task.getPosition()).toBe(pos);
    });

    it('WHY: placeStructureBlockAt creates task with coordinates', () => {
      const task = placeStructureBlockAt(bot, 5, 65, 10);

      expect(task).toBeInstanceOf(PlaceStructureBlockTask);
      expect(task.getPosition().x).toBe(5);
    });
  });

  describe('Block Selection', () => {
    it('WHY: Uses first matching throwaway block found in inventory', () => {
      // Ensure position is air so we proceed to block selection
      (bot.blockAt as any).mockReturnValue({ name: 'air', boundingBox: 'empty' });
      (bot.inventory.items as any).mockReturnValue([
        { name: 'dirt', count: 64 },
        { name: 'cobblestone', count: 64 },
      ]);

      const task = new PlaceStructureBlockTask(bot, new BlockPos(0, 65, 0));
      task.onStart();
      task.onTick();

      // Uses first matching block found in inventory that's in THROWAWAY_BLOCKS
      // (dirt appears first in inventory, so it's selected first)
      expect(task.getSelectedBlock()).toBe('dirt');
    });

    it('WHY: Uses any throwaway block', () => {
      // Ensure position is air so we proceed to block selection
      (bot.blockAt as any).mockReturnValue({ name: 'air', boundingBox: 'empty' });
      (bot.inventory.items as any).mockReturnValue([
        { name: 'netherrack', count: 64 },
      ]);

      const task = new PlaceStructureBlockTask(bot, new BlockPos(0, 65, 0));
      task.onStart();
      task.onTick();

      expect(task.getSelectedBlock()).toBe('netherrack');
    });
  });
});
