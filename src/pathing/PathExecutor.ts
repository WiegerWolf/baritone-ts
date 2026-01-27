import { PathNode, MovementStatus, BlockPos, CalculationContext } from '../types';
import { Movement, MovementTraverse, MovementAscend, MovementDescend, MovementDiagonal, MovementPillar, MovementParkour } from '../movements/Movement';

/**
 * PathExecutor handles the execution of a calculated path
 *
 * Key features from Baritone:
 * - Movement skipping (skip movements already completed)
 * - Sprint optimization (lookahead for sprint decisions)
 * - Fall override (continue fall into subsequent movements)
 * - Lag teleport detection (backtrack if server moves us back)
 * - Per-movement timeouts (not just global timeout)
 */
export class PathExecutor {
  private readonly bot: any;
  private readonly ctx: CalculationContext;
  private readonly path: PathNode[];
  private readonly movements: Movement[];

  private pathPosition: number = 0;
  private ticksOnCurrent: number = 0;
  private ticksAway: number = 0;
  private sprintNextTick: boolean = false;

  private static readonly MAX_DIST_FROM_PATH = 2.0;
  private static readonly MAX_TICKS_AWAY = 200;
  private static readonly MOVEMENT_TIMEOUT_BUFFER = 100;

  private currentMovementEstimate: number = 0;

  constructor(
    bot: any,
    ctx: CalculationContext,
    path: PathNode[]
  ) {
    this.bot = bot;
    this.ctx = ctx;
    this.path = path;
    this.movements = this.buildMovements(path);

    if (this.movements.length > 0) {
      this.currentMovementEstimate = this.movements[0].calculateCost(ctx);
    }
  }

  /**
   * Build Movement objects from path nodes
   */
  private buildMovements(path: PathNode[]): Movement[] {
    const movements: Movement[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];

      const src = new BlockPos(from.x, from.y, from.z);
      const dest = new BlockPos(to.x, to.y, to.z);

      const movement = this.createMovement(src, dest);
      if (movement) {
        movements.push(movement);
      }
    }

    return movements;
  }

  /**
   * Create appropriate Movement type based on source and destination
   */
  private createMovement(src: BlockPos, dest: BlockPos): Movement | null {
    const dx = dest.x - src.x;
    const dy = dest.y - src.y;
    const dz = dest.z - src.z;

    // Pillar (straight up)
    if (dx === 0 && dz === 0 && dy === 1) {
      return new MovementPillar(src, dest);
    }

    // Ascend (diagonal up)
    if (dy === 1 && (Math.abs(dx) === 1 || Math.abs(dz) === 1)) {
      return new MovementAscend(src, dest);
    }

    // Descend (diagonal down)
    if (dy < 0 && (Math.abs(dx) === 1 || Math.abs(dz) === 1)) {
      return new MovementDescend(src, dest);
    }

    // Diagonal (same level, diagonal)
    if (dy === 0 && Math.abs(dx) === 1 && Math.abs(dz) === 1) {
      return new MovementDiagonal(src, dest);
    }

    // Parkour (long jump)
    if (dy === 0 && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) {
      return new MovementParkour(src, dest);
    }

    // Traverse (cardinal direction same level)
    if (dy === 0 && (Math.abs(dx) + Math.abs(dz) === 1)) {
      return new MovementTraverse(src, dest);
    }

    // Down (straight down)
    if (dx === 0 && dz === 0 && dy < 0) {
      return new MovementDescend(src, dest);
    }

    return null;
  }

  /**
   * Execute one tick of path following
   * Returns true when path is complete or cancelled
   */
  onTick(): boolean {
    // Check if path is complete
    if (this.pathPosition >= this.movements.length) {
      this.clearControls();
      return true;
    }

    // Handle lag teleport detection (server moved us back)
    this.handleLagTeleport();

    // Check for off-path drift
    if (!this.checkOnPath()) {
      this.ticksAway++;
      if (this.ticksAway > PathExecutor.MAX_TICKS_AWAY) {
        this.cancel();
        return true;
      }
    } else {
      this.ticksAway = 0;
    }

    // Execute current movement
    const movement = this.movements[this.pathPosition];
    const status = movement.tick(this.ctx, this.bot);

    // Handle movement completion
    if (status === MovementStatus.SUCCESS) {
      this.pathPosition++;
      this.onChangeInPathPosition();

      if (this.pathPosition >= this.movements.length) {
        this.clearControls();
        return true;
      }

      // Update estimate for new movement
      this.currentMovementEstimate = this.movements[this.pathPosition].calculateCost(this.ctx);
      this.ticksOnCurrent = 0;
    } else if (status === MovementStatus.UNREACHABLE || status === MovementStatus.FAILED) {
      this.cancel();
      return true;
    }

    // Determine sprint for next tick
    this.sprintNextTick = this.shouldSprintNextTick();
    this.bot.setControlState('sprint', this.sprintNextTick);

    // Check for movement timeout
    this.ticksOnCurrent++;
    if (this.ticksOnCurrent > this.currentMovementEstimate + PathExecutor.MOVEMENT_TIMEOUT_BUFFER) {
      this.cancel();
      return true;
    }

    return false;
  }

  /**
   * Handle lag teleport detection
   * If server moved us back to an earlier position, adjust pathPosition
   */
  private handleLagTeleport(): void {
    const pos = this.bot.entity.position;
    const currentPos = new BlockPos(
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z)
    );

    // Check if we're at an earlier position in the path
    for (let i = 0; i < this.pathPosition && i < this.path.length; i++) {
      const pathNode = this.path[i];
      if (pathNode.x === currentPos.x &&
          pathNode.y === currentPos.y &&
          pathNode.z === currentPos.z) {
        // We've been teleported back
        this.pathPosition = i;
        this.movements[i].reset();
        this.ticksOnCurrent = 0;
        break;
      }
    }
  }

  /**
   * Check if player is on or near the path
   */
  private checkOnPath(): boolean {
    const pos = this.bot.entity.position;

    // Check current and next few movements
    for (let i = this.pathPosition; i < Math.min(this.path.length, this.pathPosition + 3); i++) {
      const node = this.path[i];
      const dx = pos.x - (node.x + 0.5);
      const dy = pos.y - node.y;
      const dz = pos.z - (node.z + 0.5);
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < PathExecutor.MAX_DIST_FROM_PATH) {
        return true;
      }
    }

    return false;
  }

  /**
   * Handle movement skipping when we've arrived ahead of schedule
   */
  private onChangeInPathPosition(): void {
    const pos = this.bot.entity.position;
    const currentPos = new BlockPos(
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z)
    );

    // Skip upcoming movements if we've already reached their destination
    for (let i = this.pathPosition; i < Math.min(this.path.length - 1, this.pathPosition + 3); i++) {
      const movement = this.movements[i];
      if (movement.dest.equals(currentPos)) {
        this.pathPosition = i + 1;
        this.ticksOnCurrent = 0;
      }
    }
  }

  /**
   * Determine if we should sprint next tick
   * Lookahead at upcoming movements to decide
   */
  private shouldSprintNextTick(): boolean {
    if (!this.ctx.allowSprint) return false;

    const currentMovement = this.movements[this.pathPosition];
    if (!currentMovement) return false;

    // Can't sprint in water
    const pos = this.bot.entity.position;
    const block = this.ctx.getBlock(
      Math.floor(pos.x),
      Math.floor(pos.y),
      Math.floor(pos.z)
    );
    if (this.ctx.isWater(block)) return false;

    // Look ahead at next few movements
    for (let i = this.pathPosition; i < Math.min(this.movements.length, this.pathPosition + 4); i++) {
      const movement = this.movements[i];

      // Don't sprint into descend (need control)
      if (movement instanceof MovementDescend) {
        return i > this.pathPosition; // OK if not immediate
      }

      // Don't sprint into sharp turns
      if (i > this.pathPosition) {
        const prev = this.movements[i - 1];
        const angle = this.getAngleChange(prev, movement);
        if (angle > 45) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculate angle change between two movements
   */
  private getAngleChange(a: Movement, b: Movement): number {
    const dx1 = a.dest.x - a.src.x;
    const dz1 = a.dest.z - a.src.z;
    const dx2 = b.dest.x - b.src.x;
    const dz2 = b.dest.z - b.src.z;

    const angle1 = Math.atan2(dz1, dx1);
    const angle2 = Math.atan2(dz2, dx2);

    let diff = Math.abs(angle1 - angle2) * (180 / Math.PI);
    if (diff > 180) diff = 360 - diff;

    return diff;
  }

  /**
   * Cancel path execution
   */
  cancel(): void {
    this.clearControls();
  }

  /**
   * Clear all control states
   */
  private clearControls(): void {
    this.bot.clearControlStates();
  }

  /**
   * Get current path position
   */
  getPathPosition(): number {
    return this.pathPosition;
  }

  /**
   * Get remaining path length
   */
  getRemainingLength(): number {
    return this.movements.length - this.pathPosition;
  }

  /**
   * Check if path is complete
   */
  isComplete(): boolean {
    return this.pathPosition >= this.movements.length;
  }

  /**
   * Get current movement
   */
  getCurrentMovement(): Movement | null {
    return this.movements[this.pathPosition] ?? null;
  }

  /**
   * Attempt to splice with another path
   */
  static trySplice(first: PathNode[], second: PathNode[]): PathNode[] | null {
    if (first.length === 0 || second.length === 0) return null;

    // Find where paths overlap
    const secondPosSet = new Set(second.map(n => `${n.x},${n.y},${n.z}`));

    let overlapIndex = -1;
    for (let i = 0; i < first.length - 1; i++) {
      const hash = `${first[i].x},${first[i].y},${first[i].z}`;
      if (secondPosSet.has(hash)) {
        overlapIndex = i;
        break;
      }
    }

    if (overlapIndex === -1) return null;

    // Find corresponding position in second path
    const overlapHash = `${first[overlapIndex].x},${first[overlapIndex].y},${first[overlapIndex].z}`;
    let secondIndex = -1;
    for (let i = 0; i < second.length; i++) {
      const hash = `${second[i].x},${second[i].y},${second[i].z}`;
      if (hash === overlapHash) {
        secondIndex = i;
        break;
      }
    }

    if (secondIndex === -1) return null;

    // Build spliced path
    const spliced: PathNode[] = [];
    spliced.push(...first.slice(0, overlapIndex + 1));
    spliced.push(...second.slice(secondIndex + 1));

    return spliced;
  }
}

/**
 * Failure modes and detection
 */
export enum PathFailureMode {
  NONE,
  LAG_TELEPORT,      // Server moved us back
  BLOCK_UPDATE,      // Block changed, path invalid
  MOVEMENT_TIMEOUT,  // Took too long on one movement
  OFF_PATH_DRIFT,    // Drifted too far from path
  COST_INFLATION,    // Path cost became too high
  UNLOADED_CHUNK,    // Path goes through unloaded chunk
  BETTER_PLAN        // Found a better path
}
