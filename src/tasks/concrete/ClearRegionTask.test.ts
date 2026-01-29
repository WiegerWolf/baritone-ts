/**
 * Tests for ClearRegionTask
 *
 * WHY this task matters:
 * - ClearRegionTask: Excavate 3D regions for building or mining
 *
 * This automates tedious multi-step excavation operations.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import {
  ClearRegionTask,
  ClearRegionState,
  clearRegion,
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

describe('ClearRegionTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  it('WHY: Creates task to clear a 3D region', () => {
    const from = new BlockPos(0, 60, 0);
    const to = new BlockPos(10, 70, 10);
    const task = new ClearRegionTask(bot, from, to);

    expect(task.displayName).toContain('ClearRegion');
    expect(task.displayName).toContain('0,60,0');
    expect(task.displayName).toContain('10,70,10');
  });

  it('WHY: Normalizes coordinates (min/max)', () => {
    // Provide in wrong order - should normalize
    const from = new BlockPos(10, 70, 10);
    const to = new BlockPos(0, 60, 0);
    const task = new ClearRegionTask(bot, from, to);

    const region = task.getRegion();
    expect(region.from.x).toBe(0);
    expect(region.from.y).toBe(60);
    expect(region.to.x).toBe(10);
    expect(region.to.y).toBe(70);
  });

  it('WHY: Starts in SCANNING state', () => {
    const task = new ClearRegionTask(bot, new BlockPos(0, 60, 0), new BlockPos(5, 65, 5));

    task.onStart();
    expect(task.getState()).toBe(ClearRegionState.SCANNING);
  });

  it('WHY: Returns subtask to destroy non-air blocks', () => {
    const task = new ClearRegionTask(bot, new BlockPos(0, 60, 0), new BlockPos(2, 62, 2));
    (bot.blockAt as any).mockReturnValue({ name: 'stone' });

    task.onStart();
    const subtask = task.onTick();

    expect(task.getState()).toBe(ClearRegionState.DESTROYING);
    expect(subtask).not.toBeNull();
  });

  it('WHY: Returns null when region is all air', () => {
    const task = new ClearRegionTask(bot, new BlockPos(0, 60, 0), new BlockPos(2, 62, 2));
    (bot.blockAt as any).mockReturnValue({ name: 'air' });

    task.onStart();
    const subtask = task.onTick();

    expect(task.getState()).toBe(ClearRegionState.FINISHED);
    expect(subtask).toBeNull();
  });

  it('WHY: isFinished returns true when region is cleared', () => {
    const task = new ClearRegionTask(bot, new BlockPos(0, 60, 0), new BlockPos(2, 62, 2));
    (bot.blockAt as any).mockReturnValue({ name: 'air' });

    expect(task.isFinished()).toBe(true);
  });

  it('WHY: Tasks with same regions are equal', () => {
    const task1 = new ClearRegionTask(bot, new BlockPos(0, 60, 0), new BlockPos(10, 70, 10));
    const task2 = new ClearRegionTask(bot, new BlockPos(0, 60, 0), new BlockPos(10, 70, 10));

    expect(task1.isEqual(task2)).toBe(true);
  });

  it('WHY: Tasks with different regions are not equal', () => {
    const task1 = new ClearRegionTask(bot, new BlockPos(0, 60, 0), new BlockPos(10, 70, 10));
    const task2 = new ClearRegionTask(bot, new BlockPos(0, 60, 0), new BlockPos(20, 80, 20));

    expect(task1.isEqual(task2)).toBe(false);
  });

  it('WHY: clearRegion convenience function works', () => {
    const task = clearRegion(bot, new BlockPos(0, 60, 0), new BlockPos(10, 70, 10));

    expect(task).toBeInstanceOf(ClearRegionTask);
  });
});
