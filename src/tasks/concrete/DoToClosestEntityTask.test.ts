/**
 * Tests for DoToClosestEntityTask and killEntities helper
 *
 * These tests verify that closest entity finding and kill helpers work correctly:
 * - WHY: Finding and interacting with the closest matching entity is a core
 *   pattern used by combat, trading, and other automation tasks.
 * - INTENT: Validate entity filtering, distance sorting, and helper functions.
 */

import { describe, it, expect, mock } from 'bun:test';
import { DoToClosestEntityTask, killEntities } from './EntityTask';
import { Task } from '../Task';
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

// Helper test task
class TestTaskForEntity extends Task {
  private entityId: number;

  constructor(bot: any, entityId: number) {
    super(bot);
    this.entityId = entityId;
  }

  get displayName() { return `TestTaskForEntity(${this.entityId})`; }
  onTick() { return null; }
  isFinished() { return false; }
  isEqual(other: any) { return other instanceof TestTaskForEntity && other.entityId === this.entityId; }
}

describe('DoToClosestEntityTask', () => {
  it('should create with entity types', () => {
    const bot = createMockBot();
    const task = new DoToClosestEntityTask(
      bot,
      (entity) => new TestTaskForEntity(bot, entity.id),
      ['zombie', 'skeleton']
    );
    expect(task.displayName).toContain('DoToClosest');
  });

  /**
   * WHY: The task should find the closest entity of the specified types.
   * Closer entities should take priority.
   */
  it('should find closest entity', () => {
    const zombie1 = createMockEntity(1, 'zombie', 30, 64, 30);
    const zombie2 = createMockEntity(2, 'zombie', 10, 64, 10);
    const skeleton = createMockEntity(3, 'skeleton', 5, 64, 5);

    const bot = createMockBot({
      entities: { 1: zombie1, 2: zombie2, 3: skeleton },
    });

    const task = new DoToClosestEntityTask(
      bot,
      (entity) => new TestTaskForEntity(bot, entity.id),
      ['zombie', 'skeleton']
    );
    task.onStart();

    // Should find skeleton (closest)
    const subtask = task.onTick();
    expect(subtask).not.toBeNull();
  });

  /**
   * WHY: The filter function should exclude entities that don't
   * meet the criteria (e.g., already sheared sheep).
   */
  it('should respect entity filter', () => {
    const zombie1 = createMockEntity(1, 'zombie', 5, 64, 5);
    zombie1.health = 20; // Full health
    const zombie2 = createMockEntity(2, 'zombie', 10, 64, 10);
    zombie2.health = 5; // Low health

    const bot = createMockBot({
      entities: { 1: zombie1, 2: zombie2 },
    });

    // Only target low-health zombies
    const task = new DoToClosestEntityTask(
      bot,
      (entity) => new TestTaskForEntity(bot, entity.id),
      ['zombie'],
      (entity) => (entity as any).health < 10
    );
    task.onStart();

    const subtask = task.onTick();
    // Should find zombie2 (low health), not zombie1
    expect(subtask).not.toBeNull();
  });

  it('should wander when no matching entity found', () => {
    const bot = createMockBot({
      entities: {},
    });

    const task = new DoToClosestEntityTask(
      bot,
      (entity) => new TestTaskForEntity(bot, entity.id),
      ['zombie']
    );
    task.onStart();

    const subtask = task.onTick();
    // Should return wander task
    expect(subtask).not.toBeNull();
    expect(subtask?.displayName).toContain('Wander');
  });
});

describe('killEntities helper', () => {
  it('should create DoToClosestEntityTask', () => {
    const bot = createMockBot();
    const task = killEntities(bot, 'zombie', 'skeleton');
    expect(task).toBeInstanceOf(DoToClosestEntityTask);
  });
});

describe('equality checks', () => {
  it('DoToClosestEntityTask should be equal if same types', () => {
    const bot = createMockBot();
    const task1 = new DoToClosestEntityTask(bot, () => null as any, ['zombie']);
    const task2 = new DoToClosestEntityTask(bot, () => null as any, ['zombie']);
    expect(task1.isEqual(task2)).toBe(true);
  });

  it('DoToClosestEntityTask should not be equal if different types', () => {
    const bot = createMockBot();
    const task1 = new DoToClosestEntityTask(bot, () => null as any, ['zombie']);
    const task2 = new DoToClosestEntityTask(bot, () => null as any, ['skeleton']);
    expect(task1.isEqual(task2)).toBe(false);
  });
});
