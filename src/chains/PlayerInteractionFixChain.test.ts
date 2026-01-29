/**
 * Unit tests for PlayerInteractionFixChain
 *
 * Tests cover:
 * - PlayerInteractionFixChain: Tool switching and inventory fixes
 *
 * These tests verify the INTENT of the chains (WHY they exist)
 * not just the mechanics (HOW they work).
 */

import { Vec3 } from 'vec3';
import { EventEmitter } from 'events';
import { PlayerInteractionFixChain } from './PlayerInteractionFixChain';
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

describe('PlayerInteractionFixChain', () => {
  let bot: any;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Intent: Auto-equip best tool when mining blocks', () => {
    test('should equip pickaxe when breaking stone', async () => {
      const ironPickaxe = { name: 'iron_pickaxe', slot: 5 };
      bot.inventory.items = () => [ironPickaxe];

      const chain = new PlayerInteractionFixChain(bot, {
        autoEquipBestTool: true,
        toolSwitchCooldown: 0,
      });

      const stoneBlock = {
        name: 'stone',
        position: new Vec3(0, 64, 0)
      };
      bot.blockAt = jest.fn().mockReturnValue(stoneBlock);

      // Simulate breaking stone (called externally since mineflayer lacks this event)
      chain.onDiggingStarted(stoneBlock as any);

      chain.onTick();

      expect(bot.equip).toHaveBeenCalledWith(ironPickaxe, 'hand');
    });

    test('should prefer diamond tools over iron tools', async () => {
      const ironPickaxe = { name: 'iron_pickaxe', slot: 5 };
      const diamondPickaxe = { name: 'diamond_pickaxe', slot: 6 };
      bot.inventory.items = () => [ironPickaxe, diamondPickaxe];

      const chain = new PlayerInteractionFixChain(bot, {
        autoEquipBestTool: true,
        toolSwitchCooldown: 0,
      });

      const stoneBlock = { name: 'stone', position: new Vec3(0, 64, 0) };
      bot.blockAt = jest.fn().mockReturnValue(stoneBlock);

      chain.onDiggingStarted(stoneBlock as any);
      chain.onTick();

      // Should pick diamond, not iron
      expect(bot.equip).toHaveBeenCalledWith(diamondPickaxe, 'hand');
    });

    test('should equip axe for wood blocks', async () => {
      const axe = { name: 'iron_axe', slot: 5 };
      bot.inventory.items = () => [axe];

      const chain = new PlayerInteractionFixChain(bot, {
        autoEquipBestTool: true,
        toolSwitchCooldown: 0,
      });

      const logBlock = { name: 'oak_log', position: new Vec3(0, 64, 0) };
      bot.blockAt = jest.fn().mockReturnValue(logBlock);

      chain.onDiggingStarted(logBlock as any);
      chain.onTick();

      expect(bot.equip).toHaveBeenCalledWith(axe, 'hand');
    });

    test('should equip shovel for dirt/sand', async () => {
      const shovel = { name: 'iron_shovel', slot: 5 };
      bot.inventory.items = () => [shovel];

      const chain = new PlayerInteractionFixChain(bot, {
        autoEquipBestTool: true,
        toolSwitchCooldown: 0,
      });

      const dirtBlock = { name: 'dirt', position: new Vec3(0, 64, 0) };
      bot.blockAt = jest.fn().mockReturnValue(dirtBlock);

      chain.onDiggingStarted(dirtBlock as any);
      chain.onTick();

      expect(bot.equip).toHaveBeenCalledWith(shovel, 'hand');
    });

    test('should not switch tools if already holding best tool', async () => {
      const pickaxe = { name: 'iron_pickaxe', slot: 5 };
      bot.inventory.items = () => [pickaxe];
      bot.heldItem = pickaxe;

      const chain = new PlayerInteractionFixChain(bot);

      const stoneBlock = { name: 'stone', position: new Vec3(0, 64, 0) };
      bot.blockAt = jest.fn().mockReturnValue(stoneBlock);

      chain.onDiggingStarted(stoneBlock as any);
      chain.onTick();

      expect(bot.equip).not.toHaveBeenCalled();
    });
  });

  describe('Intent: Release stuck shift key to prevent movement issues', () => {
    test('should release shift after timeout when held too long', () => {
      bot.getControlState = jest.fn().mockReturnValue(true); // Sneaking

      const chain = new PlayerInteractionFixChain(bot, {
        fixStuckShift: true,
        shiftTimeout: 10,
      });

      // Initial tick
      chain.onTick();
      expect(bot.setControlState).not.toHaveBeenCalled();

      // After timeout
      bot.time.age = 210; // ~10.5 seconds
      chain.onTick();

      expect(bot.setControlState).toHaveBeenCalledWith('sneak', false);
    });

    test('should reset timer when shift is released normally', () => {
      bot.getControlState = jest.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const chain = new PlayerInteractionFixChain(bot, {
        fixStuckShift: true,
        shiftTimeout: 10,
      });

      chain.onTick(); // Sneaking
      chain.onTick(); // Not sneaking anymore

      // Timer should be reset, no release called
      expect(bot.setControlState).not.toHaveBeenCalled();
    });
  });

  describe('Intent: Track block breaking state for other systems', () => {
    test('should report when breaking a block', () => {
      const chain = new PlayerInteractionFixChain(bot);

      expect(chain.isBreaking()).toBe(false);

      const block = { name: 'stone', position: new Vec3(5, 64, 10) };
      chain.onDiggingStarted(block as any);

      expect(chain.isBreaking()).toBe(true);
      expect(chain.getBreakingPosition()).toEqual(new Vec3(5, 64, 10));
    });

    test('should report when block breaking stops', () => {
      const chain = new PlayerInteractionFixChain(bot);

      chain.onDiggingStarted({ name: 'stone', position: new Vec3(0, 64, 0) } as any);
      expect(chain.isBreaking()).toBe(true);

      bot.emit('diggingCompleted', { name: 'stone', position: new Vec3(0, 64, 0) });
      expect(chain.isBreaking()).toBe(false);
      expect(chain.getBreakingPosition()).toBeNull();
    });
  });

  describe('Intent: Always run in background without blocking other chains', () => {
    test('should always be active', () => {
      const chain = new PlayerInteractionFixChain(bot);
      expect(chain.isActive()).toBe(true);
    });

    test('should have inactive priority to not block other chains', () => {
      const chain = new PlayerInteractionFixChain(bot);
      expect(chain.getPriority()).toBe(ChainPriority.INACTIVE);
    });
  });

  describe('Intent: Clean up resources properly', () => {
    test('should dispose event listeners when done', () => {
      const chain = new PlayerInteractionFixChain(bot);

      const initialListeners = bot.listenerCount('diggingCompleted');

      chain.dispose();

      expect(bot.listenerCount('diggingCompleted')).toBeLessThan(initialListeners);
    });
  });

  describe('Intent: Provide debug information for troubleshooting', () => {
    test('should generate debug info string', () => {
      const chain = new PlayerInteractionFixChain(bot);

      const debug = chain.getDebugInfo();

      expect(debug).toContain('PlayerInteractionFixChain');
      expect(debug).toContain('Breaking:');
      expect(debug).toContain('Held item:');
    });
  });
});

describe('PlayerInteractionFixChain Configuration', () => {
  let bot: any;

  beforeEach(() => {
    bot = createMockBot();
  });

  test('PlayerInteractionFixChain should accept partial config', () => {
    const chain = new PlayerInteractionFixChain(bot, { autoEquipBestTool: false });
    expect(chain).toBeDefined();
  });

  test('PlayerInteractionFixChain should allow config updates', () => {
    const chain = new PlayerInteractionFixChain(bot);

    chain.setConfig({ shiftTimeout: 20 });
    expect(chain).toBeDefined();
  });
});
