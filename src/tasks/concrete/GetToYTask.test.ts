import { describe, test, expect, mock } from 'bun:test';
import { Vec3 } from 'vec3';
import { GetToYTask } from './MovementUtilTask';

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

describe('Task Hierarchy', () => {
  describe('Intent: All tasks should have proper display names', () => {
    test('GetToYTask should show target Y', () => {
      const bot = createMockBot();
      const task = new GetToYTask(bot, -59);

      expect(task.displayName).toBe('GetToY(-59)');
    });
  });
});
