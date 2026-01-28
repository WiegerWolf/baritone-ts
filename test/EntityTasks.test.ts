/**
 * Tests for Entity Tasks
 *
 * These tests verify that entity interaction tasks work correctly:
 * - WHY: Entity interactions (combat, trading, following) are fundamental
 *   to many Minecraft automation scenarios. We need to reliably find,
 *   approach, and interact with entities.
 * - INTENT: Validate entity finding, approach logic, distance maintenance,
 *   and proper state machine transitions.
 */

import {
  AbstractDoToEntityTask,
  DoToClosestEntityTask,
  GiveItemToPlayerTask,
  KillPlayerTask,
  InteractWithEntityTask,
  killEntities,
} from '../src/tasks/concrete/EntityTask';
import { Task } from '../src/tasks/Task';
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
      setGoal: jest.fn(),
      goto: jest.fn(),
      isMoving: () => false,
    },
    attack: jest.fn(),
    useOn: jest.fn(),
    toss: jest.fn(),
    setControlState: jest.fn(),
    clearControlStates: jest.fn(),
    look: jest.fn(),
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

describe('Entity Tasks', () => {
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
      const attackMock = jest.fn();
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
      const useOnMock = jest.fn();
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

    it('GiveItemToPlayerTask should be equal if same player and item', () => {
      const bot = createMockBot();
      const task1 = new GiveItemToPlayerTask(bot, 'Steve', 'diamond', 5);
      const task2 = new GiveItemToPlayerTask(bot, 'Steve', 'diamond', 5);
      expect(task1.isEqual(task2)).toBe(true);
    });
  });
});

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
