/**
 * Tests for Miscellaneous Tasks (Portal, Armor, Bed, Liquid, Dodge)
 *
 * These tests verify that misc tasks work correctly:
 * - WHY: These tasks handle crucial mechanics like dimension travel,
 *   armor protection, spawn points, resource collection, and combat evasion.
 * - INTENT: Validate state machines, edge cases, and helper functions.
 */

import {
  EnterNetherPortalTask,
  GoToDimensionTask,
  enterNether,
  returnToOverworld,
  goToDimension,
} from './PortalTask';
import {
  ArmorSlot,
  ArmorMaterial,
  EquipArmorTask,
  EquipSpecificArmorTask,
  equipBestArmor,
  equipArmor,
} from './ArmorTask';
import {
  PlaceBedAndSetSpawnTask,
  SleepInBedTask,
  placeBedAndSetSpawn,
  sleepInBed,
} from './BedTask';
import {
  LiquidType,
  CollectBucketLiquidTask,
  CollectWaterBucketTask,
  CollectLavaBucketTask,
  collectWater,
  collectLava,
} from './CollectLiquidTask';
import {
  DodgeProjectilesTask,
  StrafeAndDodgeTask,
  dodgeProjectiles,
  strafeAndDodge,
} from './DodgeTask';
import { Dimension } from './ResourceTask';
import { Vec3 } from 'vec3';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
      velocity: new Vec3(0, 0, 0),
      yaw: 0,
      pitch: 0,
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
    game: { dimension: 'minecraft:overworld' },
    setControlState: jest.fn(),
    clearControlStates: jest.fn(),
    look: jest.fn(),
    lookAt: jest.fn(),
    equip: jest.fn(),
    activateBlock: jest.fn(),
    wake: jest.fn(),
    isSleeping: false,
    ...overrides,
  };

  // Add Vec3 methods to position
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  baseBot.entity.position.floored = () => new Vec3(
    Math.floor(baseBot.entity.position.x),
    Math.floor(baseBot.entity.position.y),
    Math.floor(baseBot.entity.position.z)
  );
  baseBot.entity.position.minus = (other: Vec3) => new Vec3(
    baseBot.entity.position.x - other.x,
    baseBot.entity.position.y - other.y,
    baseBot.entity.position.z - other.z
  );

  return baseBot;
}

// Mock block
function createMockBlock(name: string, x: number, y: number, z: number): any {
  return {
    name,
    position: new Vec3(x, y, z),
    boundingBox: name === 'air' ? 'empty' : 'block',
  };
}

// Mock entity
function createMockEntity(id: number, name: string, x: number, y: number, z: number): any {
  const pos = new Vec3(x, y, z);
  pos.distanceTo = (other: Vec3) => {
    const dx = other.x - x;
    const dy = other.y - y;
    const dz = other.z - z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  pos.minus = (other: Vec3) => new Vec3(x - other.x, y - other.y, z - other.z);

  return {
    id,
    name,
    type: 'mob',
    position: pos,
    velocity: new Vec3(0, 0, 0),
    height: 1.8,
    isValid: true,
  };
}

describe('Portal Tasks', () => {
  describe('EnterNetherPortalTask', () => {
    it('should create with target dimension', () => {
      const bot = createMockBot();
      const task = new EnterNetherPortalTask(bot, Dimension.NETHER);
      expect(task.displayName).toContain('Nether');
    });

    it('should throw for End dimension', () => {
      const bot = createMockBot();
      expect(() => new EnterNetherPortalTask(bot, Dimension.END))
        .toThrow("Can't build a nether portal to the End");
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new EnterNetherPortalTask(bot, Dimension.NETHER);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    /**
     * WHY: Task should finish when player reaches target dimension.
     */
    it('should finish when in target dimension', () => {
      const bot = createMockBot({
        game: { dimension: 'minecraft:the_nether' },
      });
      const task = new EnterNetherPortalTask(bot, Dimension.NETHER);
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('GoToDimensionTask', () => {
    it('should create with target dimension', () => {
      const bot = createMockBot();
      const task = new GoToDimensionTask(bot, Dimension.NETHER);
      expect(task.displayName).toContain('Nether');
    });

    it('should finish when already in target dimension', () => {
      const bot = createMockBot({
        game: { dimension: 'minecraft:the_nether' },
      });
      const task = new GoToDimensionTask(bot, Dimension.NETHER);
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('helper functions', () => {
    it('enterNether should create task', () => {
      const bot = createMockBot();
      const task = enterNether(bot);
      expect(task).toBeInstanceOf(EnterNetherPortalTask);
    });

    it('returnToOverworld should create task', () => {
      const bot = createMockBot();
      const task = returnToOverworld(bot);
      expect(task).toBeInstanceOf(EnterNetherPortalTask);
    });

    it('goToDimension should create task', () => {
      const bot = createMockBot();
      const task = goToDimension(bot, Dimension.NETHER);
      expect(task).toBeInstanceOf(GoToDimensionTask);
    });
  });
});

describe('Armor Tasks', () => {
  describe('EquipArmorTask', () => {
    it('should create task', () => {
      const bot = createMockBot();
      const task = new EquipArmorTask(bot);
      expect(task.displayName).toBe('EquipArmor');
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new EquipArmorTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    /**
     * WHY: Task should finish immediately when no armor available.
     */
    it('should finish when no armor in inventory', () => {
      const bot = createMockBot({
        inventory: { items: () => [] },
      });
      const task = new EquipArmorTask(bot);
      task.onStart();
      task.onTick();
      expect(task.isFinished()).toBe(true);
    });

    /**
     * WHY: Task should try to equip available armor.
     */
    it('should detect armor in inventory', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [
            { name: 'iron_chestplate', count: 1 },
          ],
        },
      });
      const task = new EquipArmorTask(bot);
      task.onStart();
      task.onTick();
      // Task finds armor and starts equipping
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('EquipSpecificArmorTask', () => {
    it('should create with armor items', () => {
      const bot = createMockBot();
      const task = new EquipSpecificArmorTask(bot, 'diamond_helmet', 'diamond_chestplate');
      expect(task.displayName).toContain('diamond_helmet');
    });
  });

  describe('helper functions', () => {
    it('equipBestArmor should create task', () => {
      const bot = createMockBot();
      const task = equipBestArmor(bot);
      expect(task).toBeInstanceOf(EquipArmorTask);
    });

    it('equipArmor should create specific task', () => {
      const bot = createMockBot();
      const task = equipArmor(bot, 'iron_helmet');
      expect(task).toBeInstanceOf(EquipSpecificArmorTask);
    });
  });

  describe('ArmorSlot enum', () => {
    it('should have all armor slots', () => {
      expect(ArmorSlot.HELMET).toBe('head');
      expect(ArmorSlot.CHESTPLATE).toBe('torso');
      expect(ArmorSlot.LEGGINGS).toBe('legs');
      expect(ArmorSlot.BOOTS).toBe('feet');
    });
  });

  describe('ArmorMaterial enum', () => {
    it('should have materials in order', () => {
      expect(ArmorMaterial.LEATHER).toBeLessThan(ArmorMaterial.IRON);
      expect(ArmorMaterial.IRON).toBeLessThan(ArmorMaterial.DIAMOND);
      expect(ArmorMaterial.DIAMOND).toBeLessThan(ArmorMaterial.NETHERITE);
    });
  });
});

describe('Bed Tasks', () => {
  describe('PlaceBedAndSetSpawnTask', () => {
    it('should create task', () => {
      const bot = createMockBot();
      const task = new PlaceBedAndSetSpawnTask(bot);
      expect(task.displayName).toBe('PlaceBedAndSetSpawn');
    });

    it('should start not finished', () => {
      const bot = createMockBot();
      const task = new PlaceBedAndSetSpawnTask(bot);
      task.onStart();
      expect(task.isFinished()).toBe(false);
    });

    /**
     * WHY: Beds explode in the nether/end, so task should fail.
     */
    it('should fail in nether dimension', () => {
      const bot = createMockBot({
        game: { dimension: 'minecraft:the_nether' },
      });
      const task = new PlaceBedAndSetSpawnTask(bot);
      task.onStart();
      task.onTick();
      expect(task.isFailed()).toBe(true);
    });

    it('should search for beds in overworld', () => {
      const bot = createMockBot();
      const task = new PlaceBedAndSetSpawnTask(bot);
      task.onStart();
      task.onTick();
      // Task starts searching (not finished, not failed)
      expect(task.isFinished()).toBe(false);
      expect(task.isFailed()).toBe(false);
    });
  });

  describe('SleepInBedTask', () => {
    it('should create task', () => {
      const bot = createMockBot();
      const task = new SleepInBedTask(bot);
      expect(task.displayName).toBe('SleepInBed');
    });

    /**
     * WHY: Task should finish if already sleeping.
     */
    it('should finish if already sleeping', () => {
      const bot = createMockBot({
        isSleeping: true,
      });
      const task = new SleepInBedTask(bot);
      task.onStart();
      task.onTick();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('helper functions', () => {
    it('placeBedAndSetSpawn should create task', () => {
      const bot = createMockBot();
      const task = placeBedAndSetSpawn(bot);
      expect(task).toBeInstanceOf(PlaceBedAndSetSpawnTask);
    });

    it('sleepInBed should create task', () => {
      const bot = createMockBot();
      const task = sleepInBed(bot);
      expect(task).toBeInstanceOf(SleepInBedTask);
    });
  });
});

describe('Liquid Collection Tasks', () => {
  describe('CollectBucketLiquidTask', () => {
    it('should create water collection task', () => {
      const bot = createMockBot();
      const task = new CollectBucketLiquidTask(bot, LiquidType.WATER, 1);
      expect(task.displayName).toContain('water');
    });

    it('should create lava collection task', () => {
      const bot = createMockBot();
      const task = new CollectBucketLiquidTask(bot, LiquidType.LAVA, 1);
      expect(task.displayName).toContain('lava');
    });

    /**
     * WHY: Task should fail without buckets to collect liquid.
     */
    it('should require empty bucket', () => {
      const bot = createMockBot({
        inventory: { items: () => [] },
      });
      const task = new CollectWaterBucketTask(bot, 1);
      task.onStart();
      task.onTick();
      task.onTick();
      expect(task.isFailed()).toBe(true);
    });

    it('should finish when already have filled bucket', () => {
      const bot = createMockBot({
        inventory: {
          items: () => [{ name: 'water_bucket', count: 1 }],
        },
      });
      const task = new CollectWaterBucketTask(bot, 1);
      task.onStart();
      expect(task.isFinished()).toBe(true);
    });
  });

  describe('CollectWaterBucketTask', () => {
    it('should create task for water', () => {
      const bot = createMockBot();
      const task = new CollectWaterBucketTask(bot, 2);
      expect(task.displayName).toContain('water');
    });
  });

  describe('CollectLavaBucketTask', () => {
    it('should create task for lava', () => {
      const bot = createMockBot();
      const task = new CollectLavaBucketTask(bot, 1);
      expect(task.displayName).toContain('lava');
    });
  });

  describe('helper functions', () => {
    it('collectWater should create task', () => {
      const bot = createMockBot();
      const task = collectWater(bot, 3);
      expect(task).toBeInstanceOf(CollectWaterBucketTask);
    });

    it('collectLava should create task', () => {
      const bot = createMockBot();
      const task = collectLava(bot, 2);
      expect(task).toBeInstanceOf(CollectLavaBucketTask);
    });
  });

  describe('LiquidType enum', () => {
    it('should have water and lava', () => {
      expect(LiquidType.WATER).toBe('water');
      expect(LiquidType.LAVA).toBe('lava');
    });
  });
});

describe('Dodge Tasks', () => {
  describe('DodgeProjectilesTask', () => {
    it('should create with default config', () => {
      const bot = createMockBot();
      const task = new DodgeProjectilesTask(bot);
      expect(task.displayName).toContain('DodgeProjectiles');
    });

    it('should create with custom distances', () => {
      const bot = createMockBot();
      const task = new DodgeProjectilesTask(bot, {
        dodgeDistanceH: 5,
        dodgeDistanceV: 2,
      });
      expect(task.displayName).toContain('5m');
    });

    /**
     * WHY: Task should finish when no projectiles detected.
     */
    it('should finish when no projectiles', () => {
      const bot = createMockBot({
        entities: {},
      });
      const task = new DodgeProjectilesTask(bot);
      task.onStart();
      task.onTick();
      expect(task.isFinished()).toBe(true);
    });

    /**
     * WHY: Task should detect incoming projectiles.
     */
    it('should detect arrow entities', () => {
      const arrow = createMockEntity(1, 'arrow', 10, 65, 0);
      arrow.velocity = new Vec3(-1, 0, 0); // Moving toward player

      const bot = createMockBot({
        entities: { 1: arrow },
      });
      const task = new DodgeProjectilesTask(bot);
      task.onStart();
      task.onTick();

      // Dodge initiated - should set control states
      expect(bot.clearControlStates).toHaveBeenCalled();
    });
  });

  describe('StrafeAndDodgeTask', () => {
    it('should create task', () => {
      const bot = createMockBot();
      const task = new StrafeAndDodgeTask(bot);
      expect(task.displayName).toBe('StrafeAndDodge');
    });

    it('should not finish (continuous task)', () => {
      const bot = createMockBot();
      const task = new StrafeAndDodgeTask(bot);
      task.onStart();
      task.onTick();
      expect(task.isFinished()).toBe(false);
    });
  });

  describe('helper functions', () => {
    it('dodgeProjectiles should create task', () => {
      const bot = createMockBot();
      const task = dodgeProjectiles(bot, 3, 1);
      expect(task).toBeInstanceOf(DodgeProjectilesTask);
    });

    it('strafeAndDodge should create task', () => {
      const bot = createMockBot();
      const task = strafeAndDodge(bot);
      expect(task).toBeInstanceOf(StrafeAndDodgeTask);
    });
  });
});

describe('Task equality', () => {
  it('portal tasks should be equal if same dimension', () => {
    const bot = createMockBot();
    const task1 = new EnterNetherPortalTask(bot, Dimension.NETHER);
    const task2 = new EnterNetherPortalTask(bot, Dimension.NETHER);
    expect(task1.isEqual(task2)).toBe(true);
  });

  it('armor tasks should be equal', () => {
    const bot = createMockBot();
    const task1 = new EquipArmorTask(bot);
    const task2 = new EquipArmorTask(bot);
    expect(task1.isEqual(task2)).toBe(true);
  });

  it('bed tasks should be equal if same config', () => {
    const bot = createMockBot();
    const task1 = new PlaceBedAndSetSpawnTask(bot, { stayInBed: false });
    const task2 = new PlaceBedAndSetSpawnTask(bot, { stayInBed: false });
    expect(task1.isEqual(task2)).toBe(true);
  });

  it('liquid tasks should be equal if same type and count', () => {
    const bot = createMockBot();
    const task1 = new CollectWaterBucketTask(bot, 2);
    const task2 = new CollectWaterBucketTask(bot, 2);
    expect(task1.isEqual(task2)).toBe(true);
  });

  it('dodge tasks should be equal if similar distances', () => {
    const bot = createMockBot();
    const task1 = new DodgeProjectilesTask(bot, { dodgeDistanceH: 2, dodgeDistanceV: 1 });
    const task2 = new DodgeProjectilesTask(bot, { dodgeDistanceH: 2, dodgeDistanceV: 1 });
    expect(task1.isEqual(task2)).toBe(true);
  });
});
