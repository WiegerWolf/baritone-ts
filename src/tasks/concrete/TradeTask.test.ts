/**
 * Tests for Trading Tasks
 *
 * These tests verify:
 * 1. Intent - What each task is supposed to accomplish (WHY)
 * 2. State Machine - Correct state transitions
 * 3. Edge Cases - Error handling and boundary conditions
 */

import { describe, it, expect, mock } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  TradeWithPiglinsTask,
  tradeWithPiglins,
  tradeForEnderPearls,
} from './TradeTask';
import { itemTarget } from './ResourceTask';

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
    lookAt: mock(),
    look: mock(),
    setControlState: mock(),
    clearControlStates: mock(),
    equip: mock(),
    activateBlock: mock(),
    useOn: mock(),
    wake: mock(),
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
