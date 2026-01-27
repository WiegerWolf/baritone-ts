import { Vec3 } from 'vec3';
import { BlockPos } from '../types';

/**
 * Block interaction helpers for breaking and placing blocks
 * Based on Baritone's BlockBreakHelper and BlockPlaceHelper
 */

/**
 * State for block breaking operations
 */
export interface BreakingState {
  target: BlockPos | null;
  started: boolean;
  ticksSinceStart: number;
  toolEquipped: boolean;
}

/**
 * State for block placing operations
 */
export interface PlacingState {
  target: BlockPos | null;
  referenceBlock: BlockPos | null;
  faceVector: Vec3 | null;
  started: boolean;
  sneaking: boolean;
}

/**
 * State for water bucket operations
 */
export interface WaterBucketState {
  active: boolean;
  placedWaterAt: BlockPos | null;
  needsPickup: boolean;
}

/**
 * BlockBreakHelper manages block breaking with proper tool selection and timing
 */
export class BlockBreakHelper {
  private bot: any;
  private state: BreakingState = {
    target: null,
    started: false,
    ticksSinceStart: 0,
    toolEquipped: false
  };
  private breaking: boolean = false;

  constructor(bot: any) {
    this.bot = bot;
  }

  /**
   * Start breaking a block
   */
  async startBreaking(pos: BlockPos, getBestTool: (block: any) => any): Promise<boolean> {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block || block.name === 'air') {
      return true; // Already broken
    }

    this.state.target = pos;
    this.state.started = false;
    this.state.ticksSinceStart = 0;
    this.state.toolEquipped = false;

    // Equip best tool
    const tool = getBestTool(block);
    if (tool) {
      try {
        await this.bot.equip(tool, 'hand');
        this.state.toolEquipped = true;
      } catch (e) {
        // Continue without optimal tool
      }
    } else {
      this.state.toolEquipped = true;
    }

    return false;
  }

  /**
   * Tick the block breaking process
   * Returns true when breaking is complete
   */
  async tick(): Promise<boolean> {
    if (!this.state.target) return true;

    const pos = this.state.target;
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));

    // Block already broken
    if (!block || block.name === 'air') {
      this.state.target = null;
      this.breaking = false;
      return true;
    }

    // Start breaking if not started
    if (!this.state.started && this.state.toolEquipped) {
      // Look at block
      const blockCenter = new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
      await this.bot.lookAt(blockCenter);

      // Start digging
      try {
        this.breaking = true;
        await this.bot.dig(block, true); // forceLook = true
        this.breaking = false;
        this.state.target = null;
        return true;
      } catch (e) {
        this.breaking = false;
        this.state.target = null;
        return true; // Consider it done on error
      }
    }

    this.state.ticksSinceStart++;
    return false;
  }

  /**
   * Check if currently breaking
   */
  isBreaking(): boolean {
    return this.breaking;
  }

  /**
   * Cancel current breaking operation
   */
  cancel(): void {
    if (this.breaking) {
      try {
        this.bot.stopDigging();
      } catch (e) {
        // Ignore errors
      }
    }
    this.breaking = false;
    this.state.target = null;
  }
}

/**
 * BlockPlaceHelper manages block placement with proper positioning
 */
export class BlockPlaceHelper {
  private bot: any;
  private state: PlacingState = {
    target: null,
    referenceBlock: null,
    faceVector: null,
    started: false,
    sneaking: false
  };

  constructor(bot: any) {
    this.bot = bot;
  }

  /**
   * Start placing a block
   * @param targetPos Where to place the block
   * @param referencePos The block to place against
   * @param faceVector Direction from reference to target
   * @param getScaffoldItem Function to get a placeable block from inventory
   */
  async startPlacing(
    targetPos: BlockPos,
    referencePos: BlockPos,
    faceVector: Vec3,
    getScaffoldItem: () => any
  ): Promise<boolean> {
    const item = getScaffoldItem();
    if (!item) {
      return false; // No blocks to place
    }

    this.state.target = targetPos;
    this.state.referenceBlock = referencePos;
    this.state.faceVector = faceVector;
    this.state.started = false;
    this.state.sneaking = false;

    // Equip block
    try {
      await this.bot.equip(item, 'hand');
    } catch (e) {
      return false;
    }

    return true;
  }

  /**
   * Tick the block placing process
   * Returns true when placing is complete
   */
  async tick(): Promise<boolean> {
    if (!this.state.target || !this.state.referenceBlock || !this.state.faceVector) {
      return true;
    }

    const refPos = this.state.referenceBlock;
    const refBlock = this.bot.blockAt(new Vec3(refPos.x, refPos.y, refPos.z));

    if (!refBlock) {
      this.state.target = null;
      return true;
    }

    // Check if block already placed
    const targetPos = this.state.target;
    const targetBlock = this.bot.blockAt(new Vec3(targetPos.x, targetPos.y, targetPos.z));
    if (targetBlock && targetBlock.name !== 'air') {
      this.stopSneaking();
      this.state.target = null;
      return true;
    }

    if (!this.state.started) {
      // Start sneaking to prevent accidental interactions
      this.bot.setControlState('sneak', true);
      this.state.sneaking = true;

      // Look at placement point
      const placePoint = new Vec3(
        refPos.x + 0.5 + this.state.faceVector.x * 0.5,
        refPos.y + 0.5 + this.state.faceVector.y * 0.5,
        refPos.z + 0.5 + this.state.faceVector.z * 0.5
      );
      await this.bot.lookAt(placePoint);

      // Place block
      try {
        await this.bot.placeBlock(refBlock, this.state.faceVector);
        this.stopSneaking();
        this.state.target = null;
        return true;
      } catch (e) {
        this.stopSneaking();
        this.state.target = null;
        return true;
      }
    }

    return false;
  }

  private stopSneaking(): void {
    if (this.state.sneaking) {
      this.bot.setControlState('sneak', false);
      this.state.sneaking = false;
    }
  }

  /**
   * Cancel current placing operation
   */
  cancel(): void {
    this.stopSneaking();
    this.state.target = null;
  }
}

/**
 * WaterBucketHelper manages water bucket placement for fall cushioning
 */
export class WaterBucketHelper {
  private bot: any;
  private state: WaterBucketState = {
    active: false,
    placedWaterAt: null,
    needsPickup: false
  };

  constructor(bot: any) {
    this.bot = bot;
  }

  /**
   * Check if we have a water bucket
   */
  hasWaterBucket(): boolean {
    const items = this.bot.inventory.items();
    return items.some((item: any) => item.name === 'water_bucket');
  }

  /**
   * Check if we have an empty bucket
   */
  hasEmptyBucket(): boolean {
    const items = this.bot.inventory.items();
    return items.some((item: any) => item.name === 'bucket');
  }

  /**
   * Get water bucket from inventory
   */
  getWaterBucket(): any {
    const items = this.bot.inventory.items();
    return items.find((item: any) => item.name === 'water_bucket');
  }

  /**
   * Get empty bucket from inventory
   */
  getEmptyBucket(): any {
    const items = this.bot.inventory.items();
    return items.find((item: any) => item.name === 'bucket');
  }

  /**
   * Activate water bucket cushioning for a fall
   * Call this when starting a high fall
   */
  activate(): boolean {
    if (!this.hasWaterBucket()) return false;

    this.state.active = true;
    this.state.placedWaterAt = null;
    this.state.needsPickup = false;
    return true;
  }

  /**
   * Tick the water bucket cushioning
   * Should be called while falling
   * @param currentY Current Y position
   * @param targetY Target landing Y position
   * @param velocity Current Y velocity (negative when falling)
   */
  async tick(currentY: number, targetY: number, velocity: number): Promise<void> {
    if (!this.state.active) return;

    const heightAboveGround = currentY - targetY;
    const timeToLand = velocity !== 0 ? heightAboveGround / Math.abs(velocity) : Infinity;

    // Place water when close to ground (within 3 blocks or ~0.5 seconds)
    if (heightAboveGround <= 3 || timeToLand <= 10) {
      if (!this.state.placedWaterAt) {
        await this.placeWater(targetY);
      }
    }

    // Pick up water after landing
    if (this.state.needsPickup && this.bot.entity.onGround) {
      // Wait a moment for water to settle
      setTimeout(() => this.pickupWater(), 100);
    }
  }

  /**
   * Place water at feet level
   */
  private async placeWater(targetY: number): Promise<void> {
    const bucket = this.getWaterBucket();
    if (!bucket) return;

    try {
      await this.bot.equip(bucket, 'hand');

      // Look straight down
      await this.bot.look(this.bot.entity.yaw, Math.PI / 2);

      // Place water
      const pos = this.bot.entity.position;
      const targetPos = new BlockPos(
        Math.floor(pos.x),
        Math.floor(targetY),
        Math.floor(pos.z)
      );

      // Activate item (place water)
      await this.bot.activateItem();

      this.state.placedWaterAt = targetPos;
      this.state.needsPickup = true;
    } catch (e) {
      // Failed to place water
    }
  }

  /**
   * Pick up the placed water
   */
  private async pickupWater(): Promise<void> {
    if (!this.state.placedWaterAt) return;

    const bucket = this.getEmptyBucket();
    if (!bucket) {
      this.state.active = false;
      return;
    }

    try {
      await this.bot.equip(bucket, 'hand');

      // Look at water
      const waterPos = this.state.placedWaterAt;
      const waterBlock = this.bot.blockAt(new Vec3(waterPos.x, waterPos.y, waterPos.z));

      if (waterBlock && (waterBlock.name === 'water' || waterBlock.name === 'flowing_water')) {
        await this.bot.lookAt(new Vec3(waterPos.x + 0.5, waterPos.y + 0.5, waterPos.z + 0.5));
        await this.bot.activateItem();
      }
    } catch (e) {
      // Failed to pick up water
    }

    this.state.active = false;
    this.state.placedWaterAt = null;
    this.state.needsPickup = false;
  }

  /**
   * Check if water bucket cushioning is active
   */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Cancel water bucket operation
   */
  cancel(): void {
    this.state.active = false;
    this.state.needsPickup = false;
  }
}

/**
 * Calculate the face vector from reference block to target
 */
export function calculateFaceVector(reference: BlockPos, target: BlockPos): Vec3 {
  return new Vec3(
    Math.sign(target.x - reference.x),
    Math.sign(target.y - reference.y),
    Math.sign(target.z - reference.z)
  );
}

/**
 * Find a suitable reference block for placing at target position
 * Returns null if no valid reference found
 */
export function findReferenceBlock(
  bot: any,
  target: BlockPos,
  canUseBlock: (block: any) => boolean
): { reference: BlockPos; faceVector: Vec3 } | null {
  // Check all 6 adjacent positions
  const offsets = [
    { dx: 0, dy: -1, dz: 0 },  // Below
    { dx: 0, dy: 1, dz: 0 },   // Above
    { dx: -1, dy: 0, dz: 0 },  // West
    { dx: 1, dy: 0, dz: 0 },   // East
    { dx: 0, dy: 0, dz: -1 },  // North
    { dx: 0, dy: 0, dz: 1 }    // South
  ];

  for (const offset of offsets) {
    const refX = target.x + offset.dx;
    const refY = target.y + offset.dy;
    const refZ = target.z + offset.dz;

    const block = bot.blockAt(new Vec3(refX, refY, refZ));
    if (block && canUseBlock(block)) {
      return {
        reference: new BlockPos(refX, refY, refZ),
        faceVector: new Vec3(-offset.dx, -offset.dy, -offset.dz)
      };
    }
  }

  return null;
}

/**
 * Check if player can reach a block for interaction
 */
export function canReachBlock(bot: any, pos: BlockPos, maxReach: number = 4.5): boolean {
  const playerPos = bot.entity.position;
  const blockCenter = new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
  const distance = playerPos.distanceTo(blockCenter);
  return distance <= maxReach;
}

/**
 * Calculate rotation needed to look at a block
 */
export function calculateLookRotation(
  playerPos: Vec3,
  targetPos: Vec3
): { yaw: number; pitch: number } {
  const dx = targetPos.x - playerPos.x;
  const dy = targetPos.y - (playerPos.y + 1.62); // Eye height
  const dz = targetPos.z - playerPos.z;

  const yaw = Math.atan2(-dx, -dz);
  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  const pitch = Math.atan2(-dy, horizontalDist);

  return { yaw, pitch };
}
