/**
 * Unit tests for AltoClef/BaritonePlus Task System
 */

import { Vec3 } from 'vec3';
import {
  Task,
  TaskChain,
  SingleTaskChain,
  UserTaskChain,
  TaskRunner,
  ChainPriority,
  isGroundedOrSafe,
  taskOverridesGrounded,
} from './index';
import type { ITask, ITaskOverridesGrounded } from './index';

/**
 * Concrete implementation of SingleTaskChain for testing
 */
class TestSingleTaskChain extends SingleTaskChain {
  private task: Task;
  private priority: number;

  constructor(bot: any, task: Task, priority: number) {
    super(bot);
    this.task = task;
    this.priority = priority;
  }

  get displayName(): string {
    return 'TestSingleTaskChain';
  }

  getPriority(): number {
    return this.isActive() ? this.priority : ChainPriority.INACTIVE;
  }

  isActive(): boolean {
    return this.task && !this.task.isFinished();
  }

  protected getTaskForTick(): Task | null {
    return this.task.isFinished() ? null : this.task;
  }
}

/**
 * Mock bot for testing
 */
function createMockBot(options: {
  onGround?: boolean;
  inWater?: boolean;
  health?: number;
  food?: number;
  position?: Vec3;
} = {}): any {
  return {
    entity: {
      position: options.position ?? new Vec3(0, 64, 0),
      velocity: new Vec3(0, 0, 0),
      onGround: options.onGround ?? true,
      isInWater: options.inWater ?? false,
      height: 1.8,
    },
    health: options.health ?? 20,
    food: options.food ?? 20,
    time: { age: 0 },
    inventory: {
      items: () => [],
      slots: Array(46).fill(null),
      cursor: null,
    },
    blockAt: () => null,
    setQuickBarSlot: jest.fn(),
    clearControlStates: jest.fn(),
  };
}

/**
 * Test task that counts ticks
 */
class CounterTask extends Task {
  ticks = 0;
  maxTicks: number;

  constructor(bot: any, maxTicks: number = 5) {
    super(bot);
    this.maxTicks = maxTicks;
  }

  get displayName(): string {
    return `CounterTask(${this.ticks}/${this.maxTicks})`;
  }

  onTick(): Task | null {
    this.ticks++;
    return null;
  }

  isFinished(): boolean {
    return this.ticks >= this.maxTicks;
  }
}

/**
 * Test task with child delegation
 */
class ParentTask extends Task {
  child: Task;

  constructor(bot: any, child: Task) {
    super(bot);
    this.child = child;
  }

  get displayName(): string {
    return `ParentTask(${this.child.displayName})`;
  }

  onTick(): Task | null {
    return this.child;
  }

  isFinished(): boolean {
    return this.child.isFinished();
  }
}

/**
 * Test task that overrides grounded
 */
class MLGTask extends Task implements ITaskOverridesGrounded {
  readonly overridesGrounded = true;

  get displayName(): string {
    return 'MLGTask';
  }

  onTick(): Task | null {
    return null;
  }

  isFinished(): boolean {
    return true;
  }
}

describe('Task', () => {
  let bot: any;

  beforeEach(() => {
    bot = createMockBot();
  });

  test('should execute onStart on first tick', () => {
    const task = new CounterTask(bot);
    const onStartSpy = jest.spyOn(task, 'onStart');

    task.tick();
    expect(onStartSpy).toHaveBeenCalledTimes(1);

    task.tick();
    expect(onStartSpy).toHaveBeenCalledTimes(1); // Not called again
  });

  test('should increment counter on each tick', () => {
    const task = new CounterTask(bot, 3);

    expect(task.ticks).toBe(0);
    task.tick();
    expect(task.ticks).toBe(1);
    task.tick();
    expect(task.ticks).toBe(2);
    task.tick();
    expect(task.ticks).toBe(3);
  });

  test('should report finished correctly', () => {
    const task = new CounterTask(bot, 2);

    expect(task.isFinished()).toBe(false);
    task.tick();
    expect(task.isFinished()).toBe(false);
    task.tick();
    expect(task.isFinished()).toBe(true);
  });

  test('should delegate to child task', () => {
    const child = new CounterTask(bot, 3);
    const parent = new ParentTask(bot, child);

    parent.tick();
    expect(child.ticks).toBe(1);

    parent.tick();
    expect(child.ticks).toBe(2);
  });

  test('should call onStop when stopped', () => {
    const task = new CounterTask(bot);
    const onStopSpy = jest.spyOn(task, 'onStop');

    task.tick();
    task.stop(null);

    expect(onStopSpy).toHaveBeenCalledWith(null);
  });

  test('should report active status', () => {
    const task = new CounterTask(bot);

    expect(task.isActive()).toBe(false);
    task.tick();
    expect(task.isActive()).toBe(true);
    task.stop(null);
    expect(task.isActive()).toBe(false);
  });

  test('should reset correctly', () => {
    const task = new CounterTask(bot, 10);
    task.tick();
    task.tick();

    expect(task.isActive()).toBe(true);

    task.reset();

    expect(task.isActive()).toBe(false);
    expect(task.isStopped()).toBe(false);
  });

  test('should generate task chain string', () => {
    const child = new CounterTask(bot, 3);
    const parent = new ParentTask(bot, child);

    parent.tick();

    const chain = parent.getTaskChainString();
    expect(chain).toContain('ParentTask');
    expect(chain).toContain('CounterTask');
  });
});

describe('TaskChain', () => {
  let bot: any;

  beforeEach(() => {
    bot = createMockBot();
  });

  test('TestSingleTaskChain should run task', () => {
    const task = new CounterTask(bot, 3);
    const chain = new TestSingleTaskChain(bot, task, ChainPriority.USER_TASK);

    chain.onTick();
    expect(task.ticks).toBe(1);

    chain.onTick();
    expect(task.ticks).toBe(2);
  });

  test('TestSingleTaskChain should report active when task not finished', () => {
    const task = new CounterTask(bot, 2);
    const chain = new TestSingleTaskChain(bot, task, ChainPriority.USER_TASK);

    expect(chain.isActive()).toBe(true);

    chain.onTick();
    chain.onTick();

    expect(chain.isActive()).toBe(false); // Task finished
  });

  test('TestSingleTaskChain should return correct priority', () => {
    const task = new CounterTask(bot);
    const chain = new TestSingleTaskChain(bot, task, ChainPriority.FOOD);

    expect(chain.getPriority()).toBe(ChainPriority.FOOD);
  });

  test('UserTaskChain should allow setting task', () => {
    const chain = new UserTaskChain(bot);

    expect(chain.isActive()).toBe(false);

    const task = new CounterTask(bot);
    chain.setUserTask(task);

    expect(chain.isActive()).toBe(true);
  });

  test('UserTaskChain should allow clearing task', () => {
    const chain = new UserTaskChain(bot);
    const task = new CounterTask(bot);

    chain.setUserTask(task);
    expect(chain.isActive()).toBe(true);

    chain.cancel();
    expect(chain.isActive()).toBe(false);
  });
});

describe('TaskRunner', () => {
  let bot: any;

  beforeEach(() => {
    bot = createMockBot();
  });

  test('should run highest priority chain', () => {
    const runner = new TaskRunner(bot);

    const lowTask = new CounterTask(bot);
    const highTask = new CounterTask(bot);

    const lowChain = new TestSingleTaskChain(bot, lowTask, ChainPriority.USER_TASK);
    const highChain = new TestSingleTaskChain(bot, highTask, ChainPriority.DANGER);

    runner.registerChain(lowChain);
    runner.registerChain(highChain);

    runner.tick();

    // High priority chain should run
    expect(highTask.ticks).toBe(1);
    expect(lowTask.ticks).toBe(0);
  });

  test('should switch chains when priorities change', () => {
    const runner = new TaskRunner(bot);

    const userTask = new CounterTask(bot, 10);
    const userChain = new UserTaskChain(bot);
    userChain.setUserTask(userTask);

    runner.registerChain(userChain);

    runner.tick();
    expect(userTask.ticks).toBe(1);

    // Now add a higher priority chain
    const dangerTask = new CounterTask(bot, 2);
    const dangerChain = new TestSingleTaskChain(bot, dangerTask, ChainPriority.DANGER);
    runner.registerChain(dangerChain);

    runner.tick();
    expect(dangerTask.ticks).toBe(1);
    expect(userTask.ticks).toBe(1); // User task didn't run

    // After danger task finishes, user task resumes
    runner.tick(); // dangerTask finishes
    runner.tick(); // now userTask runs
    expect(userTask.ticks).toBe(2);
  });

  test('should do nothing with no active chains', () => {
    const runner = new TaskRunner(bot);

    const task = new CounterTask(bot, 1);
    const chain = new TestSingleTaskChain(bot, task, ChainPriority.USER_TASK);

    runner.registerChain(chain);

    // Finish the task
    runner.tick();
    expect(task.isFinished()).toBe(true);

    // Now tick again - should not throw
    expect(() => runner.tick()).not.toThrow();
  });

  test('should emit chain_changed event', () => {
    const runner = new TaskRunner(bot);
    const callback = jest.fn();

    runner.on('chain_changed', callback);

    const task = new CounterTask(bot);
    const chain = new TestSingleTaskChain(bot, task, ChainPriority.USER_TASK);
    runner.registerChain(chain);

    runner.tick();

    expect(callback).toHaveBeenCalled();
  });

  test('should remove chain', () => {
    const runner = new TaskRunner(bot);

    const task = new CounterTask(bot);
    const chain = new TestSingleTaskChain(bot, task, ChainPriority.USER_TASK);

    runner.registerChain(chain);
    runner.tick();
    expect(task.ticks).toBe(1);

    runner.unregisterChain(chain);
    runner.tick();
    expect(task.ticks).toBe(1); // Didn't run
  });
});

describe('Grounded Safety', () => {
  test('isGroundedOrSafe should return true when on ground', () => {
    const bot = createMockBot({ onGround: true });
    expect(isGroundedOrSafe(bot)).toBe(true);
  });

  test('isGroundedOrSafe should return true when in water', () => {
    const bot = createMockBot({ onGround: false, inWater: true });
    expect(isGroundedOrSafe(bot)).toBe(true);
  });

  test('isGroundedOrSafe should return false when falling', () => {
    const bot = createMockBot({ onGround: false, inWater: false });
    expect(isGroundedOrSafe(bot)).toBe(false);
  });

  test('taskOverridesGrounded should detect override marker', () => {
    const bot = createMockBot();
    const mlgTask = new MLGTask(bot);

    expect(taskOverridesGrounded(mlgTask)).toBe(true);
  });

  test('taskOverridesGrounded should return false for normal tasks', () => {
    const bot = createMockBot();
    const normalTask = new CounterTask(bot);

    expect(taskOverridesGrounded(normalTask)).toBe(false);
  });
});

describe('ChainPriority', () => {
  test('should have correct ordering', () => {
    expect(ChainPriority.INACTIVE).toBeLessThan(ChainPriority.USER_TASK);
    expect(ChainPriority.USER_TASK).toBeLessThan(ChainPriority.FOOD);
    expect(ChainPriority.FOOD).toBeLessThan(ChainPriority.DANGER);
    expect(ChainPriority.DANGER).toBeLessThan(ChainPriority.DEATH);
  });
});
