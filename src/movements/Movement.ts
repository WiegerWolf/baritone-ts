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

  constructor(src: BlockPos, dest: BlockPos) {
    this.src = src;
    this.dest = dest;
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

    switch (this.state) {
      case MovementState.NOT_STARTED:
        // Check if we need to break blocks
        if (this.toBreak.length > 0) {
          this.state = MovementState.BREAKING;
          return MovementStatus.PREPPING;
        }
        // Check if we need to place blocks
        if (this.toPlace.length > 0) {
          this.state = MovementState.PLACING;
          return MovementStatus.PREPPING;
        }
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.BREAKING:
        // TODO: Implement block breaking
        if (this.toBreak.length === 0) {
          this.state = MovementState.MOVING;
        }
        return MovementStatus.RUNNING;

      case MovementState.PLACING:
        // TODO: Implement block placing
        if (this.toPlace.length === 0) {
          this.state = MovementState.MOVING;
        }
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        // Check if we've reached destination
        const pos = bot.entity.position;
        const dx = Math.abs(pos.x - (this.dest.x + 0.5));
        const dz = Math.abs(pos.z - (this.dest.z + 0.5));

        if (dx < 0.25 && dz < 0.25) {
          this.state = MovementState.FINISHED;
          return MovementStatus.SUCCESS;
        }

        // Move toward destination
        const yaw = Math.atan2(-(this.dest.x + 0.5 - pos.x), -(this.dest.z + 0.5 - pos.z));
        bot.look(yaw, 0);
        bot.setControlState('forward', true);

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

    switch (this.state) {
      case MovementState.NOT_STARTED:
        if (this.toBreak.length > 0) {
          this.state = MovementState.BREAKING;
          return MovementStatus.PREPPING;
        }
        if (this.toPlace.length > 0) {
          this.state = MovementState.PLACING;
          return MovementStatus.PREPPING;
        }
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        const pos = bot.entity.position;
        const dx = Math.abs(pos.x - (this.dest.x + 0.5));
        const dy = pos.y - this.dest.y;
        const dz = Math.abs(pos.z - (this.dest.z + 0.5));

        if (dx < 0.25 && dz < 0.25 && Math.abs(dy) < 0.5) {
          this.state = MovementState.FINISHED;
          return MovementStatus.SUCCESS;
        }

        // Jump and move
        const yaw = Math.atan2(-(this.dest.x + 0.5 - pos.x), -(this.dest.z + 0.5 - pos.z));
        bot.look(yaw, 0);
        bot.setControlState('forward', true);
        bot.setControlState('jump', true);

        return MovementStatus.RUNNING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }
}

/**
 * MovementDescend: Drop down one or more blocks
 */
export class MovementDescend extends Movement {
  private readonly fallHeight: number;

  constructor(src: BlockPos, dest: BlockPos) {
    super(src, dest);
    this.fallHeight = src.y - dest.y;
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

    switch (this.state) {
      case MovementState.NOT_STARTED:
        this.state = MovementState.MOVING;
        return MovementStatus.RUNNING;

      case MovementState.MOVING:
        const pos = bot.entity.position;
        const dx = Math.abs(pos.x - (this.dest.x + 0.5));
        const dz = Math.abs(pos.z - (this.dest.z + 0.5));

        // Walk toward destination
        const yaw = Math.atan2(-(this.dest.x + 0.5 - pos.x), -(this.dest.z + 0.5 - pos.z));
        bot.look(yaw, 0);
        bot.setControlState('forward', true);

        // Check if we're falling
        if (!bot.entity.onGround) {
          this.state = MovementState.WAITING;
        }

        return MovementStatus.RUNNING;

      case MovementState.WAITING:
        // Wait for landing
        if (bot.entity.onGround) {
          const pos = bot.entity.position;
          const dy = Math.abs(pos.y - this.dest.y);

          if (dy < 0.5) {
            this.state = MovementState.FINISHED;
            return MovementStatus.SUCCESS;
          }
        }

        // Continue moving toward destination while falling
        const fallPos = bot.entity.position;
        const fallYaw = Math.atan2(-(this.dest.x + 0.5 - fallPos.x), -(this.dest.z + 0.5 - fallPos.z));
        bot.look(fallYaw, 0);

        return MovementStatus.WAITING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
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

    const pos = bot.entity.position;
    const dx = Math.abs(pos.x - (this.dest.x + 0.5));
    const dz = Math.abs(pos.z - (this.dest.z + 0.5));

    if (dx < 0.25 && dz < 0.25) {
      return MovementStatus.SUCCESS;
    }

    const yaw = Math.atan2(-(this.dest.x + 0.5 - pos.x), -(this.dest.z + 0.5 - pos.z));
    bot.look(yaw, 0);
    bot.setControlState('forward', true);

    return MovementStatus.RUNNING;
  }
}

/**
 * MovementPillar: Jump straight up (tower)
 */
export class MovementPillar extends Movement {
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

    switch (this.state) {
      case MovementState.NOT_STARTED:
        if (this.toBreak.length > 0) {
          this.state = MovementState.BREAKING;
          return MovementStatus.PREPPING;
        }
        this.state = MovementState.PLACING;
        return MovementStatus.RUNNING;

      case MovementState.PLACING:
        // Jump and place
        bot.setControlState('jump', true);

        // TODO: Implement block placement timing

        const pos = bot.entity.position;
        if (pos.y >= this.dest.y) {
          this.state = MovementState.FINISHED;
          return MovementStatus.SUCCESS;
        }

        return MovementStatus.RUNNING;

      case MovementState.FINISHED:
        return MovementStatus.SUCCESS;

      default:
        return MovementStatus.FAILED;
    }
  }
}

/**
 * MovementParkour: Long jump over gaps
 */
export class MovementParkour extends Movement {
  private readonly distance: number;

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

    const pos = bot.entity.position;
    const dx = Math.abs(pos.x - (this.dest.x + 0.5));
    const dz = Math.abs(pos.z - (this.dest.z + 0.5));

    if (dx < 0.4 && dz < 0.4 && bot.entity.onGround) {
      return MovementStatus.SUCCESS;
    }

    // Sprint jump toward destination
    const yaw = Math.atan2(-(this.dest.x + 0.5 - pos.x), -(this.dest.z + 0.5 - pos.z));
    bot.look(yaw, 0);
    bot.setControlState('forward', true);
    bot.setControlState('sprint', this.distance > 3);
    bot.setControlState('jump', bot.entity.onGround);

    return MovementStatus.RUNNING;
  }
}
