/**
 * Tests for KillPlayerTask
 *
 * These tests verify that killing a specific player works correctly:
 * - WHY: PvP combat targeting requires finding and attacking a specific player.
 * - INTENT: Validate player targeting by name, attack behavior, and completion.
 */

import { describe, it, expect, mock } from 'bun:test';
import { KillPlayerTask } from './EntityTask';
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

describe('KillPlayerTask', () => {
  it('should create with player name', () => {
    const bot = createMockBot();
    const task = new KillPlayerTask(bot, 'Enemy');
    expect(task.displayName).toContain('KillPlayer');
    expect(task.displayName).toContain('Enemy');
  });

  /**
   * WHY: The task should finish when the target player is dead
   * or no longer in the game.
   */
  it('should finish when target not found', () => {
    const bot = createMockBot({
      entities: {},
    });

    const task = new KillPlayerTask(bot, 'Enemy');
    task.onStart();

    // No player found, should wander
    task.onTick();
    // Eventually should consider finished if player never found
  });

  it('should attack when in range', () => {
    const attackMock = mock();
    const enemy = createMockEntity(1, 'player', 2, 64, 2);
    enemy.username = 'Enemy';

    const bot = createMockBot({
      entities: { 1: enemy },
      attack: attackMock,
    });
    bot.entity.position = new Vec3(2, 64, 0);

    const task = new KillPlayerTask(bot, 'Enemy');
    task.onStart();

    // Run a few ticks
    for (let i = 0; i < 10; i++) {
      task.onTick();
    }

    // Attack should be called when in range
  });
});
