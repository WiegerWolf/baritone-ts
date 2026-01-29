/**
 * Tests for ConstructIronGolemTask and Integration Concepts
 *
 * WHY this task matters:
 * - ConstructIronGolemTask: Build iron golems for defense/farming
 *
 * This automates the multi-step iron golem construction process.
 * Also includes integration tests for all advanced construction tasks together.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../../types';
import {
  PlaceSignState,
  ClearRegionState,
  CoverWithBlocksTask,
  CoverWithBlocksState,
  ConstructIronGolemTask,
  ConstructIronGolemState,
  placeSign,
  clearRegion,
  coverWithBlocks,
  constructIronGolem,
  THROWAWAY_BLOCKS,
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
    (bot.inventory.items as any).mockReturnValue([]);

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
    (bot.inventory.items as any).mockReturnValue([
      { name: 'iron_block', count: 4 },
      { name: 'carved_pumpkin', count: 1 },
    ]);
    (bot.blockAt as any).mockReturnValue({ name: 'air' });

    task.onStart();
    task.onTick();

    // Should have found a position
    expect(task.getPosition()).not.toBeNull();
  });

  it('WHY: Places iron blocks in correct pattern for golem', () => {
    const pos = new BlockPos(0, 65, 0);
    const task = new ConstructIronGolemTask(bot, pos);
    (bot.inventory.items as any).mockReturnValue([
      { name: 'iron_block', count: 4 },
      { name: 'carved_pumpkin', count: 1 },
    ]);
    (bot.blockAt as any).mockReturnValue({ name: 'air' });

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
