/**
 * Tests for AbstractDoToStorageContainerTask
 */

import { describe, it, expect, mock } from 'bun:test';
import { AbstractDoToStorageContainerTask } from './ContainerTask';
import { Task } from '../Task';
import { BlockPos } from '../../types';

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

// Create concrete implementation for testing
class TestStorageTask extends AbstractDoToStorageContainerTask {
  private target: BlockPos | null = null;
  public finished = false;

  setTarget(pos: BlockPos): void {
    this.target = pos;
  }

  protected getContainerTarget(): BlockPos | null {
    return this.target;
  }

  protected onContainerOpenSubtask(containerPos: BlockPos): Task | null {
    this.finished = true;
    return null;
  }
}

describe('AbstractDoToStorageContainerTask', () => {
  it('should wander when no container target', () => {
    const bot = createMockBot();
    const task = new TestStorageTask(bot);
    task.onStart();

    const subtask = task.onTick();
    // Should return a wander task
    expect(subtask).not.toBeNull();
    expect(subtask?.displayName).toContain('Wander');
  });

  /**
   * WHY: When a container target is set, the task should navigate
   * to it and attempt to open it.
   */
  it('should interact with container when target set', () => {
    const bot = createMockBot({
      blockAt: (pos: any) => {
        return { name: 'chest', position: pos, boundingBox: 'block' };
      },
    });

    const task = new TestStorageTask(bot);
    task.setTarget(new BlockPos(5, 64, 5));
    task.onStart();

    const subtask = task.onTick();
    // Should return an interact task
    expect(subtask).not.toBeNull();
  });

  /**
   * WHY: Chests with solid blocks above them cannot be opened.
   * The task should handle this edge case.
   */
  it('should handle blocked chests', () => {
    const bot = createMockBot({
      blockAt: (pos: any) => {
        if (pos.y === 64) {
          return { name: 'chest', position: pos, boundingBox: 'block' };
        }
        if (pos.y === 65) {
          return { name: 'stone', position: pos, boundingBox: 'block' };
        }
        return null;
      },
    });

    const task = new TestStorageTask(bot);
    task.setTarget(new BlockPos(5, 64, 5));
    task.onStart();

    // Should wander to find another container or handle the blocked chest
    const subtask = task.onTick();
    expect(subtask).not.toBeNull();
  });
});
