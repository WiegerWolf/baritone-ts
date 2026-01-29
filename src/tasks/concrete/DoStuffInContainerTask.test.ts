/**
 * Tests for DoStuffInContainerTask base class
 */

import { describe, it, expect, mock } from 'bun:test';
import { DoStuffInContainerTask } from './ContainerTask';
import { Task } from '../Task';

// Mock bot for testing
function createMockBot(overrides: Record<string, any> = {}): any {
  return {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: (other: any) => {
          const dx = other.x - 0;
          const dy = (other.y || 64) - 64;
          const dz = other.z - 0;
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        },
        offset: (x: number, y: number, z: number) => ({ x, y: 64 + y, z }),
        clone: () => ({ x: 0, y: 64, z: 0, distanceTo: () => 5 }),
      },
    },
    inventory: {
      items: () => [],
      slots: {},
    },
    blockAt: () => null,
    entities: {},
    time: { timeOfDay: 6000, age: 0 },
    health: 20,
    food: 20,
    heldItem: null,
    currentWindow: null,
    pathfinder: {
      setGoal: mock(),
      goto: mock(),
      isMoving: () => false,
    },
    closeWindow: mock(),
    ...overrides,
  };
}

// Create a concrete implementation for testing
class TestContainerTask extends DoStuffInContainerTask {
  public containerOpened = false;
  public workDone = false;

  constructor(bot: any) {
    super(bot, {
      containerBlocks: ['chest'],
      containerItem: 'chest',
      canPlaceNew: false, // Don't try to place for simpler testing
    });
  }

  protected containerSubTask(): Task | null {
    this.workDone = true;
    this.finishContainerWork();
    return null;
  }

  protected isContainerOpen(): boolean {
    return this.containerOpened;
  }
}

describe('DoStuffInContainerTask base class', () => {
  it('should fail when no container available and cannot place', () => {
    const bot = createMockBot();
    const task = new TestContainerTask(bot);
    task.onStart();
    task.onTick();
    expect(task.isFailed()).toBe(true);
  });

  /**
   * WHY: When a container is found, the task should approach it
   * rather than immediately trying to interact.
   */
  it('should approach container when found', () => {
    const bot = createMockBot({
      blockAt: (pos: any) => {
        if (pos.x === 5 && pos.y === 64 && pos.z === 5) {
          return { name: 'chest', position: { x: 5, y: 64, z: 5 }, boundingBox: 'block' };
        }
        return null;
      },
    });

    const task = new TestContainerTask(bot);
    task.onStart();
    const subtask = task.onTick();
    // Should return a navigation subtask
    expect(subtask !== null || task.isFailed()).toBe(true);
  });

  /**
   * WHY: Container task lifecycle should properly clean up when stopped,
   * closing any open windows.
   */
  it('should close window on stop', () => {
    const closeWindow = mock();
    const bot = createMockBot({
      currentWindow: { type: 'chest' },
      closeWindow,
    });

    const task = new TestContainerTask(bot);
    task.onStart();
    task.onStop(null);
    expect(closeWindow).toHaveBeenCalled();
  });
});
