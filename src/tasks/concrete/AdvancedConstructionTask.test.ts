/**
 * Tests for Advanced Construction Tasks
 *
 * WHY these tasks matter:
 * - PlaceSignTask: Leave messages at locations, mark waypoints
 * - ClearRegionTask: Excavate 3D regions for building or mining
 * - CoverWithBlocksTask: Cover lava for safe Nether traversal
 * - ConstructIronGolemTask: Build iron golems for defense/farming
 *
 * These automate tedious multi-step construction operations.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import {
  PlaceSignTask,
  PlaceSignState,
  ClearRegionTask,
  ClearRegionState,
  CoverWithBlocksTask,
  CoverWithBlocksState,
  ConstructIronGolemTask,
  ConstructIronGolemState,
  PlaceStructureBlockTask,
  PlaceStructureBlockState,
  placeSign,
  clearRegion,
  coverWithBlocks,
  constructIronGolem,
  placeStructureBlock,
  placeStructureBlockAt,
  THROWAWAY_BLOCKS,
  WOOD_SIGNS,
} from './AdvancedConstructionTask';
import {
  AbstractDoToClosestObjectTask,
  DoToClosestObjectTask,
  doToClosestObject,
  DoToClosestObjectConfig,
} from './AbstractDoToClosestObjectTask';
import { Task } from '../Task';

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
      items: jest.fn().mockReturnValue([]),
      slots: {},
    },
    blockAt: jest.fn().mockReturnValue({ name: 'air' }),
    entities: {},
    game: {
      dimension: 'minecraft:overworld',
    },
    look: jest.fn(),
    lookAt: jest.fn(),
    attack: jest.fn(),
    equip: jest.fn(),
    activateItem: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
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
    (bot.inventory.items as jest.Mock).mockReturnValue([]);

    task.onStart();
    const subtask = task.onTick();

    // No sign = returns null (would need to get sign)
    expect(subtask).toBeNull();
    expect(task.getState()).toBe(PlaceSignState.GETTING_SIGN);
  });
});

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
    (bot.blockAt as jest.Mock).mockReturnValue({ name: 'stone' });

    task.onStart();
    const subtask = task.onTick();

    expect(task.getState()).toBe(ClearRegionState.DESTROYING);
    expect(subtask).not.toBeNull();
  });

  it('WHY: Returns null when region is all air', () => {
    const task = new ClearRegionTask(bot, new BlockPos(0, 60, 0), new BlockPos(2, 62, 2));
    (bot.blockAt as jest.Mock).mockReturnValue({ name: 'air' });

    task.onStart();
    const subtask = task.onTick();

    expect(task.getState()).toBe(ClearRegionState.FINISHED);
    expect(subtask).toBeNull();
  });

  it('WHY: isFinished returns true when region is cleared', () => {
    const task = new ClearRegionTask(bot, new BlockPos(0, 60, 0), new BlockPos(2, 62, 2));
    (bot.blockAt as jest.Mock).mockReturnValue({ name: 'air' });

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
    (bot.inventory.items as jest.Mock).mockReturnValue([]);

    task.onStart();
    task.onTick();

    expect(task.getState()).toBe(CoverWithBlocksState.GETTING_BLOCKS);
  });

  it('WHY: Covers lava when has enough blocks', () => {
    const task = new CoverWithBlocksTask(bot);
    // Give bot plenty of cobblestone
    (bot.inventory.items as jest.Mock).mockReturnValue([
      { name: 'cobblestone', count: 256 },
    ]);

    // Mock finding lava
    (bot.blockAt as jest.Mock).mockImplementation((pos: Vec3) => {
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

describe('ConstructIronGolemTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  it('WHY: Creates task to construct iron golem', () => {
    const task = new ConstructIronGolemTask(bot);

    expect(task.displayName).toContain('ConstructIronGolem');
  });

  it('WHY: Starts in GETTING_MATERIALS state', () => {
    const task = new ConstructIronGolemTask(bot);

    task.onStart();
    expect(task.getState()).toBe(ConstructIronGolemState.GETTING_MATERIALS);
  });

  it('WHY: Requires 4 iron blocks and 1 carved pumpkin', () => {
    const task = new ConstructIronGolemTask(bot);
    (bot.inventory.items as jest.Mock).mockReturnValue([]);

    task.onStart();
    task.onTick();

    // Without materials, stays in getting materials
    expect(task.getState()).toBe(ConstructIronGolemState.GETTING_MATERIALS);
  });

  it('WHY: Accepts optional position parameter', () => {
    const pos = new BlockPos(100, 65, 100);
    const task = new ConstructIronGolemTask(bot, pos);

    expect(task.getPosition()).toBe(pos);
  });

  it('WHY: Finds position if not specified', () => {
    const task = new ConstructIronGolemTask(bot);
    (bot.inventory.items as jest.Mock).mockReturnValue([
      { name: 'iron_block', count: 4 },
      { name: 'carved_pumpkin', count: 1 },
    ]);
    (bot.blockAt as jest.Mock).mockReturnValue({ name: 'air' });

    task.onStart();
    task.onTick();

    // Should have found a position
    expect(task.getPosition()).not.toBeNull();
  });

  it('WHY: Places iron blocks in correct pattern for golem', () => {
    const pos = new BlockPos(0, 65, 0);
    const task = new ConstructIronGolemTask(bot, pos);
    (bot.inventory.items as jest.Mock).mockReturnValue([
      { name: 'iron_block', count: 4 },
      { name: 'carved_pumpkin', count: 1 },
    ]);
    (bot.blockAt as jest.Mock).mockReturnValue({ name: 'air' });

    task.onStart();
    const subtask = task.onTick();

    // Should be placing base block
    expect(subtask).not.toBeNull();
    expect(task.getState()).toBe(ConstructIronGolemState.PLACING_BASE);
  });

  it('WHY: Detects iron golem spawn for completion', () => {
    const pos = new BlockPos(0, 65, 0);
    const task = new ConstructIronGolemTask(bot, pos);

    // Simulate golem nearby
    (bot as any).entities = {
      '1': { name: 'iron_golem', position: new Vec3(1, 65, 0) },
    };

    task.onStart();
    // Set canBeFinished by going through placement
    (task as any).canBeFinished = true;

    expect(task.isFinished()).toBe(true);
  });

  it('WHY: All instances are equal (same goal)', () => {
    const task1 = new ConstructIronGolemTask(bot);
    const task2 = new ConstructIronGolemTask(bot);

    expect(task1.isEqual(task2)).toBe(true);
  });

  it('WHY: constructIronGolem convenience function works', () => {
    const task = constructIronGolem(bot);

    expect(task).toBeInstanceOf(ConstructIronGolemTask);
  });

  it('WHY: constructIronGolem accepts optional position', () => {
    const pos = new BlockPos(50, 65, 50);
    const task = constructIronGolem(bot, pos);

    expect(task).toBeInstanceOf(ConstructIronGolemTask);
    expect(task.getPosition()).toBe(pos);
  });
});

describe('Integration Concepts', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  describe('Construction Workflows', () => {
    it('WHY: Sign placement enables waypoint marking', () => {
      // Markers are useful for navigation and communication
      const waypoint = placeSign(bot, 'Base entrance', new BlockPos(0, 65, 0));
      expect(waypoint.getMessage()).toBe('Base entrance');
    });

    it('WHY: Region clearing enables excavation', () => {
      // Clearing is prerequisite for underground bases
      const excavation = clearRegion(
        bot,
        new BlockPos(0, 50, 0),
        new BlockPos(10, 60, 10)
      );

      const region = excavation.getRegion();
      const volume = (region.to.x - region.from.x + 1) *
                     (region.to.y - region.from.y + 1) *
                     (region.to.z - region.from.z + 1);

      expect(volume).toBe(11 * 11 * 11);
    });

    it('WHY: Lava covering enables safe Nether traversal', () => {
      // Nether is full of dangerous lava lakes
      const safePath = coverWithBlocks(bot);
      expect(safePath).toBeInstanceOf(CoverWithBlocksTask);
    });

    it('WHY: Iron golem construction enables automated defense', () => {
      // Golems protect bases and can be farmed for iron
      const defender = constructIronGolem(bot);
      expect(defender).toBeInstanceOf(ConstructIronGolemTask);
    });
  });

  describe('State Machines', () => {
    it('WHY: PlaceSignState covers sign placement workflow', () => {
      expect(PlaceSignState.GETTING_SIGN).toBeDefined();
      expect(PlaceSignState.CLEARING_POSITION).toBeDefined();
      expect(PlaceSignState.PLACING_SIGN).toBeDefined();
      expect(PlaceSignState.EDITING_SIGN).toBeDefined();
      expect(PlaceSignState.FINISHED).toBeDefined();
    });

    it('WHY: ClearRegionState covers excavation workflow', () => {
      expect(ClearRegionState.SCANNING).toBeDefined();
      expect(ClearRegionState.DESTROYING).toBeDefined();
      expect(ClearRegionState.FINISHED).toBeDefined();
    });

    it('WHY: CoverWithBlocksState covers lava covering workflow', () => {
      expect(CoverWithBlocksState.GETTING_BLOCKS).toBeDefined();
      expect(CoverWithBlocksState.GOING_TO_NETHER).toBeDefined();
      expect(CoverWithBlocksState.SEARCHING_LAVA).toBeDefined();
      expect(CoverWithBlocksState.COVERING).toBeDefined();
    });

    it('WHY: ConstructIronGolemState covers golem building workflow', () => {
      expect(ConstructIronGolemState.GETTING_MATERIALS).toBeDefined();
      expect(ConstructIronGolemState.FINDING_POSITION).toBeDefined();
      expect(ConstructIronGolemState.PLACING_BASE).toBeDefined();
      expect(ConstructIronGolemState.PLACING_CENTER).toBeDefined();
      expect(ConstructIronGolemState.PLACING_ARMS).toBeDefined();
      expect(ConstructIronGolemState.CLEARING_AREA).toBeDefined();
      expect(ConstructIronGolemState.PLACING_HEAD).toBeDefined();
      expect(ConstructIronGolemState.FINISHED).toBeDefined();
    });
  });

  describe('Material Requirements', () => {
    it('WHY: Signs come in many wood varieties', () => {
      // Different biomes provide different wood types
      expect(WOOD_SIGNS.length).toBeGreaterThanOrEqual(8);
    });

    it('WHY: Throwaway blocks are common and expendable', () => {
      // Should not waste valuable resources on lava covering
      expect(THROWAWAY_BLOCKS).not.toContain('diamond_block');
      expect(THROWAWAY_BLOCKS).not.toContain('gold_block');
    });

    it('WHY: Iron golem requires specific pattern', () => {
      // Classic T-shape with pumpkin head
      const golem = new ConstructIronGolemTask(bot);
      golem.onStart();

      // Task needs iron blocks and carved pumpkin
      expect(golem.getState()).toBe(ConstructIronGolemState.GETTING_MATERIALS);
    });
  });
});

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
      (bot.blockAt as jest.Mock).mockReturnValue({ name: 'air', boundingBox: 'empty' });
      // Mock inventory with cobblestone
      (bot.inventory.items as jest.Mock).mockReturnValue([
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
      (bot.blockAt as jest.Mock).mockReturnValue({ name: 'air', boundingBox: 'empty' });
      // Mock inventory with no throwaway blocks
      (bot.inventory.items as jest.Mock).mockReturnValue([
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
      (bot.blockAt as jest.Mock).mockReturnValue({ name: 'stone', boundingBox: 'block' });

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
      (bot.blockAt as jest.Mock).mockReturnValue({ name: 'air', boundingBox: 'empty' });
      (bot.inventory.items as jest.Mock).mockReturnValue([
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
      (bot.blockAt as jest.Mock).mockReturnValue({ name: 'air', boundingBox: 'empty' });
      (bot.inventory.items as jest.Mock).mockReturnValue([
        { name: 'netherrack', count: 64 },
      ]);

      const task = new PlaceStructureBlockTask(bot, new BlockPos(0, 65, 0));
      task.onStart();
      task.onTick();

      expect(task.getSelectedBlock()).toBe('netherrack');
    });
  });
});

describe('AbstractDoToClosestObjectTask', () => {
  let bot: Bot;

  beforeEach(() => {
    bot = createMockBot();
  });

  // Test objects with positions
  interface TestObject {
    id: number;
    pos: Vec3;
    valid: boolean;
  }

  // Simple mock task for testing
  class MockGoalTask extends Task {
    constructor(bot: Bot, public readonly targetId: number) {
      super(bot);
    }
    get displayName() { return `MockGoal(${this.targetId})`; }
    onTick() { return null; }
    isFinished() { return false; }
    isEqual(other: any) { return other?.targetId === this.targetId; }
  }

  describe('DoToClosestObjectTask', () => {
    it('WHY: Creates task with configuration', () => {
      const objects: TestObject[] = [
        { id: 1, pos: new Vec3(10, 65, 10), valid: true },
      ];

      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: (pos) => {
          if (objects.length === 0) return null;
          return objects.reduce((closest, obj) =>
            obj.pos.distanceTo(pos) < closest.pos.distanceTo(pos) ? obj : closest
          );
        },
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: (obj) => obj.valid,
      };

      const task = new DoToClosestObjectTask(bot, config);
      expect(task.displayName).toBe('DoToClosestObject');
    });

    it('WHY: Starts without a target', () => {
      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => null,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();

      expect(task.getCurrentTarget()).toBeNull();
    });

    it('WHY: Finds closest object on tick', () => {
      const objects: TestObject[] = [
        { id: 1, pos: new Vec3(10, 65, 10), valid: true },
        { id: 2, pos: new Vec3(50, 65, 50), valid: true },
      ];

      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: (pos) => {
          if (objects.length === 0) return null;
          return objects.reduce((closest, obj) =>
            obj.pos.distanceTo(pos) < closest.pos.distanceTo(pos) ? obj : closest
          );
        },
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: (obj) => obj.valid,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();
      task.onTick();

      // Should select the closest object (id=1)
      expect(task.getCurrentTarget()?.id).toBe(1);
    });

    it('WHY: Wanders when no objects found', () => {
      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => null,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();
      const subtask = task.onTick();

      expect(task.wasWandering()).toBe(true);
      expect(subtask).not.toBeNull();
    });

    it('WHY: Invalidates target when no longer valid', () => {
      const objects: TestObject[] = [
        { id: 1, pos: new Vec3(10, 65, 10), valid: true },
      ];

      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        // Return null when object is invalid (simulating it being removed/destroyed)
        getClosestTo: () => objects[0]?.valid ? objects[0] : null,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: (obj) => obj.valid,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();
      task.onTick();

      expect(task.getCurrentTarget()?.id).toBe(1);

      // Invalidate the object
      objects[0].valid = false;
      task.onTick();

      // Target should be cleared (invalidated at start of tick)
      expect(task.getCurrentTarget()).toBeNull();
    });

    it('WHY: resetSearch clears target and heuristics', () => {
      const objects: TestObject[] = [
        { id: 1, pos: new Vec3(10, 65, 10), valid: true },
      ];

      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => objects[0],
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();
      task.onTick();

      expect(task.getCurrentTarget()).not.toBeNull();

      task.resetSearch();

      expect(task.getCurrentTarget()).toBeNull();
    });
  });

  describe('doToClosestObject convenience function', () => {
    it('WHY: Creates DoToClosestObjectTask with config', () => {
      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => null,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = doToClosestObject(bot, config);
      expect(task).toBeInstanceOf(DoToClosestObjectTask);
    });
  });

  describe('Heuristic Caching', () => {
    it('WHY: Caches target heuristics for better switching decisions', () => {
      const objects: TestObject[] = [
        { id: 1, pos: new Vec3(10, 65, 10), valid: true },
        { id: 2, pos: new Vec3(15, 65, 15), valid: true },
      ];

      let currentClosest = objects[0];

      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => currentClosest,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = new DoToClosestObjectTask(bot, config);
      task.onStart();

      // First tick - select object 1
      task.onTick();
      expect(task.getCurrentTarget()?.id).toBe(1);

      // Change closest to object 2
      currentClosest = objects[1];

      // Next tick - should consider switching
      task.onTick();

      // Since object 2 has no cached heuristic, should try it
      expect(task.getCurrentTarget()?.id).toBe(2);
    });

    it('WHY: Continues tasks that never finish by design', () => {
      const config: DoToClosestObjectConfig<TestObject> = {
        getPos: (obj) => obj.pos,
        getClosestTo: () => null,
        getGoalTask: (obj) => new MockGoalTask(bot, obj.id),
        isValid: () => true,
      };

      const task = new DoToClosestObjectTask(bot, config);
      expect(task.isFinished()).toBe(false);
    });
  });
});
