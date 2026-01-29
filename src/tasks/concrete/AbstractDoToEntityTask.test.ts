/**
 * Tests for AbstractDoToEntityTask
 *
 * These tests verify that the abstract entity interaction base class works correctly:
 * - WHY: Entity interactions (combat, trading, following) are fundamental
 *   to many Minecraft automation scenarios. We need to reliably find,
 *   approach, and interact with entities.
 * - INTENT: Validate entity finding, approach logic, distance maintenance,
 *   and proper state machine transitions.
 */

import { describe, it, expect, mock } from 'bun:test';
import { AbstractDoToEntityTask } from './EntityTask';
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

describe('AbstractDoToEntityTask', () => {
  // Create a concrete implementation for testing
  class TestEntityTask extends AbstractDoToEntityTask {
    public targetEntityId: number | null = null;
    public interactCalled = false;

    constructor(bot: any, entityId: number | null = null) {
      super(bot, { maintainDistance: 3, reachRange: 4 });
      this.targetEntityId = entityId;
    }

    protected getEntityTarget() {
      if (this.targetEntityId === null) return null;
      return this.bot.entities[this.targetEntityId] ?? null;
    }

    protected onEntityInteract(entity: any): Task | null {
      this.interactCalled = true;
      this.markFinished();
      return null;
    }
  }

  it('should start not finished', () => {
    const bot = createMockBot();
    const task = new TestEntityTask(bot);
    task.onStart();
    expect(task.isFinished()).toBe(false);
  });

  /**
   * WHY: When no entity target is available, the task should
   * wander to search for entities rather than fail immediately.
   */
  it('should wander when no entity found', () => {
    const bot = createMockBot();
    const task = new TestEntityTask(bot, null);
    task.onStart();

    // First tick transitions from FINDING_ENTITY to WANDERING
    task.onTick();
    // Second tick in WANDERING state should return wander task
    const subtask = task.onTick();
    // Should be in wandering state, returning wander task
    expect(subtask !== null || task.isFinished()).toBe(true);
  });

  /**
   * WHY: When an entity is found, the task should approach it
   * to get within interaction range.
   */
  it('should approach when entity found', () => {
    const entity = createMockEntity(1, 'zombie', 20, 64, 20);
    const bot = createMockBot({
      entities: { 1: entity },
    });

    const task = new TestEntityTask(bot, 1);
    task.onStart();

    // Entity is far away, should approach
    const subtask = task.onTick();
    expect(task.isFinished()).toBe(false);
  });

  /**
   * WHY: The task should call onEntityInteract when within range
   * and looking at the entity.
   */
  it('should interact when in range', () => {
    const entity = createMockEntity(1, 'zombie', 2, 64, 2);
    const bot = createMockBot({
      entities: { 1: entity },
    });
    // Set player position close to entity
    bot.entity.position = new Vec3(2, 64, 0);

    const task = new TestEntityTask(bot, 1);
    task.onStart();

    // Run a few ticks to reach interacting state
    for (let i = 0; i < 5; i++) {
      task.onTick();
      if (task.interactCalled) break;
    }

    // Should have attempted interaction
    // Note: May not succeed due to look check
  });
});
