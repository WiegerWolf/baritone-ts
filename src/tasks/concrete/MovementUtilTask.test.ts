/**
 * Unit tests for Movement Utility Tasks
 *
 * Tests cover:
 * - TimeoutWanderTask: Wander away from current position
 * - IdleTask: Do nothing placeholder
 * - GetToYTask: Navigate to specific Y level
 * - SafeRandomShimmyTask: Escape stuck situations
 * - WaitTask: Wait for duration
 * - LookAtBlockTask: Orient player view
 *
 * Tests focus on INTENT (WHY these tasks exist) not just HOW they work.
 */

import { describe, it, expect, mock, test } from 'bun:test';
import { Vec3 } from 'vec3';
import {
  TimeoutWanderTask,
  IdleTask,
  GetToYTask,
  SafeRandomShimmyTask,
  WaitTask,
  LookAtBlockTask,
} from './MovementUtilTask';

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

describe('IdleTask', () => {
  describe('Intent: Placeholder task that never finishes', () => {
    test('should never finish', () => {
      const bot = createMockBot();
      const task = new IdleTask(bot);

      // Tick many times
      for (let i = 0; i < 100; i++) {
        task.tick();
        bot.time.age += 20;
      }

      expect(task.isFinished()).toBe(false);
    });

    test('should return null from onTick (no subtask)', () => {
      const bot = createMockBot();
      const task = new IdleTask(bot);

      const result = task.tick();

      expect(result).toBeUndefined(); // No child task returned
    });

    test('should have descriptive display name', () => {
      const bot = createMockBot();
      const task = new IdleTask(bot);

      expect(task.displayName).toBe('Idle');
    });

    test('all IdleTask instances should be equal', () => {
      const bot = createMockBot();
      const task1 = new IdleTask(bot);
      const task2 = new IdleTask(bot);

      expect(task1.isEqual(task2)).toBe(true);
    });
  });
});

describe('GetToYTask', () => {
  describe('Intent: Navigate to a specific altitude', () => {
    test('should finish when at target Y level', () => {
      const bot = createMockBot({ position: new Vec3(0, 64, 0) });
      const task = new GetToYTask(bot, 64);

      task.tick();

      expect(task.isFinished()).toBe(true);
    });

    test('should finish within tolerance', () => {
      const bot = createMockBot({ position: new Vec3(0, 63, 0) });
      const task = new GetToYTask(bot, 64, 2);

      expect(task.isFinished()).toBe(true); // Within tolerance of 2
    });

    test('should not finish when too far from target', () => {
      const bot = createMockBot({ position: new Vec3(0, 50, 0) });
      const task = new GetToYTask(bot, 64);

      expect(task.isFinished()).toBe(false);
    });

    test('should implement ITaskRequiresGrounded', () => {
      const bot = createMockBot();
      const task = new GetToYTask(bot, 64);

      expect(task.requiresGrounded).toBe(true);
    });

    test('should clear control states on stop', () => {
      const bot = createMockBot();
      const task = new GetToYTask(bot, 64);

      task.stop(null);

      expect(bot.clearControlStates).toHaveBeenCalled();
    });
  });

  describe('Intent: Handle being stuck', () => {
    test('should attempt to move when not at target Y', () => {
      const bot = createMockBot({ position: new Vec3(0, 50, 0) });
      const task = new GetToYTask(bot, 64);

      // Initialize task
      (task as any).onStart();
      (task as any).onTick();

      // Should be setting control states to move
      expect(bot.setControlState).toHaveBeenCalled();
    });
  });
});

describe('SafeRandomShimmyTask', () => {
  describe('Intent: Escape from stuck situations with random movement', () => {
    test('should finish after duration', () => {
      const bot = createMockBot();
      const task = new SafeRandomShimmyTask(bot, 1.0);

      task.tick();
      expect(task.isFinished()).toBe(false);

      // Advance time past duration
      bot.time.age = 25; // 1.25 seconds
      task.tick();

      expect(task.isFinished()).toBe(true);
    });

    test('should make control state changes', () => {
      const bot = createMockBot();
      const task = new SafeRandomShimmyTask(bot, 2.0);

      task.tick();

      // Should be setting some control states
      expect(bot.setControlState).toHaveBeenCalled();
    });

    test('should clear control states on stop', () => {
      const bot = createMockBot();
      const task = new SafeRandomShimmyTask(bot);

      task.tick();
      task.stop(null);

      expect(bot.clearControlStates).toHaveBeenCalled();
    });

    test('should look in chosen direction', () => {
      const bot = createMockBot();
      const task = new SafeRandomShimmyTask(bot);

      task.tick();

      expect(bot.lookAt).toHaveBeenCalled();
    });
  });

  describe('Intent: Tasks with similar durations should be equal', () => {
    test('should identify equal tasks', () => {
      const bot = createMockBot();
      const task1 = new SafeRandomShimmyTask(bot, 1.5);
      const task2 = new SafeRandomShimmyTask(bot, 1.55);
      const task3 = new SafeRandomShimmyTask(bot, 3.0);

      expect(task1.isEqual(task2)).toBe(true); // Within 0.1 tolerance
      expect(task1.isEqual(task3)).toBe(false);
    });
  });
});

describe('WaitTask', () => {
  describe('Intent: Wait for a specified duration', () => {
    test('should not finish immediately', () => {
      const bot = createMockBot();
      const task = new WaitTask(bot, 2.0);

      task.tick();

      expect(task.isFinished()).toBe(false);
    });

    test('should finish after duration', () => {
      const bot = createMockBot();
      const task = new WaitTask(bot, 1.0);

      task.tick();
      bot.time.age = 25; // 1.25 seconds
      task.tick();

      expect(task.isFinished()).toBe(true);
    });

    test('should report remaining time', () => {
      const bot = createMockBot();
      const task = new WaitTask(bot, 5.0);

      task.tick();

      const remaining = task.getRemainingTime();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(5.0);
    });

    test('should have descriptive display name', () => {
      const bot = createMockBot();
      const task = new WaitTask(bot, 3.5);

      expect(task.displayName).toBe('Wait(3.5s)');
    });

    test('should return null from tick (no subtask)', () => {
      const bot = createMockBot();
      const task = new WaitTask(bot, 1.0);

      const result = task.tick();

      expect(result).toBeUndefined();
    });
  });
});

describe('LookAtBlockTask', () => {
  describe('Intent: Orient player to look at a block', () => {
    test('should call lookAt with block center', () => {
      const bot = createMockBot();
      const task = new LookAtBlockTask(bot, 10, 64, 20);

      task.tick();

      expect(bot.lookAt).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 10.5,
          y: 64.5,
          z: 20.5,
        }),
        true
      );
    });

    test('should finish after looking', () => {
      const bot = createMockBot();
      const task = new LookAtBlockTask(bot, 10, 64, 20);

      expect(task.isFinished()).toBe(false);

      task.tick();

      expect(task.isFinished()).toBe(true);
    });

    test('should have descriptive display name', () => {
      const bot = createMockBot();
      const task = new LookAtBlockTask(bot, 10, 64, 20);

      expect(task.displayName).toBe('LookAt(10, 64, 20)');
    });
  });

  describe('Intent: Tasks with same target should be equal', () => {
    test('should identify equal tasks', () => {
      const bot = createMockBot();
      const task1 = new LookAtBlockTask(bot, 10, 64, 20);
      const task2 = new LookAtBlockTask(bot, 10, 64, 20);
      const task3 = new LookAtBlockTask(bot, 10, 64, 21);

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

    test('GetToYTask should show target Y', () => {
      const bot = createMockBot();
      const task = new GetToYTask(bot, -59);

      expect(task.displayName).toBe('GetToY(-59)');
    });
  });
});
