import { Vec3 } from 'vec3';
import { BlockPos, MovementStatus, CalculationContext } from '../types';
import {
  BlockBreakHelper,
  BlockPlaceHelper,
  WaterBucketHelper,
  findReferenceBlock,
  canReachBlock,
  calculateLookRotation
} from '../core/BlockInteraction';

/**
 * MovementHelper provides shared functionality for movement execution
 * Based on Baritone's MovementHelper
 */
export class MovementHelper {
  private bot: any;
  private ctx: CalculationContext;

  readonly breakHelper: BlockBreakHelper;
  readonly placeHelper: BlockPlaceHelper;
  readonly waterBucketHelper: WaterBucketHelper;

  // Current operation state
  private currentBreakQueue: BlockPos[] = [];
  private currentPlaceQueue: BlockPos[] = [];
  private operationInProgress: boolean = false;

  constructor(bot: any, ctx: CalculationContext) {
    this.bot = bot;
    this.ctx = ctx;
    this.breakHelper = new BlockBreakHelper(bot);
    this.placeHelper = new BlockPlaceHelper(bot);
    this.waterBucketHelper = new WaterBucketHelper(bot);
  }

  /**
   * Set blocks to break for current movement
   */
  setToBreak(blocks: BlockPos[]): void {
    this.currentBreakQueue = [...blocks];
  }

  /**
   * Set blocks to place for current movement
   */
  setToPlace(blocks: BlockPos[]): void {
    this.currentPlaceQueue = [...blocks];
  }

  /**
   * Check if there are pending break operations
   */
  hasBlocksToBreak(): boolean {
    return this.currentBreakQueue.length > 0;
  }

  /**
   * Check if there are pending place operations
   */
  hasBlocksToPlace(): boolean {
    return this.currentPlaceQueue.length > 0;
  }

  /**
   * Process breaking queue
   * Returns SUCCESS when done, RUNNING while working, FAILED on error
   */
  async tickBreaking(): Promise<MovementStatus> {
    if (this.currentBreakQueue.length === 0) {
      return MovementStatus.SUCCESS;
    }

    // Get next block to break
    const target = this.currentBreakQueue[0];

    // Check if block is still there
    const block = this.bot.blockAt(new Vec3(target.x, target.y, target.z));
    if (!block || block.name === 'air') {
      this.currentBreakQueue.shift();
      return this.currentBreakQueue.length === 0 ? MovementStatus.SUCCESS : MovementStatus.RUNNING;
    }

    // Check if we can reach the block
    if (!canReachBlock(this.bot, target)) {
      // Move closer first
      return MovementStatus.PREPPING;
    }

    // Start breaking if not already
    if (!this.breakHelper.isBreaking()) {
      const started = await this.breakHelper.startBreaking(target, (b) => this.ctx.getBestTool(b));
      if (started) {
        // Block was already broken
        this.currentBreakQueue.shift();
        return this.currentBreakQueue.length === 0 ? MovementStatus.SUCCESS : MovementStatus.RUNNING;
      }
    }

    // Tick breaking
    const done = await this.breakHelper.tick();
    if (done) {
      this.currentBreakQueue.shift();
      return this.currentBreakQueue.length === 0 ? MovementStatus.SUCCESS : MovementStatus.RUNNING;
    }

    return MovementStatus.RUNNING;
  }

  /**
   * Process placing queue
   * Returns SUCCESS when done, RUNNING while working, FAILED on error
   */
  async tickPlacing(): Promise<MovementStatus> {
    if (this.currentPlaceQueue.length === 0) {
      return MovementStatus.SUCCESS;
    }

    // Get next block to place
    const target = this.currentPlaceQueue[0];

    // Check if block already placed
    const block = this.bot.blockAt(new Vec3(target.x, target.y, target.z));
    if (block && block.name !== 'air') {
      this.currentPlaceQueue.shift();
      return this.currentPlaceQueue.length === 0 ? MovementStatus.SUCCESS : MovementStatus.RUNNING;
    }

    // Find reference block
    const reference = findReferenceBlock(this.bot, target, (b) => b.boundingBox === 'block');
    if (!reference) {
      // Can't place here - no valid reference
      return MovementStatus.FAILED;
    }

    // Check if we can reach the reference
    if (!canReachBlock(this.bot, reference.reference)) {
      return MovementStatus.PREPPING;
    }

    // Start placing
    const getScaffold = () => {
      const scaffolds = ['dirt', 'cobblestone', 'netherrack', 'stone'];
      for (const name of scaffolds) {
        const item = this.bot.inventory.items().find((i: any) => i.name === name);
        if (item) return item;
      }
      return null;
    };

    const ready = await this.placeHelper.startPlacing(
      target,
      reference.reference,
      reference.faceVector,
      getScaffold
    );

    if (!ready) {
      return MovementStatus.FAILED; // No blocks to place
    }

    const done = await this.placeHelper.tick();
    if (done) {
      this.currentPlaceQueue.shift();
      return this.currentPlaceQueue.length === 0 ? MovementStatus.SUCCESS : MovementStatus.RUNNING;
    }

    return MovementStatus.RUNNING;
  }

  /**
   * Clear all pending operations
   */
  clear(): void {
    this.currentBreakQueue = [];
    this.currentPlaceQueue = [];
    this.breakHelper.cancel();
    this.placeHelper.cancel();
    this.waterBucketHelper.cancel();
  }

  /**
   * Move toward a position
   * Returns true if within tolerance
   */
  moveToward(
    dest: BlockPos,
    tolerance: number = 0.25,
    sprint: boolean = false,
    jump: boolean = false
  ): boolean {
    const pos = this.bot.entity.position;
    const dx = (dest.x + 0.5) - pos.x;
    const dz = (dest.z + 0.5) - pos.z;

    const distSq = dx * dx + dz * dz;
    if (distSq < tolerance * tolerance) {
      this.bot.clearControlStates();
      return true;
    }

    // Look toward destination
    const yaw = Math.atan2(-dx, -dz);
    this.bot.look(yaw, 0);

    // Set movement controls
    this.bot.setControlState('forward', true);
    this.bot.setControlState('sprint', sprint);
    this.bot.setControlState('jump', jump);

    return false;
  }

  /**
   * Check if at position (with tolerance)
   */
  isAtPosition(pos: BlockPos, tolerance: number = 0.35): boolean {
    const botPos = this.bot.entity.position;
    const dx = Math.abs(botPos.x - (pos.x + 0.5));
    const dy = Math.abs(botPos.y - pos.y);
    const dz = Math.abs(botPos.z - (pos.z + 0.5));

    return dx < tolerance && dz < tolerance && dy < 1;
  }

  /**
   * Check if the bot is on the ground
   */
  isOnGround(): boolean {
    return this.bot.entity.onGround;
  }

  /**
   * Check if the bot is in water
   */
  isInWater(): boolean {
    return this.bot.entity.isInWater;
  }

  /**
   * Prepare for water bucket cushioning
   */
  prepareWaterBucket(): boolean {
    return this.waterBucketHelper.activate();
  }

  /**
   * Tick water bucket during fall
   */
  async tickWaterBucket(targetY: number): Promise<void> {
    const pos = this.bot.entity.position;
    const vel = this.bot.entity.velocity;
    await this.waterBucketHelper.tick(pos.y, targetY, vel.y);
  }

  /**
   * Check if water bucket is active
   */
  isWaterBucketActive(): boolean {
    return this.waterBucketHelper.isActive();
  }

  /**
   * Stop all movement
   */
  stop(): void {
    this.bot.clearControlStates();
    this.clear();
  }
}

/**
 * Shared instance cache (one per bot)
 */
const helpers = new WeakMap<any, MovementHelper>();

/**
 * Get or create MovementHelper for a bot
 */
export function getMovementHelper(bot: any, ctx: CalculationContext): MovementHelper {
  let helper = helpers.get(bot);
  if (!helper) {
    helper = new MovementHelper(bot, ctx);
    helpers.set(bot, helper);
  }
  return helper;
}
