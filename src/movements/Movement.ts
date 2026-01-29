import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import { MovementHelper, getMovementHelper } from './MovementHelper';
import { MovementState } from './MovementState';

export { MovementState } from './MovementState';

/**
 * Base class for all movement types
 * Each movement handles its own cost calculation and execution
 */
export abstract class Movement {
  readonly src: BlockPos;
  readonly dest: BlockPos;

  // Blocks to break/place for this movement
  protected toBreak: BlockPos[] = [];
  protected toPlace: BlockPos[] = [];

  // Execution state
  protected state: MovementState = MovementState.NOT_STARTED;
  protected ticksOnCurrent: number = 0;

  // Helper instance (set during execution)
  protected helper: MovementHelper | null = null;

  // Fall override - allows fall to continue into this movement
  public canAcceptFallOverride: boolean = false;
  public fallOverrideActive: boolean = false;

  constructor(src: BlockPos, dest: BlockPos) {
    this.src = src;
    this.dest = dest;
  }

  /**
   * Initialize helper for execution
   */
  initHelper(bot: any, ctx: CalculationContext): void {
    this.helper = getMovementHelper(bot, ctx);
  }

  /**
   * Calculate the cost of this movement
   * Returns COST_INF if movement is impossible
   */
  abstract calculateCost(ctx: CalculationContext): number;

  /**
   * Execute one tick of movement
   */
  abstract tick(ctx: CalculationContext, bot: any): MovementStatus;

  /**
   * Reset execution state
   */
  reset(): void {
    this.state = MovementState.NOT_STARTED;
    this.ticksOnCurrent = 0;
    this.fallOverrideActive = false;
    if (this.helper) {
      this.helper.clear();
    }
  }

  /**
   * Start movement with fall override (bot is already falling toward this movement)
   */
  startWithFallOverride(): void {
    this.fallOverrideActive = true;
    this.state = MovementState.WAITING; // Skip to waiting for landing
  }

  /**
   * Check if this movement can accept a fall override from a previous movement
   */
  canAcceptFall(): boolean {
    return this.canAcceptFallOverride;
  }

  /**
   * Common execution for breaking blocks
   * Returns true when breaking is complete
   */
  protected async tickBreaking(): Promise<boolean> {
    if (!this.helper) return true;

    if (!this.helper.hasBlocksToBreak()) {
      // Initialize break queue if not done
      if (this.toBreak.length > 0) {
        this.helper.setToBreak(this.toBreak);
      } else {
        return true;
      }
    }

    const status = await this.helper.tickBreaking();
    return status === MovementStatus.SUCCESS;
  }

  /**
   * Common execution for placing blocks
   * Returns true when placing is complete
   */
  protected async tickPlacing(): Promise<boolean> {
    if (!this.helper) return true;

    if (!this.helper.hasBlocksToPlace()) {
      // Initialize place queue if not done
      if (this.toPlace.length > 0) {
        this.helper.setToPlace(this.toPlace);
      } else {
        return true;
      }
    }

    const status = await this.helper.tickPlacing();
    if (status === MovementStatus.FAILED) {
      return true; // Failed but still "complete" - will be handled by movement
    }
    return status === MovementStatus.SUCCESS;
  }

  /**
   * Get blocks that need to be broken
   */
  getToBreak(): BlockPos[] {
    return [...this.toBreak];
  }

  /**
   * Get blocks that need to be placed
   */
  getToPlace(): BlockPos[] {
    return [...this.toPlace];
  }

  /**
   * Get all valid positions during this movement
   */
  getValidPositions(): BlockPos[] {
    return [this.src, this.dest];
  }

  /**
   * Helper: Calculate mining cost for a block
   */
  protected getMiningCost(ctx: CalculationContext, pos: BlockPos): number {
    const block = ctx.getBlock(pos.x, pos.y, pos.z);
    if (!block) return COST_INF;
    return ctx.getBreakTime(block);
  }

  /**
   * Helper: Check if block is passable
   */
  protected isPassable(ctx: CalculationContext, x: number, y: number, z: number): boolean {
    const block = ctx.getBlock(x, y, z);
    return ctx.canWalkThrough(block);
  }

  /**
   * Helper: Check if block is solid for standing
   */
  protected isSolid(ctx: CalculationContext, x: number, y: number, z: number): boolean {
    const block = ctx.getBlock(x, y, z);
    return ctx.canWalkOn(block);
  }

  /**
   * Helper: Calculate cost to break obstacles
   */
  protected getObstacleCost(ctx: CalculationContext, positions: BlockPos[]): number {
    let cost = 0;

    for (const pos of positions) {
      if (!this.isPassable(ctx, pos.x, pos.y, pos.z)) {
        if (!ctx.canDig) return COST_INF;

        const miningCost = this.getMiningCost(ctx, pos);
        if (miningCost >= COST_INF) return COST_INF;

        cost += miningCost;
        this.toBreak.push(pos);
      }
    }

    return cost;
  }
}

// Note: Movement subclasses are exported from index.ts to avoid circular dependencies
