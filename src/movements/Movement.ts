import { BlockPos, CalculationContext, MovementStatus, COST_INF } from '../types';
import {
  WALK_ONE_BLOCK_COST,
  SPRINT_ONE_BLOCK_COST,
  SPRINT_MULTIPLIER,
  SNEAK_ONE_BLOCK_COST,
  WALK_ONE_IN_WATER_COST,
  WALK_ONE_OVER_SOUL_SAND_COST,
  LADDER_UP_ONE_COST,
  LADDER_DOWN_ONE_COST,
  JUMP_ONE_BLOCK_COST,
  WALK_OFF_BLOCK_COST,
  CENTER_AFTER_FALL_COST,
  SQRT_2,
  getFallCost,
  PLACE_ONE_BLOCK_COST,
  BACKPLACE_ADDITIONAL_PENALTY
} from '../core/ActionCosts';
import { MovementHelper, getMovementHelper } from './MovementHelper';

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

/**
 * Movement execution state
 */
export enum MovementState {
  NOT_STARTED,
  BREAKING,
  PLACING,
  MOVING,
  WAITING,
  FINISHED
}

/**
 * MovementTraverse: Horizontal movement on same Y level
 */
export class MovementTraverse extends Movement {
  private readonly direction: { dx: number; dz: number };

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.direction = {
      dx: dest.x - src.x,
      dz: dest.z - src.z
    };
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check destination floor
    if (!this.isSolid(ctx, dest.x, dest.y - 1, dest.z)) {
      // Need to place a block (bridging)
      if (!ctx.canPlace) return COST_INF;

      // Calculate placement cost
      const placeCost = PLACE_ONE_BLOCK_COST;
      const needBackplace = !this.isSolid(ctx, src.x, src.y - 1, src.z + this.direction.dz) &&
                           !this.isSolid(ctx, src.x + this.direction.dx, src.y - 1, src.z);
      const backplacePenalty = needBackplace ? BACKPLACE_ADDITIONAL_PENALTY : 0;

      this.toPlace.push(dest.offset(0, -1, 0));

      // Can't sprint while bridging
      const walkCost = WALK_ONE_BLOCK_COST + placeCost + backplacePenalty;
      return walkCost * ctx.getFavoring(dest.x, dest.y, dest.z);
    }

    // Check body space
    const obstacleCost = this.getObstacleCost(ctx, [
      dest.offset(0, 0, 0),  // Feet level
      dest.offset(0, 1, 0)   // Head level
    ]);
    if (obstacleCost >= COST_INF) return COST_INF;

    // Calculate base cost
    let cost = WALK_ONE_BLOCK_COST + obstacleCost;

    // Apply terrain modifiers
    const floor = ctx.getBlock(dest.x, dest.y - 1, dest.z);
    if (floor?.name === 'soul_sand' || floor?.name === 'soul_soil') {
      cost = WALK_ONE_OVER_SOUL_SAND_COST + obstacleCost;
    } else if (floor?.name === 'magma_block') {
      cost = SNEAK_ONE_BLOCK_COST + obstacleCost;
    }

    // Check for water
    const bodyBlock = ctx.getBlock(dest.x, dest.y, dest.z);
    if (ctx.isWater(bodyBlock)) {
      cost = WALK_ONE_IN_WATER_COST + obstacleCost;
    }

    // Apply sprint if no obstacles and allowed
    if (obstacleCost === 0 && ctx.allowSprint && !ctx.isWater(bodyBlock)) {
      cost *= SPRINT_MULTIPLIER;
    }

    return cost * ctx.getFavoring(dest.x, dest.y, dest.z);
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    switch (this.state) {
      case MovementState.NOT_STARTED:
        // Check if we need to break blocks
        if (this.toBreak.length > 0) {
          this.helper!.setToBreak(this.toBreak);
          this.state = MovementState.BREAKING;
          return MovementStatus.PREPPING;
        }
        // Check if we need to place blocks
        if (this.toPlace.length > 0) {
          this.helper!.setToPlace(this.toPlace);
          this.state = MovementState.PLACING;
          return MovementStatus.PREPPING;
        }
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.BREAKING:
        // Use helper for breaking
        this.helper!.tickBreaking().then(status => {
          if (status === MovementStatus.SUCCESS) {
            if (this.toPlace.length > 0) {
              this.helper!.setToPlace(this.toPlace);
              this.state = MovementState.PLACING;
            } else {
              this.state = MovementState.MOVING;
            }
          }
        });
        return MovementStatus.RUNNING;

      case MovementState.PLACING:
        // Use helper for placing (bridging)
        this.helper!.tickPlacing().then(status => {
          if (status === MovementStatus.SUCCESS || status === MovementStatus.FAILED) {
            this.state = MovementState.MOVING;
          }
        });
        // While placing, sneak to avoid falling
        bot.setControlState('sneak', true);
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        bot.setControlState('sneak', false);

        // Check if we've reached destination
        if (this.helper!.isAtPosition(this.dest)) {
          this.state = MovementState.FINISHED;
          return MovementStatus.SUCCESS;
        }

        // Move toward destination
        this.helper!.moveToward(this.dest, 0.25, ctx.allowSprint);
        return MovementStatus.RUNNING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }
}

/**
 * MovementAscend: Jump up one block
 */
export class MovementAscend extends Movement {
  private jumped: boolean = false;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check destination floor
    if (!this.isSolid(ctx, dest.x, dest.y - 1, dest.z)) {
      // Need to place a block to jump onto
      if (!ctx.canPlace) return COST_INF;

      this.toPlace.push(dest.offset(0, -1, 0));
    }

    // Check head clearance at source
    if (!this.isPassable(ctx, src.x, src.y + 2, src.z)) {
      const miningCost = this.getMiningCost(ctx, src.offset(0, 2, 0));
      if (miningCost >= COST_INF) return COST_INF;
      this.toBreak.push(src.offset(0, 2, 0));
    }

    // Check body space at destination
    const obstacleCost = this.getObstacleCost(ctx, [
      dest.offset(0, 0, 0),
      dest.offset(0, 1, 0)
    ]);
    if (obstacleCost >= COST_INF) return COST_INF;

    // Calculate cost
    let cost = WALK_ONE_BLOCK_COST + JUMP_ONE_BLOCK_COST + ctx.jumpPenalty + obstacleCost;

    if (this.toPlace.length > 0) {
      cost += PLACE_ONE_BLOCK_COST;
    }

    return cost * ctx.getFavoring(dest.x, dest.y, dest.z);
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    switch (this.state) {
      case MovementState.NOT_STARTED:
        if (this.toBreak.length > 0) {
          this.helper!.setToBreak(this.toBreak);
          this.state = MovementState.BREAKING;
          return MovementStatus.PREPPING;
        }
        if (this.toPlace.length > 0) {
          this.helper!.setToPlace(this.toPlace);
          this.state = MovementState.PLACING;
          return MovementStatus.PREPPING;
        }
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.BREAKING:
        this.helper!.tickBreaking().then(status => {
          if (status === MovementStatus.SUCCESS) {
            if (this.toPlace.length > 0) {
              this.helper!.setToPlace(this.toPlace);
              this.state = MovementState.PLACING;
            } else {
              this.state = MovementState.MOVING;
            }
          }
        });
        return MovementStatus.RUNNING;

      case MovementState.PLACING:
        this.helper!.tickPlacing().then(status => {
          if (status === MovementStatus.SUCCESS || status === MovementStatus.FAILED) {
            this.state = MovementState.MOVING;
          }
        });
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        // Check if we've reached destination
        if (this.helper!.isAtPosition(this.dest, 0.3)) {
          this.state = MovementState.FINISHED;
          bot.setControlState('jump', false);
          return MovementStatus.SUCCESS;
        }

        // Jump and move toward destination
        const pos = bot.entity.position;
        const atSrc = Math.abs(pos.x - (this.src.x + 0.5)) < 0.4 &&
                      Math.abs(pos.z - (this.src.z + 0.5)) < 0.4;

        // Only jump when at source and on ground
        if (atSrc && bot.entity.onGround && !this.jumped) {
          bot.setControlState('jump', true);
          this.jumped = true;
        } else if (this.jumped && !bot.entity.onGround) {
          bot.setControlState('jump', false);
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
    this.jumped = false;
  }
}

/**
 * MovementDescend: Drop down one or more blocks
 * Supports fall override for continuous falling
 */
export class MovementDescend extends Movement {
  private readonly fallHeight: number;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.fallHeight = src.y - dest.y;
    // Descend can accept fall override - bot can fall through without stopping
    this.canAcceptFallOverride = true;
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check destination floor
    const floor = ctx.getBlock(dest.x, dest.y - 1, dest.z);
    if (!ctx.canWalkOn(floor) && !ctx.isWater(floor)) {
      return COST_INF;
    }

    // Check body space at destination
    if (!this.isPassable(ctx, dest.x, dest.y, dest.z)) return COST_INF;
    if (!this.isPassable(ctx, dest.x, dest.y + 1, dest.z)) return COST_INF;

    // Check path clearance
    for (let y = src.y; y >= dest.y; y--) {
      if (!this.isPassable(ctx, dest.x, y, dest.z)) return COST_INF;
      if (!this.isPassable(ctx, dest.x, y + 1, dest.z)) return COST_INF;
    }

    // Calculate fall cost
    const isWaterLanding = ctx.isWater(floor);
    const fallCost = getFallCost(this.fallHeight, isWaterLanding);

    const cost = WALK_OFF_BLOCK_COST + fallCost;
    return cost * ctx.getFavoring(dest.x, dest.y, dest.z);
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    switch (this.state) {
      case MovementState.NOT_STARTED:
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        // Walk toward edge
        this.helper!.moveToward(this.dest, 0.3, false, false);

        // Check if we're falling
        if (!bot.entity.onGround) {
          this.state = MovementState.WAITING;
        }

        return MovementStatus.RUNNING;

      case MovementState.WAITING:
        // Continue moving toward destination while falling
        this.helper!.moveToward(this.dest, 0.3, false, false);

        // Wait for landing
        if (bot.entity.onGround) {
          if (this.helper!.isAtPosition(this.dest, 0.5)) {
            this.state = MovementState.FINISHED;
            return MovementStatus.SUCCESS;
          }
        }

        return MovementStatus.WAITING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }

  /**
   * Get the y-level we expect to be falling through
   * Used by fall override system
   */
  getFallPath(): number[] {
    const path: number[] = [];
    for (let y = this.src.y; y >= this.dest.y; y--) {
      path.push(y);
    }
    return path;
  }
}

/**
 * MovementDiagonal: Diagonal movement
 */
export class MovementDiagonal extends Movement {
  private readonly dx: number;
  private readonly dz: number;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.dx = dest.x - src.x;
    this.dz = dest.z - src.z;
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check destination floor
    if (!this.isSolid(ctx, dest.x, dest.y - 1, dest.z)) {
      return COST_INF;
    }

    // Check body space at destination
    if (!this.isPassable(ctx, dest.x, dest.y, dest.z)) return COST_INF;
    if (!this.isPassable(ctx, dest.x, dest.y + 1, dest.z)) return COST_INF;

    // Check corner clearance (need at least one path)
    const corner1Clear = this.isPassable(ctx, src.x + this.dx, src.y, src.z) &&
                        this.isPassable(ctx, src.x + this.dx, src.y + 1, src.z);
    const corner2Clear = this.isPassable(ctx, src.x, src.y, src.z + this.dz) &&
                        this.isPassable(ctx, src.x, src.y + 1, src.z + this.dz);

    if (!corner1Clear && !corner2Clear) return COST_INF;

    // Calculate cost
    let cost = WALK_ONE_BLOCK_COST * SQRT_2;

    // Can sprint if both corners clear
    if (ctx.allowSprint && corner1Clear && corner2Clear) {
      cost *= SPRINT_MULTIPLIER;
    }

    return cost * ctx.getFavoring(dest.x, dest.y, dest.z);
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    if (this.helper!.isAtPosition(this.dest)) {
      return MovementStatus.SUCCESS;
    }

    this.helper!.moveToward(this.dest, 0.25, ctx.allowSprint, false);
    return MovementStatus.RUNNING;
  }
}

/**
 * MovementPillar: Jump straight up (tower)
 */
export class MovementPillar extends Movement {
  private hasPlacedBlock: boolean = false;
  private jumpStartY: number = 0;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
  }

  calculateCost(ctx: CalculationContext): number {
    const { src, dest } = this;

    // Check if on ladder/vine
    const currentBlock = ctx.getBlock(src.x, src.y, src.z);
    if (currentBlock?.name === 'ladder' || currentBlock?.name === 'vine') {
      // Check head clearance
      if (!this.isPassable(ctx, src.x, src.y + 2, src.z)) {
        return COST_INF;
      }
      return LADDER_UP_ONE_COST;
    }

    // Need to place block
    if (!ctx.canPlace) return COST_INF;

    // Check head clearance
    if (!this.isPassable(ctx, src.x, src.y + 2, src.z)) {
      const miningCost = this.getMiningCost(ctx, src.offset(0, 2, 0));
      if (miningCost >= COST_INF) return COST_INF;
      this.toBreak.push(src.offset(0, 2, 0));
    }

    this.toPlace.push(src);

    const cost = JUMP_ONE_BLOCK_COST + PLACE_ONE_BLOCK_COST + ctx.jumpPenalty;
    return cost;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    switch (this.state) {
      case MovementState.NOT_STARTED:
        if (this.toBreak.length > 0) {
          this.helper!.setToBreak(this.toBreak);
          this.state = MovementState.BREAKING;
          return MovementStatus.PREPPING;
        }
        this.jumpStartY = bot.entity.position.y;
        this.state = MovementState.PLACING;
        return MovementStatus.RUNNING;

      case MovementState.BREAKING:
        this.helper!.tickBreaking().then(status => {
          if (status === MovementStatus.SUCCESS) {
            this.jumpStartY = bot.entity.position.y;
            this.state = MovementState.PLACING;
          }
        });
        return MovementStatus.RUNNING;

      case MovementState.PLACING:
        const pos = bot.entity.position;

        // Check if we're at destination
        if (pos.y >= this.dest.y && bot.entity.onGround) {
          bot.setControlState('jump', false);
          this.state = MovementState.FINISHED;
          return MovementStatus.SUCCESS;
        }

        // Jump to make room for block placement
        if (bot.entity.onGround) {
          bot.setControlState('jump', true);
          this.jumpStartY = pos.y;
        }

        // Place block when at peak of jump
        if (!this.hasPlacedBlock && pos.y > this.jumpStartY + 0.8) {
          // Look down and place
          bot.look(bot.entity.yaw, Math.PI / 2);

          // Place block below
          this.helper!.setToPlace([this.src]);
          this.helper!.tickPlacing().then(status => {
            if (status === MovementStatus.SUCCESS) {
              this.hasPlacedBlock = true;
            }
          });
        }

        return MovementStatus.RUNNING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }

  reset(): void {
    super.reset();
    this.hasPlacedBlock = false;
    this.jumpStartY = 0;
  }
}

/**
 * MovementParkour: Long jump over gaps
 */
export class MovementParkour extends Movement {
  private readonly distance: number;
  private hasJumped: boolean = false;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.distance = Math.sqrt(
      Math.pow(dest.x - src.x, 2) +
      Math.pow(dest.z - src.z, 2)
    );
  }

  calculateCost(ctx: CalculationContext): number {
    if (!ctx.allowParkour) return COST_INF;

    const { src, dest } = this;

    // Check destination floor
    if (!this.isSolid(ctx, dest.x, dest.y - 1, dest.z)) {
      return COST_INF;
    }

    // Check body space at destination
    if (!this.isPassable(ctx, dest.x, dest.y, dest.z)) return COST_INF;
    if (!this.isPassable(ctx, dest.x, dest.y + 1, dest.z)) return COST_INF;

    // Check head clearance at source
    if (!this.isPassable(ctx, src.x, src.y + 2, src.z)) return COST_INF;

    // Determine cost based on distance
    let cost: number;
    if (this.distance <= 2) {
      cost = WALK_ONE_BLOCK_COST * this.distance;
    } else if (this.distance <= 3) {
      cost = WALK_ONE_BLOCK_COST * this.distance;
    } else {
      // 4-block jump requires sprint
      if (!ctx.allowSprint) return COST_INF;
      cost = SPRINT_ONE_BLOCK_COST * this.distance;
    }

    return cost + ctx.jumpPenalty;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    // Check if we've landed at destination
    if (this.helper!.isAtPosition(this.dest, 0.4) && bot.entity.onGround) {
      bot.setControlState('sprint', false);
      bot.setControlState('jump', false);
      return MovementStatus.SUCCESS;
    }

    const pos = bot.entity.position;
    const needsSprint = this.distance > 3;

    // Move toward destination
    this.helper!.moveToward(this.dest, 0.2, needsSprint, false);

    // Jump at edge of source block
    const distFromSrc = Math.sqrt(
      Math.pow(pos.x - (this.src.x + 0.5), 2) +
      Math.pow(pos.z - (this.src.z + 0.5), 2)
    );

    if (bot.entity.onGround && distFromSrc >= 0.3 && !this.hasJumped) {
      bot.setControlState('jump', true);
      this.hasJumped = true;
    } else if (!bot.entity.onGround) {
      bot.setControlState('jump', false);
    }

    return MovementStatus.RUNNING;
  }

  reset(): void {
    super.reset();
    this.hasJumped = false;
  }
}

/**
 * MovementParkourAscend: Long jump with upward movement (+1 Y)
 * Combination of horizontal parkour jump while also gaining 1 block of height.
 * More difficult than standard parkour - requires precise timing.
 */
export class MovementParkourAscend extends Movement {
  private readonly horizontalDistance: number;
  private hasJumped: boolean = false;
  private jumpTick: number = 0;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.horizontalDistance = Math.sqrt(
      Math.pow(dest.x - src.x, 2) +
      Math.pow(dest.z - src.z, 2)
    );
  }

  calculateCost(ctx: CalculationContext): number {
    if (!ctx.allowParkour) return COST_INF;
    if (!ctx.allowSprint) return COST_INF; // Parkour ascend always needs sprint

    const { src, dest } = this;

    // Must be ascending by exactly 1 block
    if (dest.y - src.y !== 1) return COST_INF;

    // Max horizontal distance for parkour ascend is 3 blocks
    // (can't jump as far while also ascending)
    if (this.horizontalDistance > 3) return COST_INF;

    // Check destination floor
    if (!this.isSolid(ctx, dest.x, dest.y - 1, dest.z)) {
      return COST_INF;
    }

    // Check body space at destination
    if (!this.isPassable(ctx, dest.x, dest.y, dest.z)) return COST_INF;
    if (!this.isPassable(ctx, dest.x, dest.y + 1, dest.z)) return COST_INF;

    // Check head clearance at source (need extra space for jump arc)
    if (!this.isPassable(ctx, src.x, src.y + 2, src.z)) return COST_INF;

    // Check trajectory clearance - jumping arc
    // At midpoint, player will be at approximately src.y + 1.5
    const midX = (src.x + dest.x) / 2;
    const midZ = (src.z + dest.z) / 2;
    const midY = src.y + 1; // Approximate trajectory height
    if (!this.isPassable(ctx, Math.floor(midX), Math.floor(midY), Math.floor(midZ))) {
      return COST_INF;
    }
    if (!this.isPassable(ctx, Math.floor(midX), Math.floor(midY) + 1, Math.floor(midZ))) {
      return COST_INF;
    }

    // Check gap is actually a gap (not just walking)
    // There should be no solid ground between src and dest horizontally
    const dx = Math.sign(dest.x - src.x);
    const dz = Math.sign(dest.z - src.z);
    let hasGap = false;
    for (let d = 1; d < Math.max(Math.abs(dest.x - src.x), Math.abs(dest.z - src.z)); d++) {
      const checkX = src.x + dx * d;
      const checkZ = src.z + dz * d;
      if (!this.isSolid(ctx, checkX, src.y - 1, checkZ) &&
          !this.isSolid(ctx, checkX, src.y, checkZ)) {
        hasGap = true;
        break;
      }
    }

    // If no gap and dest is only 1 block away, use regular ascend instead
    if (!hasGap && this.horizontalDistance <= 1.5) {
      return COST_INF;
    }

    // Cost: higher than regular parkour due to difficulty
    // Sprint cost + jump cost + ascend penalty
    const cost = SPRINT_ONE_BLOCK_COST * this.horizontalDistance +
                 JUMP_ONE_BLOCK_COST +
                 ctx.jumpPenalty * 1.5; // Extra penalty for difficulty

    return cost;
  }

  tick(ctx: CalculationContext, bot: any): MovementStatus {
    this.ticksOnCurrent++;
    if (!this.helper) this.initHelper(bot, ctx);

    // Check if we've landed at destination
    if (this.helper!.isAtPosition(this.dest, 0.5) && bot.entity.onGround) {
      bot.setControlState('sprint', false);
      bot.setControlState('jump', false);
      bot.setControlState('forward', false);
      return MovementStatus.SUCCESS;
    }

    // Timeout check - parkour ascend should complete within reasonable time
    if (this.ticksOnCurrent > 60) {
      bot.setControlState('sprint', false);
      bot.setControlState('jump', false);
      return MovementStatus.FAILED;
    }

    const pos = bot.entity.position;

    // Always sprint for parkour ascend
    bot.setControlState('sprint', true);

    // Move toward destination
    this.helper!.moveToward(this.dest, 0.15, true, false);

    // Calculate distance from source center
    const distFromSrc = Math.sqrt(
      Math.pow(pos.x - (this.src.x + 0.5), 2) +
      Math.pow(pos.z - (this.src.z + 0.5), 2)
    );

    // Jump at edge of source block
    // For parkour ascend, timing is critical - jump slightly earlier than flat parkour
    const jumpDistance = Math.min(0.4, this.horizontalDistance * 0.15);

    if (bot.entity.onGround && distFromSrc >= jumpDistance && !this.hasJumped) {
      bot.setControlState('jump', true);
      this.hasJumped = true;
      this.jumpTick = this.ticksOnCurrent;
    } else if (this.hasJumped && this.ticksOnCurrent > this.jumpTick + 2) {
      // Release jump after a couple ticks
      bot.setControlState('jump', false);
    }

    // If we've fallen back to source level or below, we failed
    if (this.hasJumped && bot.entity.onGround && pos.y <= this.src.y) {
      if (this.ticksOnCurrent > this.jumpTick + 10) {
        return MovementStatus.FAILED;
      }
    }

    return MovementStatus.RUNNING;
  }

  reset(): void {
    super.reset();
    this.hasJumped = false;
    this.jumpTick = 0;
  }
}
