import { describe, it, expect } from 'bun:test';
import { SchematicTask, createCubeSchematic, createHollowBoxSchematic, createWallSchematic } from './index';
import { Vec3 } from 'vec3';

function createMockBot(): any {
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: () => 5,
        offset: () => ({ x: 1, y: 64, z: 1 }),
        clone: () => ({ x: 0, y: 64, z: 0 }),
        minus: () => ({ x: 0, y: 0, z: 0, scaled: () => ({ x: 0, y: 0, z: 0 }) }),
        plus: () => ({ x: 0, y: 64, z: 0 }),
      },
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    entities: {},
    time: { timeOfDay: 6000 },
    health: 20,
    food: 20,
    heldItem: null,
  };
}

describe('SchematicTask', () => {
  it('should create with cube schematic', () => {
    const bot = createMockBot();
    const origin = new Vec3(0, 64, 0);
    const schematic = createCubeSchematic(3, 'cobblestone');
    const task = new SchematicTask(bot, origin, schematic);
    expect(task.displayName).toContain('Schematic');
    expect(task.displayName).toContain('cube_3x3x3');
  });

  it('should create with hollow box schematic', () => {
    const bot = createMockBot();
    const origin = new Vec3(0, 64, 0);
    const schematic = createHollowBoxSchematic(5, 4, 5, 'stone');
    const task = new SchematicTask(bot, origin, schematic);
    expect(task.displayName).toContain('hollow_box');
  });

  it('should create with wall schematic', () => {
    const bot = createMockBot();
    const origin = new Vec3(0, 64, 0);
    const schematic = createWallSchematic(10, 3, 'oak_planks');
    const task = new SchematicTask(bot, origin, schematic);
    expect(task.displayName).toContain('wall_10x3');
  });

  it('should start in LOADING state', () => {
    const bot = createMockBot();
    const origin = new Vec3(0, 64, 0);
    const schematic = createCubeSchematic(2, 'dirt');
    const task = new SchematicTask(bot, origin, schematic);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  it('should track build progress', () => {
    const bot = createMockBot();
    const origin = new Vec3(0, 64, 0);
    const schematic = createCubeSchematic(2, 'dirt');
    const task = new SchematicTask(bot, origin, schematic);
    task.onStart();
    expect(task.getProgress()).toBe(0);
  });

  it('should provide materials needed', () => {
    const bot = createMockBot();
    const origin = new Vec3(0, 64, 0);
    const schematic = createCubeSchematic(2, 'stone');
    const task = new SchematicTask(bot, origin, schematic);
    task.onStart();
    const materials = task.getMaterialsNeeded();
    expect(materials).toBeDefined();
  });

  it('should compare by origin and schematic name', () => {
    const bot = createMockBot();
    const origin1 = new Vec3(0, 64, 0);
    const origin2 = new Vec3(0, 64, 0);
    const origin3 = new Vec3(100, 64, 100);
    const schematic = createCubeSchematic(2, 'dirt');
    const task1 = new SchematicTask(bot, origin1, schematic);
    const task2 = new SchematicTask(bot, origin2, schematic);
    const task3 = new SchematicTask(bot, origin3, schematic);
    expect(task1.isEqual(task2)).toBe(true);
    expect(task1.isEqual(task3)).toBe(false);
  });

  it('should create cube schematic with correct block count', () => {
    const schematic = createCubeSchematic(3, 'cobblestone');
    expect(schematic.blocks.length).toBe(27); // 3x3x3
    expect(schematic.palette).toContain('cobblestone');
  });

  it('should create hollow box schematic with correct block count', () => {
    const schematic = createHollowBoxSchematic(3, 3, 3, 'stone');
    // Hollow 3x3x3 = 27 total - 1 interior = 26 blocks
    expect(schematic.blocks.length).toBe(26);
  });

  it('should create wall schematic with correct block count', () => {
    const schematic = createWallSchematic(5, 3, 'brick');
    expect(schematic.blocks.length).toBe(15); // 5x3
  });
});
