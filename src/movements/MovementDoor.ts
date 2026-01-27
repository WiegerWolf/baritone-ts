import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { Movement, MovementState } from './Movement';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';
import { getMovementHelper } from './MovementHelper';

/**
 * MovementDoor handles movement through doors and fence gates
 * Based on Baritone's door handling
 *
 * Features:
 * - Open doors automatically
 * - Close doors behind (optional)
 * - Fence gate support
 * - Trapdoor support
 */

// Cost to interact with a door/gate (ticks)
const DOOR_OPEN_COST = 2.0;

// Door block names
const DOOR_BLOCKS = new Set([
  'oak_door', 'spruce_door', 'birch_door', 'jungle_door',
  'acacia_door', 'dark_oak_door', 'mangrove_door', 'cherry_door',
  'bamboo_door', 'crimson_door', 'warped_door',
  'iron_door' // Needs redstone, handled separately
]);

// Fence gate block names
const FENCE_GATE_BLOCKS = new Set([
  'oak_fence_gate', 'spruce_fence_gate', 'birch_fence_gate', 'jungle_fence_gate',
  'acacia_fence_gate', 'dark_oak_fence_gate', 'mangrove_fence_gate', 'cherry_fence_gate',
  'bamboo_fence_gate', 'crimson_fence_gate', 'warped_fence_gate'
]);

// Trapdoor block names
const TRAPDOOR_BLOCKS = new Set([
  'oak_trapdoor', 'spruce_trapdoor', 'birch_trapdoor', 'jungle_trapdoor',
  'acacia_trapdoor', 'dark_oak_trapdoor', 'mangrove_trapdoor', 'cherry_trapdoor',
  'bamboo_trapdoor', 'crimson_trapdoor', 'warped_trapdoor',
  'iron_trapdoor' // Needs redstone
]);

/**
 * Check if a block is a door
 */
export function isDoor(blockName: string): boolean {
  return DOOR_BLOCKS.has(blockName);
}

/**
 * Check if a block is a fence gate
 */
export function isFenceGate(blockName: string): boolean {
  return FENCE_GATE_BLOCKS.has(blockName);
}

/**
 * Check if a block is a trapdoor
 */
export function isTrapdoor(blockName: string): boolean {
  return TRAPDOOR_BLOCKS.has(blockName);
}

/**
 * Check if a block is any openable barrier
 */
export function isOpenable(blockName: string): boolean {
  return isDoor(blockName) || isFenceGate(blockName) || isTrapdoor(blockName);
}

/**
 * Check if a door/gate requires redstone
 */
export function requiresRedstone(blockName: string): boolean {
  return blockName === 'iron_door' || blockName === 'iron_trapdoor';
}

/**
 * MovementThroughDoor: Walk through a door (opening it if needed)
 */
export class MovementThroughDoor extends Movement {
  private doorOpened: boolean = false;
  private doorPos: BlockPos | null = null;

  constructor(src: BlockPos, dest: BlockPos, doorPos?: BlockPos) {
    super(src, dest);
    this.doorPos = doorPos || null;
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check destination floor
    const floor = ctx.getBlock(dest.x, dest.y - 1, dest.z);
    if (!ctx.canWalkOn(floor)) {
      return COST_INF;
    }

    // Find the door between src and dest
    const doorBlock = this.findDoorBetween(ctx, src, dest);
    if (!doorBlock) {
      // No door found, can't use this movement
      return COST_INF;
    }

    // Check if iron door (needs redstone)
    if (requiresRedstone(doorBlock.name)) {
      // Can't open iron doors without redstone
      return COST_INF;
    }

    // Store door position for later
    this.doorPos = new BlockPos(doorBlock.position.x, doorBlock.position.y, doorBlock.position.z);

    // Cost: walk + door open
    return WALK_ONE_BLOCK_COST + DOOR_OPEN_COST;
  }

  /**
   * Find a door between source and destination
   */
  private findDoorBetween(ctx: CalculationContext, src: BlockPos, dest: BlockPos): any | null {
    // Check at dest feet level
    const destBlock = ctx.getBlock(dest.x, dest.y, dest.z);
    if (destBlock && isOpenable(destBlock.name)) {
      return destBlock;
    }

    // Check at dest head level
    const destHead = ctx.getBlock(dest.x, dest.y + 1, dest.z);
    if (destHead && isOpenable(destHead.name)) {
      return destHead;
    }

    // Check at src feet level
    const srcBlock = ctx.getBlock(src.x, src.y, src.z);
    if (srcBlock && isOpenable(srcBlock.name)) {
      return srcBlock;
    }

    // Check at src head level
    const srcHead = ctx.getBlock(src.x, src.y + 1, src.z);
    if (srcHead && isOpenable(srcHead.name)) {
      return srcHead;
    }

    return null;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    switch (this.state) {
      case MovementState.NOT_STARTED:
        this.state = MovementState.BREAKING; // Reuse as "opening" state
        return MovementStatus.PREPPING;

      case MovementState.BREAKING: // Opening door
        if (this.doorPos && !this.doorOpened) {
          const doorBlock = bot.blockAt({
            x: this.doorPos.x,
            y: this.doorPos.y,
            z: this.doorPos.z
          });

          if (doorBlock && isOpenable(doorBlock.name)) {
            // Check if already open
            const isOpen = doorBlock.getProperties?.()?.open === 'true' ||
                          doorBlock.getProperties?.()?.open === true;

            if (!isOpen) {
              // Open the door
              bot.activateBlock(doorBlock).then(() => {
                this.doorOpened = true;
                this.state = MovementState.MOVING;
              }).catch(() => {
                // Failed to open, try to move anyway
                this.state = MovementState.MOVING;
              });
              return MovementStatus.RUNNING;
            }
          }
          this.doorOpened = true;
        }
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        // Check if we've reached destination
        if (this.helper!.isAtPosition(this.dest)) {
          this.state = MovementState.FINISHED;
          return MovementStatus.SUCCESS;
        }

        // Move toward destination
        this.helper!.moveToward(this.dest, 0.25, false, false);
        return MovementStatus.RUNNING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }

  reset(): void {
    super.reset();
    this.doorOpened = false;
  }
}

/**
 * MovementThroughFenceGate: Walk through a fence gate
 */
export class MovementThroughFenceGate extends MovementThroughDoor {
  // Inherits all behavior from MovementThroughDoor
  // Fence gates work the same way
}

/**
 * MovementThroughTrapdoor: Move through a trapdoor (vertical movement)
 */
export class MovementThroughTrapdoor extends Movement {
  private trapdoorOpened: boolean = false;
  private direction: 'up' | 'down';

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.direction = dest.y > src.y ? 'up' : 'down';
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Find trapdoor position
    const trapdoorY = this.direction === 'up' ? src.y + 1 : src.y;
    const trapdoorBlock = ctx.getBlock(src.x, trapdoorY, src.z);

    if (!trapdoorBlock || !isTrapdoor(trapdoorBlock.name)) {
      return COST_INF;
    }

    // Check if iron trapdoor
    if (requiresRedstone(trapdoorBlock.name)) {
      return COST_INF;
    }

    // Check destination is valid
    if (this.direction === 'up') {
      const destHead = ctx.getBlock(dest.x, dest.y + 1, dest.z);
      if (!ctx.canWalkThrough(destHead)) {
        return COST_INF;
      }
    } else {
      const destFloor = ctx.getBlock(dest.x, dest.y - 1, dest.z);
      if (!ctx.canWalkOn(destFloor)) {
        return COST_INF;
      }
    }

    // Cost: movement + trapdoor interaction
    return (this.direction === 'up' ? 8.0 : 4.0) + DOOR_OPEN_COST;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    switch (this.state) {
      case MovementState.NOT_STARTED:
        this.state = MovementState.BREAKING;
        return MovementStatus.PREPPING;

      case MovementState.BREAKING:
        if (!this.trapdoorOpened) {
          const trapdoorY = this.direction === 'up' ? this.src.y + 1 : this.src.y;
          const trapdoorBlock = bot.blockAt({
            x: this.src.x,
            y: trapdoorY,
            z: this.src.z
          });

          if (trapdoorBlock && isTrapdoor(trapdoorBlock.name)) {
            const isOpen = trapdoorBlock.getProperties?.()?.open === 'true' ||
                          trapdoorBlock.getProperties?.()?.open === true;

            if (!isOpen) {
              bot.activateBlock(trapdoorBlock).then(() => {
                this.trapdoorOpened = true;
                this.state = MovementState.MOVING;
              }).catch(() => {
                this.state = MovementState.MOVING;
              });
              return MovementStatus.RUNNING;
            }
          }
          this.trapdoorOpened = true;
        }
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        if (this.helper!.isAtPosition(this.dest, 0.4)) {
          return MovementStatus.SUCCESS;
        }

        if (this.direction === 'up') {
          bot.setControlState('jump', true);
        }

        this.helper!.moveToward(this.dest, 0.3, false, false);
        return MovementStatus.RUNNING;

      default:
        return MovementStatus.FAILED;
    }
  }

  reset(): void {
    super.reset();
    this.trapdoorOpened = false;
  }
}
