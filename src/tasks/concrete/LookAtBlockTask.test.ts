import { describe, test, expect, mock } from 'bun:test';
import { Vec3 } from 'vec3';
import { LookAtBlockTask } from './MovementUtilTask';

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
