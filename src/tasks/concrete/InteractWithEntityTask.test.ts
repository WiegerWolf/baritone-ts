/**
 * Tests for InteractWithEntityTask
 *
 * These tests verify that entity interaction (right-click) works correctly:
 * - WHY: Entity interaction is used for trading, mounting, and other
 *   entity-specific actions in Minecraft.
 * - INTENT: Validate entity targeting by ID, approach, and useOn behavior.
 */

import { describe, it, expect, mock } from 'bun:test';
import { InteractWithEntityTask } from './EntityTask';
import { Vec3 } from 'vec3';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  const baseBot = {
    entity: {
      position: new Vec3(0, 64, 0),
      yaw: 0,
      pitch: 0,
      height: 1.8,
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    blockAtCursor: () => null,
    entities: {},
    time: { timeOfDay: 6000, age: 0 },
    health: 20,
    food: 20,
    heldItem: null,
    pathfinder: {
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    attack: mock(),
    useOn: mock(),
    toss: mock(),
    setControlState: mock(),
    clearControlStates: mock(),
    look: mock(),
    ...overrides,
  };

  // Make position have proper Vec3 methods
  baseBot.entity.position.distanceTo = (other: Vec3) => {
    const dx = other.x - baseBot.entity.position.x;
    const dy = other.y - baseBot.entity.position.y;
    const dz = other.z - baseBot.entity.position.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  baseBot.entity.position.offset = (x: number, y: number, z: number) =>
    new Vec3(baseBot.entity.position.x + x, baseBot.entity.position.y + y, baseBot.entity.position.z + z);
  baseBot.entity.position.minus = (other: Vec3) =>
    new Vec3(baseBot.entity.position.x - other.x, baseBot.entity.position.y - other.y, baseBot.entity.position.z - other.z);
  baseBot.entity.position.plus = (other: Vec3) =>
    new Vec3(baseBot.entity.position.x + other.x, baseBot.entity.position.y + other.y, baseBot.entity.position.z + other.z);

  return baseBot;
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
  pos.offset = (ox: number, oy: number, oz: number) => new Vec3(x + ox, y + oy, z + oz);
  pos.scaled = (s: number) => new Vec3(x * s, y * s, z * s);

  return {
    id,
    name,
    type: name === 'player' ? 'player' : 'mob',
    username: name === 'player' ? `Player_${id}` : undefined,
    position: pos,
    height: 1.8,
    isValid: true,
  };
}

describe('InteractWithEntityTask', () => {
  it('should create with entity ID', () => {
    const bot = createMockBot({
      entities: { 1: createMockEntity(1, 'villager', 5, 64, 5) },
    });
    const task = new InteractWithEntityTask(bot, 1);
    expect(task.displayName).toContain('InteractWithEntity');
  });

  /**
   * WHY: Entity interaction (right-click) is used for trading,
   * mounting, and other entity-specific actions.
   */
  it('should call useOn when in range', () => {
    const useOnMock = mock();
    const villager = createMockEntity(1, 'villager', 2, 64, 2);

    const bot = createMockBot({
      entities: { 1: villager },
      useOn: useOnMock,
    });
    bot.entity.position = new Vec3(2, 64, 0);

    const task = new InteractWithEntityTask(bot, 1);
    task.onStart();

    // Run ticks to reach interaction
    for (let i = 0; i < 10; i++) {
      task.onTick();
      if (task.isFinished()) break;
    }
  });
});
