/**
 * PlayerExtraController - Extended Player Actions
 * Based on AltoClef/BaritonePlus PlayerExtraController.java
 *
 * Provides extended player actions beyond basic movement:
 * - Block breaking tracking
 * - Entity attacks
 * - Range checking
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { EventBus, getGlobalEventBus } from '../events/EventBus';

/**
 * Block position type
 */
export interface BlockPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Block breaking event data
 */
export interface BlockBreakingEventData {
  blockPos: BlockPosition;
  progress: number;
}

/**
 * PlayerExtraController manages extended player actions
 */
export class PlayerExtraController {
  private bot: Bot;
  private eventBus: EventBus;

  /**
   * Current block being broken
   */
  private blockBreakPos: BlockPosition | null = null;

  /**
   * Progress of current block break (0-1)
   */
  private blockBreakProgress: number = 0;

  /**
   * Default entity reach range
   */
  private entityReachRange: number = 4.0;

  constructor(bot: Bot, eventBus?: EventBus) {
    this.bot = bot;
    this.eventBus = eventBus ?? getGlobalEventBus();

    // Subscribe to block breaking events via custom events
    this.eventBus.subscribe('custom', (data) => {
      if (data.type === 'blockBreaking') {
        const breakData = data.data as BlockBreakingEventData;
        this.onBlockBreak(breakData.blockPos, breakData.progress);
      } else if (data.type === 'blockBreakingCancel') {
        this.onBlockStopBreaking();
      }
    });

    // Also listen to mineflayer dig events
    this.bot.on('diggingCompleted', (block) => {
      this.onBlockStopBreaking();
    });

    this.bot.on('diggingAborted', (block) => {
      this.onBlockStopBreaking();
    });
  }

  /**
   * Set the entity reach range
   */
  setEntityReachRange(range: number): void {
    this.entityReachRange = range;
  }

  /**
   * Get the entity reach range
   */
  getEntityReachRange(): number {
    return this.entityReachRange;
  }

  /**
   * Called when block breaking starts/continues
   */
  private onBlockBreak(pos: BlockPosition, progress: number): void {
    this.blockBreakPos = pos;
    this.blockBreakProgress = progress;
  }

  /**
   * Called when block breaking stops
   */
  private onBlockStopBreaking(): void {
    this.blockBreakPos = null;
    this.blockBreakProgress = 0;
  }

  /**
   * Get the position of the block currently being broken
   */
  getBreakingBlockPos(): BlockPosition | null {
    return this.blockBreakPos;
  }

  /**
   * Check if currently breaking a block
   */
  isBreakingBlock(): boolean {
    return this.blockBreakPos !== null;
  }

  /**
   * Get the progress of the current block break (0-1)
   */
  getBreakingBlockProgress(): number {
    return this.blockBreakProgress;
  }

  /**
   * Check if an entity is within reach range
   */
  inRange(entity: Entity): boolean {
    if (!this.bot.entity) return false;
    const distance = this.bot.entity.position.distanceTo(entity.position);
    return distance <= this.entityReachRange;
  }

  /**
   * Check if a position is within reach range
   */
  inRangeOf(pos: Vec3 | BlockPosition): boolean {
    if (!this.bot.entity) return false;
    const target = pos instanceof Vec3 ? pos : new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
    const distance = this.bot.entity.position.distanceTo(target);
    return distance <= this.entityReachRange;
  }

  /**
   * Attack an entity if in range
   */
  attack(entity: Entity): boolean {
    if (!this.inRange(entity)) {
      return false;
    }

    try {
      this.bot.attack(entity);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Use the held item on an entity
   */
  useOnEntity(entity: Entity): boolean {
    if (!this.inRange(entity)) {
      return false;
    }

    try {
      this.bot.useOn(entity);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Use the held item on a block
   */
  async useOnBlock(pos: BlockPosition, faceVector?: Vec3): Promise<boolean> {
    if (!this.inRangeOf(pos)) {
      return false;
    }

    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block) {
      return false;
    }

    try {
      await this.bot.activateBlock(block, faceVector);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Swing the player's hand
   */
  swingArm(hand: 'main' | 'off' = 'main'): void {
    this.bot.swingArm(hand === 'main' ? 'right' : 'left');
  }

  /**
   * Start breaking a block
   */
  async startDigging(pos: BlockPosition): Promise<void> {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block) {
      throw new Error('No block at position');
    }

    this.blockBreakPos = pos;
    this.blockBreakProgress = 0;

    try {
      await this.bot.dig(block, true);
      this.eventBus.publish('custom', { type: 'blockBroken', data: { blockPos: pos } });
    } finally {
      this.onBlockStopBreaking();
    }
  }

  /**
   * Stop breaking the current block
   */
  stopDigging(): void {
    this.bot.stopDigging();
    this.onBlockStopBreaking();
  }

  /**
   * Get the player's current position
   */
  getPosition(): Vec3 | null {
    return this.bot.entity?.position ?? null;
  }

  /**
   * Get the player's current eye position
   */
  getEyePosition(): Vec3 | null {
    const pos = this.getPosition();
    if (!pos) return null;
    const eyeHeight = this.bot.entity?.height ?? 1.62;
    return pos.offset(0, eyeHeight, 0);
  }

  /**
   * Get the player's current look direction as a vector
   */
  getLookDirection(): Vec3 | null {
    if (!this.bot.entity) return null;
    const yaw = this.bot.entity.yaw;
    const pitch = this.bot.entity.pitch;

    // Convert yaw/pitch to direction vector
    const x = -Math.sin(yaw) * Math.cos(pitch);
    const y = -Math.sin(pitch);
    const z = Math.cos(yaw) * Math.cos(pitch);

    return new Vec3(x, y, z);
  }

  /**
   * Get the player's health
   */
  getHealth(): number {
    return this.bot.health ?? 20;
  }

  /**
   * Get the player's food level
   */
  getFood(): number {
    return this.bot.food ?? 20;
  }

  /**
   * Check if player is on ground
   */
  isOnGround(): boolean {
    return this.bot.entity?.onGround ?? false;
  }

  /**
   * Check if player is in water
   */
  isInWater(): boolean {
    return (this.bot.entity as any)?.isInWater ?? false;
  }

  /**
   * Check if player is in lava
   */
  isInLava(): boolean {
    return (this.bot.entity as any)?.isInLava ?? false;
  }

  /**
   * Check if player is sneaking
   */
  isSneaking(): boolean {
    return this.bot.controlState.sneak;
  }

  /**
   * Check if player is sprinting
   */
  isSprinting(): boolean {
    return this.bot.controlState.sprint;
  }
}

/**
 * Create a PlayerExtraController for a bot
 */
export function createPlayerExtraController(bot: Bot, eventBus?: EventBus): PlayerExtraController {
  return new PlayerExtraController(bot, eventBus);
}

export default PlayerExtraController;
