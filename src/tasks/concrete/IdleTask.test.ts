import { describe, test, expect, mock } from 'bun:test';
import { Vec3 } from 'vec3';
import { IdleTask } from './IdleTask';

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
