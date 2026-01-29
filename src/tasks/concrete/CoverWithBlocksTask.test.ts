/**
 * Tests for CoverWithBlocksTask
 *
 * WHY this task matters:
 * - CoverWithBlocksTask: Cover lava for safe Nether traversal
 *
 * This automates tedious lava covering operations in the Nether.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import {
  CoverWithBlocksTask,
  CoverWithBlocksState,
  coverWithBlocks,
  THROWAWAY_BLOCKS,
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

describe('CoverWithBlocksTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
    (bot as any).game = { dimension: 'minecraft:the_nether' };
  });

  it('WHY: Creates task to cover lava with blocks', () => {
    const task = new CoverWithBlocksTask(bot);

    expect(task.displayName).toContain('CoverWithBlocks');
  });

  it('WHY: Starts in GETTING_BLOCKS state', () => {
    const task = new CoverWithBlocksTask(bot);

    task.onStart();
    expect(task.getState()).toBe(CoverWithBlocksState.GETTING_BLOCKS);
  });

  it('WHY: THROWAWAY_BLOCKS includes common building blocks', () => {
    expect(THROWAWAY_BLOCKS).toContain('cobblestone');
    expect(THROWAWAY_BLOCKS).toContain('dirt');
    expect(THROWAWAY_BLOCKS).toContain('netherrack');
    expect(THROWAWAY_BLOCKS).toContain('stone');
    expect(THROWAWAY_BLOCKS).toContain('blackstone');
  });

  it('WHY: Needs blocks before covering', () => {
    const task = new CoverWithBlocksTask(bot);
    (bot.inventory.items as any).mockReturnValue([]);

    task.onStart();
    task.onTick();

    expect(task.getState()).toBe(CoverWithBlocksState.GETTING_BLOCKS);
  });

  it('WHY: Covers lava when has enough blocks', () => {
    const task = new CoverWithBlocksTask(bot);
    // Give bot plenty of cobblestone
    (bot.inventory.items as any).mockReturnValue([
      { name: 'cobblestone', count: 256 },
    ]);

    // Mock finding lava
    (bot.blockAt as any).mockImplementation((pos: Vec3) => {
      if (pos.x === 5 && pos.y === 60 && pos.z === 5) {
        return { name: 'lava' };
      }
      return { name: 'air' };
    });

    task.onStart();
    const subtask = task.onTick();

    // Should be searching for or covering lava
    expect([
      CoverWithBlocksState.SEARCHING_LAVA,
      CoverWithBlocksState.COVERING,
    ]).toContain(task.getState());
  });

  it('WHY: Never finishes (continuous task)', () => {
    const task = new CoverWithBlocksTask(bot);

    expect(task.isFinished()).toBe(false);
  });

  it('WHY: All instances are equal', () => {
    const task1 = new CoverWithBlocksTask(bot);
    const task2 = new CoverWithBlocksTask(bot);

    expect(task1.isEqual(task2)).toBe(true);
  });

  it('WHY: coverWithBlocks convenience function works', () => {
    const task = coverWithBlocks(bot);

    expect(task).toBeInstanceOf(CoverWithBlocksTask);
  });
});
