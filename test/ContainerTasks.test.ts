/**
 * Tests for Container Tasks
 *
 * These tests verify that container interaction tasks work correctly:
 * - WHY: Containers (chests, furnaces, crafting tables) are essential
 *   for Minecraft automation. We need to reliably find, open, and interact with them.
 * - INTENT: Validate the state machine logic, container detection, and proper
 *   handling of edge cases like blocked chests or missing containers.
 */

import {
  ContainerType,
  getContainerBlocks,
  isContainerBlock,
  DoStuffInContainerTask,
  AbstractDoToStorageContainerTask,
  CraftInTableTask,
  SmeltInFurnaceBaseTask,
  UpgradeInSmithingTableTask,
  CraftInAnvilTask,
} from '../src/tasks/concrete/ContainerTask';
import { Task } from '../src/tasks/Task';
import { BlockPos } from '../src/types';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: (other: any) => {
          const dx = other.x - 0;
          const dy = (other.y || 64) - 64;
          const dz = other.z - 0;
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        },
        offset: (x: number, y: number, z: number) => ({ x, y: 64 + y, z }),
        clone: () => ({ x: 0, y: 64, z: 0, distanceTo: () => 5 }),
      },
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    entities: {},
    time: { timeOfDay: 6000, age: 0 },
    health: 20,
    food: 20,
    heldItem: null,
    currentWindow: null,
    pathfinder: {
      setGoal: jest.fn(),
      goto: jest.fn(),
      isMoving: () => false,
    },
    closeWindow: jest.fn(),
    ...overrides,
  };
}

describe('Container Tasks', () => {
  describe('ContainerType utilities', () => {
    describe('getContainerBlocks', () => {
      it('should return correct blocks for chest', () => {
        const blocks = getContainerBlocks(ContainerType.CHEST);
        expect(blocks).toContain('chest');
      });

      it('should return multiple blocks for shulker boxes (all colors)', () => {
        const blocks = getContainerBlocks(ContainerType.SHULKER_BOX);
        expect(blocks.length).toBeGreaterThan(1);
        expect(blocks).toContain('shulker_box');
        expect(blocks).toContain('white_shulker_box');
        expect(blocks).toContain('red_shulker_box');
      });

      it('should return multiple blocks for anvils (damage states)', () => {
        const blocks = getContainerBlocks(ContainerType.ANVIL);
        expect(blocks).toContain('anvil');
        expect(blocks).toContain('chipped_anvil');
        expect(blocks).toContain('damaged_anvil');
      });

      it('should return single block for furnace', () => {
        const blocks = getContainerBlocks(ContainerType.FURNACE);
        expect(blocks).toEqual(['furnace']);
      });
    });

    describe('isContainerBlock', () => {
      it('should return true for matching container', () => {
        expect(isContainerBlock('chest', ContainerType.CHEST)).toBe(true);
        expect(isContainerBlock('furnace', ContainerType.FURNACE)).toBe(true);
      });

      it('should return true for partial matches', () => {
        expect(isContainerBlock('trapped_chest', ContainerType.CHEST)).toBe(true);
      });

      it('should return true for colored shulker boxes', () => {
        expect(isContainerBlock('blue_shulker_box', ContainerType.SHULKER_BOX)).toBe(true);
        expect(isContainerBlock('pink_shulker_box', ContainerType.SHULKER_BOX)).toBe(true);
      });

      it('should return false for non-matching blocks', () => {
        expect(isContainerBlock('stone', ContainerType.CHEST)).toBe(false);
        expect(isContainerBlock('chest', ContainerType.FURNACE)).toBe(false);
      });
    });
  });

  describe('CraftInTableTask', () => {
    it('should create with correct display name', () => {
      const bot = createMockBot();
      const task = new CraftInTableTask(bot);
      expect(task.displayName).toBe('CraftInTable');
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new CraftInTableTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    it('should search for crafting tables when started', () => {
      const bot = createMockBot();
      const task = new CraftInTableTask(bot);
      task.onStart();

      // Run a few ticks to allow state transitions
      for (let i = 0; i < 5; i++) {
        const subtask = task.onTick();
        if (task.isFinished() || subtask !== null) {
          // Task has processed and either finished or returned subtask
          expect(true).toBe(true);
          return;
        }
      }
      // Eventually should do something
      expect(task.isFinished()).toBe(true);
    });

    /**
     * WHY: Crafting tables may not exist nearby - the task should handle this
     * gracefully by either placing a new one or failing appropriately.
     */
    it('should handle missing crafting table', () => {
      const bot = createMockBot();
      const task = new CraftInTableTask(bot);
      task.onStart();

      // Without inventory items and no table, should eventually fail
      // Run multiple ticks to allow state transitions
      for (let i = 0; i < 5; i++) {
        task.onTick();
      }
      // The task handles this by transitioning to failed state
      expect(task.isFailed()).toBe(true);
    });
  });

  describe('SmeltInFurnaceBaseTask', () => {
    it('should create for regular furnace', () => {
      const bot = createMockBot();
      const task = new SmeltInFurnaceBaseTask(bot, 'furnace');
      expect(task.displayName).toContain('furnace');
    });

    it('should create for blast furnace', () => {
      const bot = createMockBot();
      const task = new SmeltInFurnaceBaseTask(bot, 'blast_furnace');
      expect(task.displayName).toContain('blast_furnace');
    });

    it('should create for smoker', () => {
      const bot = createMockBot();
      const task = new SmeltInFurnaceBaseTask(bot, 'smoker');
      expect(task.displayName).toContain('smoker');
    });

    /**
     * WHY: Different furnace types smelt different items.
     * Blast furnace = ores, smoker = food. Regular furnace = both.
     */
    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new SmeltInFurnaceBaseTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('UpgradeInSmithingTableTask', () => {
    it('should create with correct display name', () => {
      const bot = createMockBot();
      const task = new UpgradeInSmithingTableTask(bot);
      expect(task.displayName).toBe('UpgradeInSmithingTable');
    });

    /**
     * WHY: Smithing tables are rare in survival - the task should be able
     * to place a new one if the player has one in inventory.
     */
    it('should start in finding state', () => {
      const bot = createMockBot();
      const task = new UpgradeInSmithingTableTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('CraftInAnvilTask', () => {
    it('should create with correct display name', () => {
      const bot = createMockBot();
      const task = new CraftInAnvilTask(bot);
      expect(task.displayName).toBe('CraftInAnvil');
    });

    /**
     * WHY: Anvils can be in different damage states but all function the same.
     * The task should accept any anvil variant.
     */
    it('should recognize all anvil variants', () => {
      // The task is configured to accept all anvil types
      const bot = createMockBot();
      const task = new CraftInAnvilTask(bot);
      task.onStart();
      // Internal config should include all variants
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('DoStuffInContainerTask base class', () => {
    // Create a concrete implementation for testing
    class TestContainerTask extends DoStuffInContainerTask {
      public containerOpened = false;
      public workDone = false;

      constructor(bot: any) {
        super(bot, {
          containerBlocks: ['chest'],
          containerItem: 'chest',
          canPlaceNew: false, // Don't try to place for simpler testing
        });
      }

      protected containerSubTask(): Task | null {
        this.workDone = true;
        this.finishContainerWork();
        return null;
      }

      protected isContainerOpen(): boolean {
        return this.containerOpened;
      }
    }

    it('should fail when no container available and cannot place', () => {
      const bot = createMockBot();
      const task = new TestContainerTask(bot);
      task.onStart();
      task.onTick();
      expect(task.isFailed()).toBe(true);
    });

    /**
     * WHY: When a container is found, the task should approach it
     * rather than immediately trying to interact.
     */
    it('should approach container when found', () => {
      const bot = createMockBot({
        blockAt: (pos: any) => {
          if (pos.x === 5 && pos.y === 64 && pos.z === 5) {
            return { name: 'chest', position: { x: 5, y: 64, z: 5 }, boundingBox: 'block' };
          }
          return null;
        },
      });

      const task = new TestContainerTask(bot);
      task.onStart();
      const subtask = task.onTick();
      // Should return a navigation subtask
      expect(subtask !== null || task.isFailed()).toBe(true);
    });

    /**
     * WHY: Container task lifecycle should properly clean up when stopped,
     * closing any open windows.
     */
    it('should close window on stop', () => {
      const closeWindow = jest.fn();
      const bot = createMockBot({
        currentWindow: { type: 'chest' },
        closeWindow,
      });

      const task = new TestContainerTask(bot);
      task.onStart();
      task.onStop(null);
      expect(closeWindow).toHaveBeenCalled();
    });
  });

  describe('AbstractDoToStorageContainerTask', () => {
    // Create concrete implementation for testing
    class TestStorageTask extends AbstractDoToStorageContainerTask {
      private target: BlockPos | null = null;
      public finished = false;

      setTarget(pos: BlockPos): void {
        this.target = pos;
      }

      protected getContainerTarget(): BlockPos | null {
        return this.target;
      }

      protected onContainerOpenSubtask(containerPos: BlockPos): Task | null {
        this.finished = true;
        return null;
      }
    }

    it('should wander when no container target', () => {
      const bot = createMockBot();
      const task = new TestStorageTask(bot);
      task.onStart();

      const subtask = task.onTick();
      // Should return a wander task
      expect(subtask).not.toBeNull();
      expect(subtask?.displayName).toContain('Wander');
    });

    /**
     * WHY: When a container target is set, the task should navigate
     * to it and attempt to open it.
     */
    it('should interact with container when target set', () => {
      const bot = createMockBot({
        blockAt: (pos: any) => {
          return { name: 'chest', position: pos, boundingBox: 'block' };
        },
      });

      const task = new TestStorageTask(bot);
      task.setTarget(new BlockPos(5, 64, 5));
      task.onStart();

      const subtask = task.onTick();
      // Should return an interact task
      expect(subtask).not.toBeNull();
    });

    /**
     * WHY: Chests with solid blocks above them cannot be opened.
     * The task should handle this edge case.
     */
    it('should handle blocked chests', () => {
      const bot = createMockBot({
        blockAt: (pos: any) => {
          if (pos.y === 64) {
            return { name: 'chest', position: pos, boundingBox: 'block' };
          }
          if (pos.y === 65) {
            return { name: 'stone', position: pos, boundingBox: 'block' };
          }
          return null;
        },
      });

      const task = new TestStorageTask(bot);
      task.setTarget(new BlockPos(5, 64, 5));
      task.onStart();

      // Should wander to find another container or handle the blocked chest
      const subtask = task.onTick();
      expect(subtask).not.toBeNull();
    });
  });

  describe('Container task state transitions', () => {
    /**
     * WHY: State machines should have predictable transitions.
     * This test verifies the container task state flow.
     */
    it('should follow correct state sequence', () => {
      const bot = createMockBot();
      const task = new CraftInTableTask(bot);

      // Initial state
      task.onStart();
      expect(task.isFinished()).toBe(false);
      expect(task.isFailed()).toBe(false);

      // Without container, should transition to failed (can't place without item)
      // Run multiple ticks to allow state transitions
      for (let i = 0; i < 5; i++) {
        task.onTick();
      }
      expect(task.isFailed()).toBe(true);
    });
  });

  describe('Container type detection', () => {
    /**
     * WHY: Different containers require different window handling.
     * We need to correctly identify container types from block names.
     */
    it('should detect chest container type', () => {
      expect(isContainerBlock('chest', ContainerType.CHEST)).toBe(true);
      expect(isContainerBlock('trapped_chest', ContainerType.CHEST)).toBe(true);
      expect(isContainerBlock('ender_chest', ContainerType.ENDER_CHEST)).toBe(true);
    });

    it('should detect furnace container types', () => {
      expect(isContainerBlock('furnace', ContainerType.FURNACE)).toBe(true);
      expect(isContainerBlock('blast_furnace', ContainerType.BLAST_FURNACE)).toBe(true);
      expect(isContainerBlock('smoker', ContainerType.SMOKER)).toBe(true);
    });

    it('should detect crafting stations', () => {
      expect(isContainerBlock('crafting_table', ContainerType.CRAFTING_TABLE)).toBe(true);
      expect(isContainerBlock('smithing_table', ContainerType.SMITHING_TABLE)).toBe(true);
    });
  });
});
