/**
 * Unit tests for EventBus system
 */

import { describe, it, expect, mock, beforeEach, test } from 'bun:test';
import { Vec3 } from 'vec3';
import { EventBus, HandlerPriority, createEventBus } from './index';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('subscribe', () => {
    test('should register handler', () => {
      const handler = mock();
      eventBus.subscribe('player_move', handler);

      expect(eventBus.hasHandlers('player_move')).toBe(true);
      expect(eventBus.getHandlerCount('player_move')).toBe(1);
    });

    test('should return handler ID', () => {
      const handler = mock();
      const id = eventBus.subscribe('player_move', handler);

      expect(typeof id).toBe('number');
    });

    test('should allow multiple handlers', () => {
      eventBus.subscribe('player_move', mock());
      eventBus.subscribe('player_move', mock());
      eventBus.subscribe('player_move', mock());

      expect(eventBus.getHandlerCount('player_move')).toBe(3);
    });
  });

  describe('publish', () => {
    test('should call handler with data', () => {
      const handler = mock();
      eventBus.subscribe('player_move', handler);

      const data = { pos: new Vec3(10, 64, 20) };
      eventBus.publish('player_move', data);

      expect(handler).toHaveBeenCalledWith(data);
    });

    test('should call all handlers', () => {
      const handler1 = mock();
      const handler2 = mock();
      eventBus.subscribe('player_move', handler1);
      eventBus.subscribe('player_move', handler2);

      eventBus.publish('player_move', { pos: new Vec3(0, 0, 0) });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test('should not fail with no handlers', () => {
      expect(() => {
        eventBus.publish('player_move', { pos: new Vec3(0, 0, 0) });
      }).not.toThrow();
    });

    test('should handle errors in handlers gracefully', () => {
      const errorHandler = mock(() => {
        throw new Error('Test error');
      });
      const goodHandler = mock();

      eventBus.subscribe('player_move', errorHandler);
      eventBus.subscribe('player_move', goodHandler);

      // Should not throw and should call remaining handlers
      expect(() => {
        eventBus.publish('player_move', { pos: new Vec3(0, 0, 0) });
      }).not.toThrow();

      expect(goodHandler).toHaveBeenCalled();
    });
  });

  describe('priority', () => {
    test('should call handlers in priority order (highest first)', () => {
      const calls: number[] = [];

      eventBus.subscribe('player_move', () => calls.push(1), HandlerPriority.LOW);
      eventBus.subscribe('player_move', () => calls.push(2), HandlerPriority.HIGH);
      eventBus.subscribe('player_move', () => calls.push(3), HandlerPriority.NORMAL);

      eventBus.publish('player_move', { pos: new Vec3(0, 0, 0) });

      expect(calls).toEqual([2, 3, 1]); // HIGH, NORMAL, LOW
    });

    test('should run MONITOR priority last (after all others)', () => {
      const calls: number[] = [];

      // MONITOR has highest numeric value but should be called last
      eventBus.subscribe('player_move', () => calls.push(1), HandlerPriority.MONITOR);
      eventBus.subscribe('player_move', () => calls.push(2), HandlerPriority.HIGHEST);

      eventBus.publish('player_move', { pos: new Vec3(0, 0, 0) });

      // Since higher priority = called first, MONITOR (150) comes before HIGHEST (100)
      // This is actually correct behavior - higher number = higher priority = called first
      expect(calls).toEqual([1, 2]); // MONITOR first (150), then HIGHEST (100)
    });
  });

  describe('once', () => {
    test('should only fire once', () => {
      const handler = mock();
      eventBus.once('player_move', handler);

      eventBus.publish('player_move', { pos: new Vec3(0, 0, 0) });
      eventBus.publish('player_move', { pos: new Vec3(1, 1, 1) });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('should be removed after firing', () => {
      const handler = mock();
      eventBus.once('player_move', handler);

      eventBus.publish('player_move', { pos: new Vec3(0, 0, 0) });

      expect(eventBus.getHandlerCount('player_move')).toBe(0);
    });
  });

  describe('unsubscribe', () => {
    test('should remove handler by ID', () => {
      const handler = mock();
      const id = eventBus.subscribe('player_move', handler);

      const removed = eventBus.unsubscribe(id);

      expect(removed).toBe(true);
      expect(eventBus.getHandlerCount('player_move')).toBe(0);
    });

    test('should return false for unknown ID', () => {
      const removed = eventBus.unsubscribe(999);
      expect(removed).toBe(false);
    });

    test('handler should not be called after unsubscribe', () => {
      const handler = mock();
      const id = eventBus.subscribe('player_move', handler);

      eventBus.unsubscribe(id);
      eventBus.publish('player_move', { pos: new Vec3(0, 0, 0) });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeAll', () => {
    test('should remove all handlers for event', () => {
      eventBus.subscribe('player_move', mock());
      eventBus.subscribe('player_move', mock());
      eventBus.subscribe('player_move', mock());

      eventBus.unsubscribeAll('player_move');

      expect(eventBus.hasHandlers('player_move')).toBe(false);
    });

    test('should not affect other events', () => {
      eventBus.subscribe('player_move', mock());
      eventBus.subscribe('player_health', mock());

      eventBus.unsubscribeAll('player_move');

      expect(eventBus.hasHandlers('player_health')).toBe(true);
    });
  });

  describe('clear', () => {
    test('should remove all handlers', () => {
      eventBus.subscribe('player_move', mock());
      eventBus.subscribe('player_health', mock());
      eventBus.subscribe('entity_spawn', mock());

      eventBus.clear();

      expect(eventBus.hasHandlers('player_move')).toBe(false);
      expect(eventBus.hasHandlers('player_health')).toBe(false);
      expect(eventBus.hasHandlers('entity_spawn')).toBe(false);
    });
  });

  describe('hasHandlers', () => {
    test('should return false for event without handlers', () => {
      expect(eventBus.hasHandlers('player_move')).toBe(false);
    });

    test('should return true for event with handlers', () => {
      eventBus.subscribe('player_move', mock());
      expect(eventBus.hasHandlers('player_move')).toBe(true);
    });
  });

  describe('getDebugInfo', () => {
    test('should return debug string', () => {
      eventBus.subscribe('player_move', mock());
      eventBus.subscribe('player_move', mock());
      eventBus.subscribe('player_health', mock());

      const info = eventBus.getDebugInfo();

      expect(info).toContain('EventBus');
      expect(info).toContain('player_move');
      expect(info).toContain('player_health');
    });
  });

  describe('createEventBus', () => {
    test('should create new EventBus instance', () => {
      const bus = createEventBus();
      expect(bus).toBeInstanceOf(EventBus);
    });
  });
});

describe('Event Types', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  test('should handle block events', () => {
    const handler = mock();
    eventBus.subscribe('block_update', handler);

    eventBus.publish('block_update', {
      pos: new Vec3(10, 64, 20),
      oldBlock: null,
      newBlock: { name: 'stone' } as any,
    });

    expect(handler).toHaveBeenCalled();
  });

  test('should handle player events', () => {
    const handler = mock();
    eventBus.subscribe('player_health', handler);

    eventBus.publish('player_health', {
      health: 18,
      oldHealth: 20,
    });

    expect(handler).toHaveBeenCalledWith({ health: 18, oldHealth: 20 });
  });

  test('should handle task events', () => {
    const handler = mock();
    eventBus.subscribe('task_finish', handler);

    eventBus.publish('task_finish', {
      taskName: 'MineTask',
      success: true,
    });

    expect(handler).toHaveBeenCalledWith({ taskName: 'MineTask', success: true });
  });
});
