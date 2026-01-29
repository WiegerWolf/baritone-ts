/**
 * Tests for Armor Tasks
 *
 * These tests verify that armor tasks work correctly:
 * - WHY: Armor tasks handle equipment protection mechanics.
 * - INTENT: Validate state machines, edge cases, and helper functions.
 */

import {
  ArmorSlot,
  ArmorMaterial,
  EquipArmorTask,
  EquipSpecificArmorTask,
  equipBestArmor,
  equipArmor,
} from './ArmorTask';
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

describe('Task equality', () => {
  it('armor tasks should be equal', () => {
    const bot = createMockBot();
    const task1 = new EquipArmorTask(bot);
    const task2 = new EquipArmorTask(bot);
    expect(task1.isEqual(task2)).toBe(true);
  });
});
