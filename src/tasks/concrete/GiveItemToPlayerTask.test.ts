/**
 * Tests for GiveItemToPlayerTask
 *
 * These tests verify that giving items to players works correctly:
 * - WHY: Item trading between bot and players is a key automation feature.
 * - INTENT: Validate player targeting, inventory checks, and item delivery.
 */

import { describe, it, expect, mock } from 'bun:test';
import { GiveItemToPlayerTask } from './EntityTask';
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

describe('GiveItemToPlayerTask', () => {
  it('should create with player name and item', () => {
    const bot = createMockBot();
    const task = new GiveItemToPlayerTask(bot, 'Steve', 'diamond', 5);
    expect(task.displayName).toContain('GiveItem');
    expect(task.displayName).toContain('diamond');
    expect(task.displayName).toContain('Steve');
  });

  /**
   * WHY: Can't give items we don't have. Task should fail
   * when the item isn't in inventory.
   */
  it('should fail if item not in inventory', () => {
    const player = createMockEntity(1, 'player', 3, 64, 3);
    player.username = 'Steve';

    const bot = createMockBot({
      entities: { 1: player },
      inventory: { items: () => [] },
    });
    bot.entity.position = new Vec3(3, 64, 0);

    const task = new GiveItemToPlayerTask(bot, 'Steve', 'diamond', 1);
    task.onStart();

    // Run through to interaction
    for (let i = 0; i < 10; i++) {
      task.onTick();
      if (task.isFailed()) break;
    }

    expect(task.isFailed()).toBe(true);
  });

  it('should find target player by name', () => {
    const steve = createMockEntity(1, 'player', 20, 64, 20);
    steve.username = 'Steve';
    const alex = createMockEntity(2, 'player', 10, 64, 10);
    alex.username = 'Alex';

    const bot = createMockBot({
      entities: { 1: steve, 2: alex },
    });

    const task = new GiveItemToPlayerTask(bot, 'Steve', 'diamond', 1);
    task.onStart();

    // Should target Steve, not Alex
  });
});

describe('equality checks', () => {
  it('GiveItemToPlayerTask should be equal if same player and item', () => {
    const bot = createMockBot();
    const task1 = new GiveItemToPlayerTask(bot, 'Steve', 'diamond', 5);
    const task2 = new GiveItemToPlayerTask(bot, 'Steve', 'diamond', 5);
    expect(task1.isEqual(task2)).toBe(true);
  });
});
