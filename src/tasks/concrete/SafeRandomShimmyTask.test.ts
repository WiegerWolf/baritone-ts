import { describe, test, expect, mock } from 'bun:test';
import { Vec3 } from 'vec3';
import { SafeRandomShimmyTask } from './SafeRandomShimmyTask';

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
