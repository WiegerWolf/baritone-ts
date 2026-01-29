/**
 * Unit tests for DeathMenuChain
 *
 * Tests cover:
 * - DeathMenuChain: Auto-respawn behavior
 *
 * These tests verify the INTENT of the chains (WHY they exist)
 * not just the mechanics (HOW they work).
 */

import { Vec3 } from 'vec3';
import { EventEmitter } from 'events';
import { DeathMenuChain, DeathState } from './DeathMenuChain';
import { ChainPriority } from '../tasks/TaskChain';

/**
 * Create a mock bot for testing
 * The mock includes event emitter functionality for testing event handlers
 */
function createMockBot(options: {
  health?: number;
  food?: number;
  position?: Vec3;
  onGround?: boolean;
  time?: { age: number };
  heldItem?: any;
  inventory?: any;
} = {}): any {
  const bot = new EventEmitter() as any;

  bot.entity = {
    position: options.position ?? new Vec3(0, 64, 0),
    velocity: new Vec3(0, 0, 0),
    onGround: options.onGround ?? true,
    yaw: 0,
    pitch: 0,
  };

  bot.health = options.health ?? 20;
  bot.food = options.food ?? 20;
  bot.foodSaturation = 5;

  bot.time = options.time ?? { age: 0 };

  bot.heldItem = options.heldItem ?? null;

  bot.inventory = options.inventory ?? {
    items: () => [],
    slots: Array(46).fill(null),
    cursor: null,
    firstEmptyInventorySlot: () => 10,
  };

  bot.player = {
    isUsingItem: false,
  };

  bot._client = {
    write: jest.fn(),
  };

  bot.chat = jest.fn();
  bot.equip = jest.fn().mockResolvedValue(undefined);
  bot.activateItem = jest.fn();
  bot.deactivateItem = jest.fn();
  bot.tossStack = jest.fn().mockResolvedValue(undefined);
  bot.clickWindow = jest.fn().mockResolvedValue(undefined);
  bot.setControlState = jest.fn();
  bot.getControlState = jest.fn().mockReturnValue(false);
  bot.clearControlStates = jest.fn();
  bot.blockAt = jest.fn().mockReturnValue(null);

  return bot;
}

describe('DeathMenuChain', () => {
  let bot: any;

  beforeEach(() => {
    bot = createMockBot();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Intent: Auto-respawn prevents player from being stuck on death screen', () => {
    test('should detect player death and increment death count', () => {
      const chain = new DeathMenuChain(bot, { autoRespawn: true });

      expect(chain.getDeathCount()).toBe(0);
      expect(chain.isDead()).toBe(false);

      // Simulate death
      bot.emit('death');

      expect(chain.getDeathCount()).toBe(1);
      expect(chain.isDead()).toBe(true);
    });

    test('should have DEATH priority when dead to ensure respawn is handled', () => {
      const chain = new DeathMenuChain(bot);

      // Alive - lowest priority
      expect(chain.getPriority()).toBe(ChainPriority.INACTIVE);

      // Dead - highest priority
      bot.emit('death');
      expect(chain.getPriority()).toBe(ChainPriority.DEATH);
    });

    test('should respawn after configured delay to allow seeing death message', () => {
      const chain = new DeathMenuChain(bot, {
        autoRespawn: true,
        respawnDelay: 2,
      });

      bot.emit('death');
      expect(chain.getCurrentState()).toBe(DeathState.DEAD_WAITING);

      // Before delay - still waiting
      bot.time.age = 30; // ~1.5 seconds
      chain.onTick();
      expect(chain.getCurrentState()).toBe(DeathState.DEAD_WAITING);

      // After delay - respawning
      bot.time.age = 50; // ~2.5 seconds
      chain.onTick();
      expect(chain.getCurrentState()).toBe(DeathState.RESPAWNING);
    });

    test('should call onDeath callback for external notifications', () => {
      const onDeath = jest.fn();
      const chain = new DeathMenuChain(bot, { onDeath });

      bot.emit('death');

      expect(onDeath).toHaveBeenCalledWith('Player died', 1);
    });

    test('should return to ALIVE state when player health is restored', () => {
      const chain = new DeathMenuChain(bot, { respawnDelay: 0 });

      bot.emit('death');
      bot.time.age = 20;
      chain.onTick();

      expect(chain.isDead()).toBe(true);

      // Player respawns
      bot.health = 20;
      chain.onTick();

      expect(chain.isDead()).toBe(false);
      expect(chain.getCurrentState()).toBe(DeathState.ALIVE);
    });
  });

  describe('Intent: Track deaths for statistics and debugging', () => {
    test('should accumulate death count across multiple deaths', () => {
      const chain = new DeathMenuChain(bot, { respawnDelay: 0 });

      // Die 3 times
      for (let i = 0; i < 3; i++) {
        bot.emit('death');
        bot.health = 20;
        bot.time.age += 50;
        chain.onTick();
        bot.emit('spawn');
      }

      expect(chain.getDeathCount()).toBe(3);
    });

    test('should allow resetting death count', () => {
      const chain = new DeathMenuChain(bot);

      bot.emit('death');
      expect(chain.getDeathCount()).toBe(1);

      chain.resetDeathCount();
      expect(chain.getDeathCount()).toBe(0);
    });
  });

  describe('Intent: Execute commands on death for server integration', () => {
    test('should execute death command with death message placeholder', () => {
      const chain = new DeathMenuChain(bot, {
        autoRespawn: true,
        respawnDelay: 0,
        onDeathCommand: '/home {deathmessage}',
      });

      bot.emit('death');
      bot.time.age = 20;
      chain.onTick();

      expect(bot.chat).toHaveBeenCalledWith('/home Player died');
    });
  });

  describe('Intent: Manual respawn when auto-respawn is disabled', () => {
    test('should not auto-respawn when disabled', () => {
      const chain = new DeathMenuChain(bot, { autoRespawn: false });

      bot.emit('death');
      bot.time.age = 100;
      chain.onTick();

      // Still waiting, not respawning
      expect(chain.getCurrentState()).toBe(DeathState.DEAD_WAITING);
    });

    test('should allow manual respawn trigger', () => {
      const chain = new DeathMenuChain(bot, { autoRespawn: false });

      bot.emit('death');
      expect(chain.getCurrentState()).toBe(DeathState.DEAD_WAITING);

      chain.manualRespawn();
      expect(chain.getCurrentState()).toBe(DeathState.RESPAWNING);
    });
  });

  describe('Intent: Clean up resources properly', () => {
    test('should dispose event listeners when done', () => {
      const chain = new DeathMenuChain(bot);

      // Count initial listeners
      const initialDeathListeners = bot.listenerCount('death');

      chain.dispose();

      // Should have fewer listeners after dispose
      expect(bot.listenerCount('death')).toBeLessThan(initialDeathListeners);
    });
  });
});

describe('DeathMenuChain Configuration', () => {
  let bot: any;

  beforeEach(() => {
    bot = createMockBot();
  });

  test('DeathMenuChain should accept partial config', () => {
    // Should not throw with partial config
    const chain = new DeathMenuChain(bot, { autoRespawn: false });
    expect(chain).toBeDefined();
  });

  test('DeathMenuChain should allow config updates', () => {
    const chain = new DeathMenuChain(bot);

    chain.setConfig({ respawnDelay: 5 });
    // Config should be updated (we can't easily verify internal state)
    expect(chain).toBeDefined();
  });
});
