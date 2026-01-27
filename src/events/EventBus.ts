/**
 * EventBus - Type-Safe Pub-Sub Event System
 * Based on AltoClef's EventBus.java
 *
 * Provides a centralized event system for decoupling components.
 * Trackers subscribe to world events, tasks react to changes.
 *
 * Features:
 * - Type-safe event definitions
 * - Priority-based handler ordering
 * - One-time handlers
 * - Handler removal
 */

import { Vec3 } from 'vec3';
import type { Block } from 'prismarine-block';
import type { Entity } from 'prismarine-entity';
import type { Item } from 'prismarine-item';

/**
 * Event type definitions
 */
export interface EventTypes {
  // World events
  'block_place': { pos: Vec3; block: Block };
  'block_break': { pos: Vec3; oldBlock: Block };
  'block_update': { pos: Vec3; oldBlock: Block | null; newBlock: Block | null };

  // Chunk events
  'chunk_load': { x: number; z: number };
  'chunk_unload': { x: number; z: number };

  // Entity events
  'entity_spawn': { entity: Entity };
  'entity_despawn': { entity: Entity };
  'entity_move': { entity: Entity; oldPos: Vec3; newPos: Vec3 };
  'entity_damage': { entity: Entity; damage: number };

  // Player events
  'player_move': { pos: Vec3 };
  'player_health': { health: number; oldHealth: number };
  'player_food': { food: number; oldFood: number };
  'player_death': {};

  // Container events
  'container_open': { pos: Vec3 | null; windowId: number };
  'container_close': { windowId: number };
  'container_update': { windowId: number; slot: number; item: Item | null };

  // Task events
  'task_start': { taskName: string };
  'task_finish': { taskName: string; success: boolean };
  'chain_change': { oldChain: string | null; newChain: string };

  // Combat events
  'attack': { target: Entity };
  'hurt': { damage: number; attacker: Entity | null };

  // Custom events (for extensibility)
  'custom': { type: string; data: any };
}

/**
 * Event handler function type
 */
export type EventHandler<T extends keyof EventTypes> = (data: EventTypes[T]) => void;

/**
 * Handler entry with metadata
 */
interface HandlerEntry<T extends keyof EventTypes> {
  handler: EventHandler<T>;
  priority: number;
  once: boolean;
  id: number;
}

/**
 * Handler priorities
 */
export const HandlerPriority = {
  LOWEST: 0,
  LOW: 25,
  NORMAL: 50,
  HIGH: 75,
  HIGHEST: 100,
  MONITOR: 150, // For logging/debugging, runs last
} as const;

/**
 * EventBus - Centralized event system
 */
export class EventBus {
  private handlers: Map<string, HandlerEntry<any>[]> = new Map();
  private nextHandlerId: number = 0;

  /**
   * Subscribe to an event
   * @param event Event type
   * @param handler Handler function
   * @param priority Handler priority (higher runs first)
   * @returns Handler ID for removal
   */
  subscribe<T extends keyof EventTypes>(
    event: T,
    handler: EventHandler<T>,
    priority: number = HandlerPriority.NORMAL
  ): number {
    return this.addHandler(event, handler, priority, false);
  }

  /**
   * Subscribe to an event (one-time only)
   * @param event Event type
   * @param handler Handler function
   * @param priority Handler priority
   * @returns Handler ID
   */
  once<T extends keyof EventTypes>(
    event: T,
    handler: EventHandler<T>,
    priority: number = HandlerPriority.NORMAL
  ): number {
    return this.addHandler(event, handler, priority, true);
  }

  /**
   * Add a handler
   */
  private addHandler<T extends keyof EventTypes>(
    event: T,
    handler: EventHandler<T>,
    priority: number,
    once: boolean
  ): number {
    const id = this.nextHandlerId++;
    const entry: HandlerEntry<T> = { handler, priority, once, id };

    let handlers = this.handlers.get(event);
    if (!handlers) {
      handlers = [];
      this.handlers.set(event, handlers);
    }

    handlers.push(entry);

    // Sort by priority (highest first)
    handlers.sort((a, b) => b.priority - a.priority);

    return id;
  }

  /**
   * Unsubscribe a handler by ID
   */
  unsubscribe(handlerId: number): boolean {
    for (const [event, handlers] of this.handlers) {
      const index = handlers.findIndex(h => h.id === handlerId);
      if (index !== -1) {
        handlers.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Unsubscribe all handlers for an event
   */
  unsubscribeAll<T extends keyof EventTypes>(event: T): void {
    this.handlers.delete(event);
  }

  /**
   * Publish an event
   */
  publish<T extends keyof EventTypes>(event: T, data: EventTypes[T]): void {
    const handlers = this.handlers.get(event);
    if (!handlers) return;

    const toRemove: number[] = [];

    for (const entry of handlers) {
      try {
        entry.handler(data);
      } catch (err) {
        console.error(`Error in event handler for ${event}:`, err);
      }

      if (entry.once) {
        toRemove.push(entry.id);
      }
    }

    // Remove one-time handlers
    for (const id of toRemove) {
      const index = handlers.findIndex(h => h.id === id);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Check if event has handlers
   */
  hasHandlers<T extends keyof EventTypes>(event: T): boolean {
    const handlers = this.handlers.get(event);
    return handlers !== undefined && handlers.length > 0;
  }

  /**
   * Get handler count for event
   */
  getHandlerCount<T extends keyof EventTypes>(event: T): number {
    return this.handlers.get(event)?.length ?? 0;
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Get debug info
   */
  getDebugInfo(): string {
    const lines: string[] = ['EventBus:'];

    for (const [event, handlers] of this.handlers) {
      lines.push(`  ${event}: ${handlers.length} handlers`);
    }

    return lines.join('\n');
  }
}

/**
 * Create event listeners that bridge mineflayer events to EventBus
 */
export function createBotEventBridge(bot: any, eventBus: EventBus): void {
  // Block events
  bot.on('blockUpdate', (oldBlock: Block | null, newBlock: Block | null) => {
    const pos = newBlock?.position ?? oldBlock?.position;
    if (pos) {
      eventBus.publish('block_update', { pos, oldBlock, newBlock });

      if (newBlock && !oldBlock?.name) {
        eventBus.publish('block_place', { pos, block: newBlock });
      } else if (!newBlock?.name && oldBlock) {
        eventBus.publish('block_break', { pos, oldBlock });
      }
    }
  });

  // Chunk events
  bot.on('chunkColumnLoad', (point: { x: number; z: number }) => {
    eventBus.publish('chunk_load', point);
  });

  bot.on('chunkColumnUnload', (point: { x: number; z: number }) => {
    eventBus.publish('chunk_unload', point);
  });

  // Entity events
  bot.on('entitySpawn', (entity: Entity) => {
    eventBus.publish('entity_spawn', { entity });
  });

  bot.on('entityGone', (entity: Entity) => {
    eventBus.publish('entity_despawn', { entity });
  });

  bot.on('entityMoved', (entity: Entity) => {
    const oldPos = (entity as any).lastPosition ?? entity.position;
    eventBus.publish('entity_move', {
      entity,
      oldPos,
      newPos: entity.position,
    });
  });

  // Player events
  bot.on('move', () => {
    eventBus.publish('player_move', { pos: bot.entity.position });
  });

  bot.on('health', () => {
    const health = bot.health;
    const oldHealth = (bot as any)._lastHealth ?? health;
    (bot as any)._lastHealth = health;
    eventBus.publish('player_health', { health, oldHealth });
  });

  bot.on('food', () => {
    const food = bot.food;
    const oldFood = (bot as any)._lastFood ?? food;
    (bot as any)._lastFood = food;
    eventBus.publish('player_food', { food, oldFood });
  });

  bot.on('death', () => {
    eventBus.publish('player_death', {});
  });

  // Container events
  bot.on('windowOpen', (window: any) => {
    eventBus.publish('container_open', {
      pos: null, // Would need to track from blockInteract
      windowId: window.id,
    });
  });

  bot.on('windowClose', (window: any) => {
    eventBus.publish('container_close', { windowId: window.id });
  });
}

/**
 * Global event bus instance (optional, for convenience)
 */
let globalEventBus: EventBus | null = null;

/**
 * Get or create global event bus
 */
export function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

/**
 * Create a new event bus
 */
export function createEventBus(): EventBus {
  return new EventBus();
}
