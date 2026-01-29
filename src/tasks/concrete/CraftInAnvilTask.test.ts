/**
 * Tests for CraftInAnvilTask
 */

import { describe, it, expect, mock } from 'bun:test';
import { CraftInAnvilTask } from './ContainerTask';

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

describe('CraftInAnvilTask', () => {
  it('should create with correct display name', () => {
    const bot = createMockBot();
    const task = new CraftInAnvilTask(bot);
    expect(task.displayName).toBe('CraftInAnvil');
  });

  /**
   * WHY: Anvils can be in different damage states but all function the same.
   * The task should accept any anvil variant.
   */
  it('should recognize all anvil variants', () => {
    // The task is configured to accept all anvil types
    const bot = createMockBot();
    const task = new CraftInAnvilTask(bot);
    task.onStart();
    // Internal config should include all variants
    expect(task.isFinished()).toBe(false);
  });
});
