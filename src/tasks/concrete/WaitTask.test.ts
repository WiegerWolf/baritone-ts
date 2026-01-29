import { describe, test, expect, mock } from 'bun:test';
import { Vec3 } from 'vec3';
import { WaitTask } from './MovementUtilTask';

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
