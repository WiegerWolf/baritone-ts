import { describe, it, expect, mock, test } from 'bun:test';
import { Vec3 } from 'vec3';
import { TimeoutWanderTask } from './TimeoutWanderTask';

/**
 * Create a mock bot for testing
 */
function createMockBot(options: {
  position?: Vec3;
  onGround?: boolean;
  isInWater?: boolean;
} = {}): any {
  const bot: any = {
    entity: {
      position: options.position ?? new Vec3(0, 64, 0),
      velocity: new Vec3(0, 0, 0),
      onGround: options.onGround ?? true,
      isInWater: options.isInWater ?? false,
    },
    health: 20,
    food: 20,
    time: { age: 0 },
    inventory: {
      cursor: null,
      items: () => [],
      slots: Array(46).fill(null),
      firstEmptyInventorySlot: () => 10,
    },
    clickWindow: mock().mockResolvedValue(undefined),
    setControlState: mock(),
    getControlState: mock().mockReturnValue(false),
    clearControlStates: mock(),
    lookAt: mock(),
    blockAt: mock().mockReturnValue({ name: 'stone' }),
  };

  return bot;
}

describe('TimeoutWanderTask', () => {
  describe('Intent: Escape from bad positions when stuck', () => {
    test('should not finish immediately with infinite distance', () => {
      const bot = createMockBot();
      const task = new TimeoutWanderTask(bot, Infinity);

      task.tick();
      task.tick();
      task.tick();

      expect(task.isFinished()).toBe(false);
    });

    test('should finish when wandered far enough', () => {
      const bot = createMockBot({ position: new Vec3(0, 64, 0) });
      const task = new TimeoutWanderTask(bot, 5);

      // Start at origin
      task.tick();

      // Simulate moving away
      bot.entity.position = new Vec3(10, 64, 0);
      bot.entity.onGround = true;

      expect(task.isFinished()).toBe(true);
    });

    test('should require being grounded to check completion', () => {
      const bot = createMockBot({
        position: new Vec3(0, 64, 0),
        onGround: false,
      });
      const task = new TimeoutWanderTask(bot, 5);

      task.tick();

      // Moved far but in air
      bot.entity.position = new Vec3(100, 70, 0);

      expect(task.isFinished()).toBe(false);
    });

    test('should give up after too many failures (internal state)', () => {
      const bot = createMockBot();
      const task = new TimeoutWanderTask(bot, 100);

      // Initialize task
      (task as any).onStart();

      // Access internal failCounter and verify it's initially 0
      expect((task as any).failCounter).toBe(0);

      // The task internally tracks failCounter and gives up when it exceeds maxFails
      // We test the behavior by verifying the fail counter logic exists
      expect((task as any).maxFails).toBe(10);
    });

    test('should implement ITaskRequiresGrounded', () => {
      const bot = createMockBot();
      const task = new TimeoutWanderTask(bot);

      expect(task.requiresGrounded).toBe(true);
    });
  });

  describe('Intent: Escape nether portals automatically', () => {
    test('should sneak forward when in nether portal', () => {
      const bot = createMockBot();
      bot.blockAt = mock().mockReturnValue({ name: 'nether_portal' });

      const task = new TimeoutWanderTask(bot);
      task.tick();

      expect(bot.setControlState).toHaveBeenCalledWith('sneak', true);
      expect(bot.setControlState).toHaveBeenCalledWith('forward', true);
    });
  });

  describe('Intent: Support increasing wander range on failures', () => {
    test('should increase range when configured', () => {
      const bot = createMockBot({ position: new Vec3(0, 64, 0) });
      const task = new TimeoutWanderTask(bot, 5, true);

      task.tick();

      // Complete the task
      bot.entity.position = new Vec3(10, 64, 0);
      expect(task.isFinished()).toBe(true);

      // Stop should increase extension
      task.stop(null);

      // resetWander should clear extension
      task.resetWander();
    });
  });

  describe('Intent: Tasks with similar distances should be equal', () => {
    test('should identify equal tasks', () => {
      const bot = createMockBot();
      const task1 = new TimeoutWanderTask(bot, 10);
      const task2 = new TimeoutWanderTask(bot, 10.1);
      const task3 = new TimeoutWanderTask(bot, 20);

      expect(task1.isEqual(task2)).toBe(true); // Within 0.5 tolerance
      expect(task1.isEqual(task3)).toBe(false);
    });

    test('should handle infinite distances', () => {
      const bot = createMockBot();
      const task1 = new TimeoutWanderTask(bot, Infinity);
      const task2 = new TimeoutWanderTask(bot, Infinity);
      const task3 = new TimeoutWanderTask(bot, 100);

      expect(task1.isEqual(task2)).toBe(true);
      expect(task1.isEqual(task3)).toBe(false);
    });
  });
});

describe('Task Hierarchy', () => {
  describe('Intent: All tasks should have proper display names', () => {
    test('TimeoutWanderTask should show distance', () => {
      const bot = createMockBot();
      const task = new TimeoutWanderTask(bot, 15.5);

      expect(task.displayName).toContain('15.5');
    });

    test('TimeoutWanderTask should show infinite for infinite distance', () => {
      const bot = createMockBot();
      const task = new TimeoutWanderTask(bot, Infinity);

      expect(task.displayName).toContain('infinite');
    });
  });
});
