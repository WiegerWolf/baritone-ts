/**
 * Tests for Concrete Tasks
 */

import {
  GoToBlockTask,
  GetToBlockTask,
  GoToNearTask,
  GoToXZTask,
  FollowEntityTask,
  MineBlockTask,
  MineBlockTypeTask,
  PlaceBlockTask,
  PlaceAgainstTask,
  CraftTask,
  EnsureItemTask,
  SmeltTask,
  isFuel,
  getFuelBurnTime,
  EquipmentSlot,
  PickupItemTask,
  EquipTask,
  DropItemTask,
  MoveItemTask,
  InteractBlockTask,
  InteractEntityTask,
  AttackEntityTask,
  UseItemTask,
} from '../src/tasks/concrete';
import { Vec3 } from 'vec3';

// Mock bot for testing
function createMockBot(): any {
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: () => 5,
        offset: (x: number, y: number, z: number) => ({ x, y: 64 + y, z }),
        clone: () => ({ x: 0, y: 64, z: 0 }),
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
    pathfinder: {
      setGoal: jest.fn(),
      goto: jest.fn(),
      isMoving: () => false,
    },
    dig: jest.fn(),
    placeBlock: jest.fn(),
    equip: jest.fn(),
    attack: jest.fn(),
    activateItem: jest.fn(),
    deactivateItem: jest.fn(),
    activateBlock: jest.fn(),
    activateEntity: jest.fn(),
    toss: jest.fn(),
    clickWindow: jest.fn(),
    look: jest.fn(),
    craft: jest.fn(),
  };
}

describe('Concrete Tasks', () => {
  describe('Navigation Tasks', () => {
    describe('GoToBlockTask', () => {
      it('should create with block coordinates', () => {
        const bot = createMockBot();
        const task = new GoToBlockTask(bot, 10, 64, 10);
        expect(task.displayName).toContain('GoToBlock');
      });

      it('should start not finished', () => {
        const bot = createMockBot();
        const task = new GoToBlockTask(bot, 10, 64, 10);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('GetToBlockTask', () => {
      it('should create with reach distance', () => {
        const bot = createMockBot();
        const task = new GetToBlockTask(bot, 10, 64, 10);
        expect(task.displayName).toContain('GetToBlock');
      });
    });

    describe('GoToNearTask', () => {
      it('should create with radius', () => {
        const bot = createMockBot();
        const task = new GoToNearTask(bot, 10, 64, 10, 5);
        expect(task.displayName).toContain('GoToNear');
      });

      it('should accept custom radius', () => {
        const bot = createMockBot();
        const task = new GoToNearTask(bot, 10, 64, 10, 8);
        expect(task.displayName).toContain('8');
      });
    });

    describe('GoToXZTask', () => {
      it('should create with only X and Z', () => {
        const bot = createMockBot();
        const task = new GoToXZTask(bot, 10, 10);
        expect(task.displayName).toContain('GoToXZ');
      });
    });

    describe('FollowEntityTask', () => {
      it('should create with entity ID', () => {
        const bot = createMockBot();
        const task = new FollowEntityTask(bot, 123);
        expect(task.displayName).toContain('Follow');
      });

      it('should accept follow distance', () => {
        const bot = createMockBot();
        const task = new FollowEntityTask(bot, 123, 3);
        expect(task.displayName).toContain('Follow');
      });
    });
  });

  describe('Mining Tasks', () => {
    describe('MineBlockTask', () => {
      it('should create with block coordinates', () => {
        const bot = createMockBot();
        const task = new MineBlockTask(bot, 10, 64, 10);
        expect(task.displayName).toContain('MineBlock');
      });

      it('should start not finished', () => {
        const bot = createMockBot();
        const task = new MineBlockTask(bot, 10, 64, 10);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('MineBlockTypeTask', () => {
      it('should create with block type', () => {
        const bot = createMockBot();
        const task = new MineBlockTypeTask(bot, 'diamond_ore');
        expect(task.displayName).toContain('MineBlockType');
      });

      it('should accept count parameter', () => {
        const bot = createMockBot();
        const task = new MineBlockTypeTask(bot, 'iron_ore', 5);
        expect(task.displayName).toContain('iron_ore');
      });
    });
  });

  describe('Placement Tasks', () => {
    describe('PlaceBlockTask', () => {
      it('should create with coordinates and block name', () => {
        const bot = createMockBot();
        const task = new PlaceBlockTask(bot, 10, 64, 10, 'cobblestone');
        expect(task.displayName).toContain('PlaceBlock');
      });
    });

    describe('PlaceAgainstTask', () => {
      it('should create with against coordinates and face', () => {
        const bot = createMockBot();
        const task = new PlaceAgainstTask(bot, 10, 63, 10, new Vec3(0, 1, 0), 'dirt');
        expect(task.displayName).toContain('PlaceAgainst');
      });
    });
  });

  describe('Crafting Tasks', () => {
    describe('CraftTask', () => {
      it('should create with item name', () => {
        const bot = createMockBot();
        const task = new CraftTask(bot, 'crafting_table');
        expect(task.displayName).toContain('Craft');
      });

      it('should accept count parameter', () => {
        const bot = createMockBot();
        const task = new CraftTask(bot, 'stick', 4);
        expect(task.displayName).toContain('stick');
      });
    });

    describe('EnsureItemTask', () => {
      it('should create with item name', () => {
        const bot = createMockBot();
        const task = new EnsureItemTask(bot, 'wooden_pickaxe');
        expect(task.displayName).toContain('EnsureItem');
      });
    });
  });

  describe('Smelting Tasks', () => {
    describe('SmeltTask', () => {
      it('should create with input and output item', () => {
        const bot = createMockBot();
        const task = new SmeltTask(bot, 'iron_ore', 'iron_ingot', 3);
        expect(task.displayName).toContain('Smelt');
      });

      it('should start not finished', () => {
        const bot = createMockBot();
        const task = new SmeltTask(bot, 'raw_iron', 'iron_ingot', 1);
        task.onStart();
        expect(task.isFinished()).toBe(false);
      });
    });

    describe('Fuel utilities', () => {
      it('should identify coal as fuel', () => {
        expect(isFuel('coal')).toBe(true);
      });

      it('should identify charcoal as fuel', () => {
        expect(isFuel('charcoal')).toBe(true);
      });

      it('should identify logs as fuel', () => {
        expect(isFuel('oak_log')).toBe(true);
        expect(isFuel('spruce_log')).toBe(true);
      });

      it('should identify planks as fuel', () => {
        expect(isFuel('oak_planks')).toBe(true);
      });

      it('should not identify stone as fuel', () => {
        expect(isFuel('stone')).toBe(false);
      });

      it('should return correct burn time for coal', () => {
        // Coal burns for 1600 ticks (8 items)
        expect(getFuelBurnTime('coal')).toBe(1600);
      });

      it('should return correct burn time for planks', () => {
        // Planks burn for 300 ticks (1.5 items)
        expect(getFuelBurnTime('oak_planks')).toBe(300);
      });
    });
  });

  describe('Inventory Tasks', () => {
    describe('PickupItemTask', () => {
      it('should create with item name', () => {
        const bot = createMockBot();
        const task = new PickupItemTask(bot, 'diamond');
        expect(task.displayName).toContain('Pickup');
      });
    });

    describe('EquipTask', () => {
      it('should create for hand slot', () => {
        const bot = createMockBot();
        const task = new EquipTask(bot, 'diamond_sword', EquipmentSlot.HAND);
        expect(task.displayName).toContain('Equip');
      });

      it('should create for off-hand', () => {
        const bot = createMockBot();
        const task = new EquipTask(bot, 'shield', EquipmentSlot.OFF_HAND);
        expect(task.displayName).toContain('Equip');
      });

      it('should create for armor slots', () => {
        const bot = createMockBot();
        const helmet = new EquipTask(bot, 'diamond_helmet', EquipmentSlot.HEAD);
        const chest = new EquipTask(bot, 'diamond_chestplate', EquipmentSlot.CHEST);
        const legs = new EquipTask(bot, 'diamond_leggings', EquipmentSlot.LEGS);
        const boots = new EquipTask(bot, 'diamond_boots', EquipmentSlot.FEET);

        expect(helmet.displayName).toContain('Equip');
        expect(chest.displayName).toContain('Equip');
        expect(legs.displayName).toContain('Equip');
        expect(boots.displayName).toContain('Equip');
      });
    });

    describe('DropItemTask', () => {
      it('should create with item name', () => {
        const bot = createMockBot();
        const task = new DropItemTask(bot, 'cobblestone');
        expect(task.displayName).toContain('Drop');
      });

      it('should accept count parameter', () => {
        const bot = createMockBot();
        const task = new DropItemTask(bot, 'dirt', 64);
        expect(task.displayName).toContain('Drop');
      });
    });

    describe('MoveItemTask', () => {
      it('should create with item name and target slot', () => {
        const bot = createMockBot();
        const task = new MoveItemTask(bot, 'diamond', 0);
        expect(task.displayName).toContain('MoveItem');
      });
    });
  });

  describe('Interaction Tasks', () => {
    describe('InteractBlockTask', () => {
      it('should create with coordinates', () => {
        const bot = createMockBot();
        const task = new InteractBlockTask(bot, 10, 64, 10);
        expect(task.displayName).toContain('InteractBlock');
      });
    });

    describe('InteractEntityTask', () => {
      it('should create with entity ID', () => {
        const bot = createMockBot();
        const task = new InteractEntityTask(bot, 123);
        expect(task.displayName).toContain('InteractEntity');
      });
    });

    describe('AttackEntityTask', () => {
      it('should create with entity ID', () => {
        const bot = createMockBot();
        const task = new AttackEntityTask(bot, 456);
        expect(task.displayName).toContain('Attack');
      });
    });

    describe('UseItemTask', () => {
      it('should create without parameters', () => {
        const bot = createMockBot();
        const task = new UseItemTask(bot);
        expect(task.displayName).toContain('UseItem');
      });
    });
  });

  describe('Task equality', () => {
    it('GoToBlockTask should compare by position', () => {
      const bot = createMockBot();
      const task1 = new GoToBlockTask(bot, 10, 64, 10);
      const task2 = new GoToBlockTask(bot, 10, 64, 10);
      const task3 = new GoToBlockTask(bot, 20, 64, 20);

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });

    it('MineBlockTask should compare by position', () => {
      const bot = createMockBot();
      const task1 = new MineBlockTask(bot, 10, 64, 10);
      const task2 = new MineBlockTask(bot, 10, 64, 10);
      const task3 = new MineBlockTask(bot, 11, 64, 10);

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });

    it('CraftTask should compare by item and count', () => {
      const bot = createMockBot();
      const task1 = new CraftTask(bot, 'stick', 4);
      const task2 = new CraftTask(bot, 'stick', 4);
      const task3 = new CraftTask(bot, 'stick', 8);

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });
});
