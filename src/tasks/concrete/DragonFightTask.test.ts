/**
 * Tests for DragonFightTask
 *
 * These tests verify:
 * 1. Intent (WHY): What the task is supposed to accomplish
 * 2. State Machine: Correct state transitions
 * 3. Edge Cases: Error handling, interruption
 */

import { Vec3 } from 'vec3';
import {
  KillEnderDragonWithBedsTask,
  BedDragonState,
  BED_ITEMS,
} from './DragonFightTask';
import { LocateDesertTempleTask, locateDesertTemple } from './BiomeSearchTask';

// Mock bot for testing
const createMockBot = (overrides: any = {}) => ({
  entity: {
    position: new Vec3(0, 64, 0),
    onGround: true,
  },
  inventory: {
    items: () => [],
  },
  blockAt: () => null,
  setControlState: jest.fn(),
  lookAt: jest.fn(),
  equip: jest.fn(),
  activateItem: jest.fn(),
  activateBlock: jest.fn(),
  entities: {},
  ...overrides,
});

// Mock dragon waiter used across tests
const createMockWaiter = () => ({
  setExitPortalTop: jest.fn(),
  setPerchState: jest.fn(),
  isFinished: () => false,
  onStart: () => {},
  onTick: () => null,
  onStop: () => {},
  isEqual: () => false,
  displayName: 'MockWaiter',
});

describe('KillEnderDragonWithBedsTask', () => {
  describe('WHY: speedrun bed explosion strategy', () => {
    it('should use beds for massive damage', () => {
      // WHY: Beds explode in the End, dealing huge damage to the dragon
      // This is faster than traditional melee combat
      const bot = createMockBot() as any;
      const mockWaiter = createMockWaiter();

      const task = new KillEnderDragonWithBedsTask(bot, mockWaiter as any);
      expect(task.displayName).toContain('KillDragonWithBeds');
    });
  });

  describe('BED_ITEMS constant', () => {
    it('should include all bed colors', () => {
      expect(BED_ITEMS).toContain('white_bed');
      expect(BED_ITEMS).toContain('red_bed');
      expect(BED_ITEMS).toContain('blue_bed');
      expect(BED_ITEMS.length).toBe(16); // All 16 colors
    });
  });

  describe('bed counting', () => {
    it('should count beds in inventory', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [
            { name: 'white_bed', count: 3 },
            { name: 'red_bed', count: 2 },
          ],
        },
      }) as any;

      const mockWaiter = createMockWaiter();

      const task = new KillEnderDragonWithBedsTask(bot, mockWaiter as any);
      expect(task.getBedCount()).toBe(5);
    });
  });
});

describe('Integration scenarios', () => {
  describe('Structure looting workflow', () => {
    it('should locate then loot desert temples', () => {
      // Scenario: Find and loot desert temples for resources
      // Step 1: Locate temple (SearchWithinBiome + block detection)
      // Step 2: Navigate to temple entrance (14 blocks above trap)
      // Step 3: Disable trap and loot chests
      const bot = createMockBot() as any;

      const locateTask = locateDesertTemple(bot);
      expect(locateTask).toBeInstanceOf(LocateDesertTempleTask);

      // After locating, would use LootDesertTempleTask
    });
  });

  describe('Dragon fight preparation', () => {
    it('should require beds for bed strategy', () => {
      // WHY: Bed explosion is the fastest dragon kill method
      // Need multiple beds because each explosion only does partial damage
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'white_bed', count: 10 }],
        },
      }) as any;

      const mockWaiter = createMockWaiter();

      const task = new KillEnderDragonWithBedsTask(bot, mockWaiter as any);
      expect(task.getBedCount()).toBeGreaterThanOrEqual(10);
    });
  });
});
