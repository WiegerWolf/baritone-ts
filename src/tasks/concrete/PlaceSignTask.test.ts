/**
 * Tests for PlaceSignTask
 *
 * WHY this task matters:
 * - PlaceSignTask: Leave messages at locations, mark waypoints
 *
 * This automates sign placement for navigation and communication.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import {
  PlaceSignTask,
  PlaceSignState,
  placeSign,
  WOOD_SIGNS,
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

describe('PlaceSignTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  it('WHY: Creates task to place a sign with a message', () => {
    const task = new PlaceSignTask(bot, 'Hello World!');

    expect(task.displayName).toContain('PlaceSign');
    expect(task.displayName).toContain('Hello World!');
  });

  it('WHY: Includes position in display name when specified', () => {
    const pos = new BlockPos(10, 65, 20);
    const task = new PlaceSignTask(bot, 'Test', pos);

    expect(task.displayName).toContain('10');
    expect(task.displayName).toContain('65');
    expect(task.displayName).toContain('20');
  });

  it('WHY: Starts in GETTING_SIGN state', () => {
    const task = new PlaceSignTask(bot, 'Test');

    task.onStart();
    expect(task.getState()).toBe(PlaceSignState.GETTING_SIGN);
  });

  it('WHY: Returns the message to write', () => {
    const message = 'Important waypoint here!';
    const task = new PlaceSignTask(bot, message);

    expect(task.getMessage()).toBe(message);
  });

  it('WHY: Tasks with same message and position are equal', () => {
    const pos = new BlockPos(10, 65, 20);
    const task1 = new PlaceSignTask(bot, 'Test', pos);
    const task2 = new PlaceSignTask(bot, 'Test', pos);

    expect(task1.isEqual(task2)).toBe(true);
  });

  it('WHY: Tasks with different messages are not equal', () => {
    const task1 = new PlaceSignTask(bot, 'Hello');
    const task2 = new PlaceSignTask(bot, 'World');

    expect(task1.isEqual(task2)).toBe(false);
  });

  it('WHY: Tasks with and without positions are not equal', () => {
    const pos = new BlockPos(10, 65, 20);
    const task1 = new PlaceSignTask(bot, 'Test', pos);
    const task2 = new PlaceSignTask(bot, 'Test');

    expect(task1.isEqual(task2)).toBe(false);
  });

  it('WHY: placeSign convenience function works', () => {
    const task = placeSign(bot, 'Test Message');

    expect(task).toBeInstanceOf(PlaceSignTask);
    expect(task.getMessage()).toBe('Test Message');
  });

  it('WHY: placeSign accepts optional position', () => {
    const pos = new BlockPos(5, 60, 10);
    const task = placeSign(bot, 'Positioned', pos);

    expect(task).toBeInstanceOf(PlaceSignTask);
  });

  it('WHY: WOOD_SIGNS includes all wood sign types', () => {
    expect(WOOD_SIGNS).toContain('oak_sign');
    expect(WOOD_SIGNS).toContain('spruce_sign');
    expect(WOOD_SIGNS).toContain('birch_sign');
    expect(WOOD_SIGNS).toContain('jungle_sign');
    expect(WOOD_SIGNS).toContain('acacia_sign');
    expect(WOOD_SIGNS).toContain('dark_oak_sign');
    expect(WOOD_SIGNS).toContain('crimson_sign');
    expect(WOOD_SIGNS).toContain('warped_sign');
  });

  it('WHY: Returns null if no sign available', () => {
    const task = new PlaceSignTask(bot, 'Test');
    (bot.inventory.items as any).mockReturnValue([]);

    task.onStart();
    const subtask = task.onTick();

    // No sign = returns null (would need to get sign)
    expect(subtask).toBeNull();
    expect(task.getState()).toBe(PlaceSignState.GETTING_SIGN);
  });
});
