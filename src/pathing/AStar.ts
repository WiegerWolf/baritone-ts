import { PathNode, PathResult, Goal, CalculationContext, COST_INF, BlockPos } from '../types';
import { BinaryHeap } from './BinaryHeap';

/**
 * Multi-coefficient A* implementation following Baritone's design
 *
 * Key features:
 * - 7 coefficient variants for graceful degradation
 * - Minimum improvement threshold to avoid spurious updates
 * - Failing state transition for timeout optimization
 * - Optimized time checking (only every 64 nodes)
 */
export class AStar {
  // Baritone's coefficient variants for graceful degradation
  // Higher coefficients prioritize getting closer to goal over optimal path
  private static readonly COEFFICIENTS = [1.5, 2, 2.5, 3, 4, 5, 10];

  // Minimum improvement to consider (0.01 ticks = half a millisecond)
  private static readonly MIN_IMPROVEMENT = 0.01;

  // Minimum distance to consider a path "found"
  private static readonly MIN_DIST_PATH = 5;

  // Time check interval (only check time every N nodes)
  private static readonly TIME_CHECK_INTERVAL = 64;

  private readonly goal: Goal;
  private readonly ctx: CalculationContext;
  private readonly primaryTimeout: number;
  private readonly failureTimeout: number;

  // Open set as binary heap
  private readonly openSet: BinaryHeap;

  // Closed set as hash set
  private readonly closedSet: Set<string> = new Set();

  // Open set lookup map for O(1) node access
  private readonly openMap: Map<string, PathNode> = new Map();

  // Best nodes for each coefficient (graceful degradation)
  private readonly bestSoFar: (PathNode | null)[];
  private readonly bestHeuristicSoFar: number[];

  // Overall best node (closest to goal)
  private bestNode: PathNode;

  // Start position
  private readonly startX: number;
  private readonly startY: number;
  private readonly startZ: number;

  // Search state
  private numNodes: number = 0;
  private failing: boolean = true;
  private startTime: number;
  private failureTimeoutTime: number;
  private primaryTimeoutTime: number;

  // Visited chunks for incremental pathfinding
  public readonly visitedChunks: Set<string> = new Set();

  constructor(
    startX: number,
    startY: number,
    startZ: number,
    goal: Goal,
    ctx: CalculationContext,
    primaryTimeout: number = 5000,
    failureTimeout: number = 2000
  ) {
    this.startX = startX;
    this.startY = startY;
    this.startZ = startZ;
    this.goal = goal;
    this.ctx = ctx;
    this.primaryTimeout = primaryTimeout;
    this.failureTimeout = failureTimeout;

    this.openSet = new BinaryHeap();
    this.bestSoFar = new Array(AStar.COEFFICIENTS.length).fill(null);
    this.bestHeuristicSoFar = new Array(AStar.COEFFICIENTS.length).fill(Infinity);

    // Initialize start node
    const startHeuristic = goal.heuristic(startX, startY, startZ);
    if (Number.isNaN(startHeuristic)) {
      throw new Error('Goal returned NaN heuristic for start position');
    }

    const startNode = new PathNode(startX, startY, startZ, startHeuristic);
    startNode.cost = 0;
    startNode.combinedCost = startHeuristic;
    this.bestNode = startNode;

    this.openSet.push(startNode);
    this.openMap.set(startNode.hash, startNode);

    // Initialize timing
    this.startTime = performance.now();
    this.failureTimeoutTime = this.startTime + failureTimeout;
    this.primaryTimeoutTime = this.startTime + primaryTimeout;
  }

  /**
   * Run A* computation for one tick
   * Returns result when done or partial if still computing
   */
  compute(tickTimeout: number = 40): PathResult {
    const computeStart = performance.now();

    while (!this.openSet.isEmpty()) {
      // Time check optimization: only check every N nodes
      if ((this.numNodes & (AStar.TIME_CHECK_INTERVAL - 1)) === 0) {
        const now = performance.now();

        // Per-tick timeout
        if (now - computeStart > tickTimeout) {
          return this.makeResult('partial');
        }

        // Total timeout based on state
        if (now >= this.failureTimeoutTime ||
            (!this.failing && now >= this.primaryTimeoutTime)) {
          return this.makeResult('timeout');
        }
      }

      const current = this.openSet.pop()!;
      this.numNodes++;

      // Goal check
      if (this.goal.isEnd(current.x, current.y, current.z)) {
        return this.makeResult('success', current);
      }

      // Move to closed set
      this.openMap.delete(current.hash);
      this.closedSet.add(current.hash);

      // Track visited chunks
      this.visitedChunks.add(`${current.x >> 4},${current.z >> 4}`);

      // Update best node if closer to goal
      if (current.estimatedCostToGoal < this.bestNode.estimatedCostToGoal) {
        this.bestNode = current;
      }

      // Update failing state: once we have a path of sufficient length, use stricter timeout
      if (this.failing && this.getDistFromStartSq(current) > AStar.MIN_DIST_PATH * AStar.MIN_DIST_PATH) {
        this.failing = false;
      }

      // Expand neighbors
      this.expandNeighbors(current);
    }

    // Exhausted all possibilities
    return this.makeResult('noPath');
  }

  /**
   * Expand all neighbors of a node
   */
  private expandNeighbors(current: PathNode): void {
    // Get all possible moves from this position
    const neighbors = this.getNeighbors(current);

    for (const neighbor of neighbors) {
      if (this.closedSet.has(neighbor.hash)) {
        continue;
      }

      const tentativeCost = current.cost + neighbor.moveCost;

      // Check if neighbor is already in open set
      let existingNode = this.openMap.get(neighbor.hash);
      let update = false;

      if (existingNode === undefined) {
        // New node - create and add to open set
        const heuristic = this.goal.heuristic(neighbor.x, neighbor.y, neighbor.z);
        if (Number.isNaN(heuristic)) continue;

        existingNode = new PathNode(neighbor.x, neighbor.y, neighbor.z, heuristic);
        this.openMap.set(neighbor.hash, existingNode);
      } else {
        // Existing node - check if this path is better
        // Use minimum improvement threshold to avoid spurious updates
        if (existingNode.cost - tentativeCost <= AStar.MIN_IMPROVEMENT) {
          continue;
        }
        update = true;
      }

      // Update node
      existingNode.cost = tentativeCost;
      existingNode.combinedCost = tentativeCost + existingNode.estimatedCostToGoal;
      existingNode.previous = current;
      existingNode.toBreak = neighbor.toBreak?.map(p => new BlockPos(p.x, p.y, p.z)) || [];
      existingNode.toPlace = neighbor.toPlace?.map(p => new BlockPos(p.x, p.y, p.z)) || [];

      // Update multi-coefficient tracking for graceful degradation
      for (let i = 0; i < AStar.COEFFICIENTS.length; i++) {
        const weightedCost = existingNode.estimatedCostToGoal +
                            existingNode.cost / AStar.COEFFICIENTS[i];

        if (this.bestHeuristicSoFar[i] - weightedCost > AStar.MIN_IMPROVEMENT) {
          this.bestHeuristicSoFar[i] = weightedCost;
          this.bestSoFar[i] = existingNode;
        }
      }

      // Add/update in heap
      if (update) {
        this.openSet.update(existingNode);
      } else {
        this.openSet.push(existingNode);
      }
    }
  }

  /**
   * Get all valid neighbor moves from a position
   */
  private getNeighbors(node: PathNode): NeighborMove[] {
    const neighbors: NeighborMove[] = [];
    const x = node.x;
    const y = node.y;
    const z = node.z;

    // Cardinal directions (N, S, E, W)
    const cardinals = [
      { dx: 0, dz: -1 },  // North
      { dx: 0, dz: 1 },   // South
      { dx: 1, dz: 0 },   // East
      { dx: -1, dz: 0 }   // West
    ];

    // Diagonal directions
    const diagonals = [
      { dx: -1, dz: -1 },
      { dx: -1, dz: 1 },
      { dx: 1, dz: -1 },
      { dx: 1, dz: 1 }
    ];

    // Check each cardinal direction for various movement types
    for (const dir of cardinals) {
      // Traverse (same level)
      this.checkTraverse(x, y, z, dir.dx, dir.dz, neighbors);

      // Ascend (jump up)
      this.checkAscend(x, y, z, dir.dx, dir.dz, neighbors);

      // Descend (drop down)
      this.checkDescend(x, y, z, dir.dx, dir.dz, neighbors);

      // Parkour (long jump)
      if (this.ctx.allowParkour) {
        this.checkParkour(x, y, z, dir.dx, dir.dz, neighbors);
      }
    }

    // Check diagonal movements
    for (const dir of diagonals) {
      this.checkDiagonal(x, y, z, dir.dx, dir.dz, neighbors);
    }

    // Pillar up
    this.checkPillar(x, y, z, neighbors);

    // Downward (mine down)
    this.checkDownward(x, y, z, neighbors);

    // Swimming movements (if in water)
    const currentBlock = this.ctx.getBlock(x, y, z);
    if (this.ctx.isWater(currentBlock)) {
      // Swim up
      this.checkSwimUp(x, y, z, neighbors);

      // Swim down
      this.checkSwimDown(x, y, z, neighbors);

      // Horizontal swimming
      for (const dir of cardinals) {
        this.checkSwimHorizontal(x, y, z, dir.dx, dir.dz, neighbors);
      }

      // Water exit
      for (const dir of cardinals) {
        this.checkWaterExit(x, y, z, dir.dx, dir.dz, neighbors);
      }
    } else {
      // Water entry (if adjacent to water)
      for (const dir of cardinals) {
        this.checkWaterEntry(x, y, z, dir.dx, dir.dz, neighbors);
      }
    }

    // Door/gate movements
    for (const dir of cardinals) {
      this.checkDoor(x, y, z, dir.dx, dir.dz, neighbors);
    }

    return neighbors;
  }

  /**
   * Check traverse movement (same Y level)
   */
  private checkTraverse(
    x: number, y: number, z: number,
    dx: number, dz: number,
    neighbors: NeighborMove[]
  ): void {
    const destX = x + dx;
    const destZ = z + dz;

    // Check destination floor
    const floor = this.ctx.getBlock(destX, y - 1, destZ);
    if (!this.ctx.canWalkOn(floor)) return;

    // Check body space (2 blocks)
    const body1 = this.ctx.getBlock(destX, y, destZ);
    const body2 = this.ctx.getBlock(destX, y + 1, destZ);

    if (!this.ctx.canWalkThrough(body1)) return;
    if (!this.ctx.canWalkThrough(body2)) return;

    // Calculate cost
    let cost = 4.633; // WALK_ONE_BLOCK_COST

    // Apply sprint multiplier if allowed
    if (this.ctx.allowSprint) {
      cost *= 0.769; // SPRINT_MULTIPLIER
    }

    // Apply favoring
    cost *= this.ctx.getFavoring(destX, y, destZ);

    neighbors.push({
      x: destX,
      y: y,
      z: destZ,
      moveCost: cost,
      hash: `${destX},${y},${destZ}`
    });
  }

  /**
   * Check ascend movement (jump up 1 block)
   */
  private checkAscend(
    x: number, y: number, z: number,
    dx: number, dz: number,
    neighbors: NeighborMove[]
  ): void {
    const destX = x + dx;
    const destY = y + 1;
    const destZ = z + dz;

    // Check destination floor
    const floor = this.ctx.getBlock(destX, y, destZ);
    if (!this.ctx.canWalkOn(floor)) return;

    // Check head space at current position
    const headSpace = this.ctx.getBlock(x, y + 2, z);
    if (!this.ctx.canWalkThrough(headSpace)) return;

    // Check body space at destination (2 blocks above floor)
    const body1 = this.ctx.getBlock(destX, destY, destZ);
    const body2 = this.ctx.getBlock(destX, destY + 1, destZ);

    if (!this.ctx.canWalkThrough(body1)) return;
    if (!this.ctx.canWalkThrough(body2)) return;

    // Calculate cost (walk + jump)
    let cost = 4.633 + 2.0 + this.ctx.jumpPenalty;

    // Apply favoring
    cost *= this.ctx.getFavoring(destX, destY, destZ);

    neighbors.push({
      x: destX,
      y: destY,
      z: destZ,
      moveCost: cost,
      hash: `${destX},${destY},${destZ}`
    });
  }

  /**
   * Check descend movement (drop down 1 block)
   */
  private checkDescend(
    x: number, y: number, z: number,
    dx: number, dz: number,
    neighbors: NeighborMove[]
  ): void {
    const destX = x + dx;
    const destY = y - 1;
    const destZ = z + dz;

    // Check destination floor
    const floor = this.ctx.getBlock(destX, destY - 1, destZ);
    if (!this.ctx.canWalkOn(floor)) {
      // Check for extended fall
      this.checkExtendedFall(x, y, z, dx, dz, neighbors);
      return;
    }

    // Check body space at destination
    const body1 = this.ctx.getBlock(destX, destY, destZ);
    const body2 = this.ctx.getBlock(destX, destY + 1, destZ);

    if (!this.ctx.canWalkThrough(body1)) return;
    if (!this.ctx.canWalkThrough(body2)) return;

    // Also check intermediate space (where we step)
    const step1 = this.ctx.getBlock(destX, y, destZ);
    const step2 = this.ctx.getBlock(destX, y + 1, destZ);

    if (!this.ctx.canWalkThrough(step1)) return;
    if (!this.ctx.canWalkThrough(step2)) return;

    // Calculate cost
    let cost = 4.633 + 4.0; // Walk + fall cost

    // Apply favoring
    cost *= this.ctx.getFavoring(destX, destY, destZ);

    neighbors.push({
      x: destX,
      y: destY,
      z: destZ,
      moveCost: cost,
      hash: `${destX},${destY},${destZ}`
    });
  }

  /**
   * Check extended fall (multiple blocks)
   */
  private checkExtendedFall(
    x: number, y: number, z: number,
    dx: number, dz: number,
    neighbors: NeighborMove[]
  ): void {
    const destX = x + dx;
    const destZ = z + dz;

    // Find landing position
    let landY = y - 2;
    const maxFall = 4; // Maximum safe fall without water

    for (let fall = 2; fall <= maxFall; fall++) {
      landY = y - fall;

      const floor = this.ctx.getBlock(destX, landY - 1, destZ);

      // Check for water landing
      if (this.ctx.isWater(floor)) {
        // Can fall into water safely
        const fallCost = fall * 4.0;
        neighbors.push({
          x: destX,
          y: landY,
          z: destZ,
          moveCost: 4.633 + fallCost,
          hash: `${destX},${landY},${destZ}`
        });
        return;
      }

      if (this.ctx.canWalkOn(floor)) {
        // Check body space at landing
        const body1 = this.ctx.getBlock(destX, landY, destZ);
        const body2 = this.ctx.getBlock(destX, landY + 1, destZ);

        if (!this.ctx.canWalkThrough(body1)) return;
        if (!this.ctx.canWalkThrough(body2)) return;

        // Calculate fall cost with damage
        const fallCost = fall * 4.0;
        const damageCost = fall > 3 ? (fall - 3) * 10 : 0;

        neighbors.push({
          x: destX,
          y: landY,
          z: destZ,
          moveCost: 4.633 + fallCost + damageCost,
          hash: `${destX},${landY},${destZ}`
        });
        return;
      }

      // Check if passable for continued fall
      const block = this.ctx.getBlock(destX, landY, destZ);
      if (!this.ctx.canWalkThrough(block)) return;
    }
  }

  /**
   * Check diagonal movement
   */
  private checkDiagonal(
    x: number, y: number, z: number,
    dx: number, dz: number,
    neighbors: NeighborMove[]
  ): void {
    const destX = x + dx;
    const destZ = z + dz;

    // Check destination floor
    const floor = this.ctx.getBlock(destX, y - 1, destZ);
    if (!this.ctx.canWalkOn(floor)) return;

    // Check body space at destination
    const body1 = this.ctx.getBlock(destX, y, destZ);
    const body2 = this.ctx.getBlock(destX, y + 1, destZ);

    if (!this.ctx.canWalkThrough(body1)) return;
    if (!this.ctx.canWalkThrough(body2)) return;

    // Check corner clearance (both paths around the corner)
    const corner1Clear = this.ctx.canWalkThrough(this.ctx.getBlock(x + dx, y, z)) &&
                         this.ctx.canWalkThrough(this.ctx.getBlock(x + dx, y + 1, z));
    const corner2Clear = this.ctx.canWalkThrough(this.ctx.getBlock(x, y, z + dz)) &&
                         this.ctx.canWalkThrough(this.ctx.getBlock(x, y + 1, z + dz));

    if (!corner1Clear && !corner2Clear) return;

    // Calculate cost (sqrt(2) for diagonal)
    let cost = 4.633 * Math.SQRT2;

    // Apply sprint multiplier if allowed and can sprint (not edging)
    if (this.ctx.allowSprint && corner1Clear && corner2Clear) {
      cost *= 0.769;
    }

    // Apply favoring
    cost *= this.ctx.getFavoring(destX, y, destZ);

    neighbors.push({
      x: destX,
      y: y,
      z: destZ,
      moveCost: cost,
      hash: `${destX},${y},${destZ}`
    });
  }

  /**
   * Check pillar movement (tower up)
   */
  private checkPillar(
    x: number, y: number, z: number,
    neighbors: NeighborMove[]
  ): void {
    if (!this.ctx.canPlace) return;

    const destY = y + 1;

    // Check head space
    const headSpace = this.ctx.getBlock(x, y + 2, z);
    if (!this.ctx.canWalkThrough(headSpace)) return;

    // Check if standing on climbable (ladder/vine)
    const standingOn = this.ctx.getBlock(x, y - 1, z);
    const currentBlock = this.ctx.getBlock(x, y, z);

    // Check if on ladder/vine
    if (currentBlock && (currentBlock.name === 'ladder' || currentBlock.name === 'vine')) {
      // Can climb up
      neighbors.push({
        x: x,
        y: destY,
        z: z,
        moveCost: 6.667, // LADDER_UP_ONE_COST
        hash: `${x},${destY},${z}`
      });
      return;
    }

    // Need to place a block
    let cost = 4.633 + 4.0 + this.ctx.jumpPenalty; // Walk + place + jump

    neighbors.push({
      x: x,
      y: destY,
      z: z,
      moveCost: cost,
      hash: `${x},${destY},${z}`,
      toPlace: [{ x, y, z }]
    });
  }

  /**
   * Check downward movement (mine down)
   */
  private checkDownward(
    x: number, y: number, z: number,
    neighbors: NeighborMove[]
  ): void {
    if (!this.ctx.canDig) return;

    const destY = y - 1;

    // Check block below
    const blockBelow = this.ctx.getBlock(x, y - 1, z);
    if (!blockBelow) return;

    // Check floor below that
    const floor = this.ctx.getBlock(x, y - 2, z);
    if (!this.ctx.canWalkOn(floor)) return;

    // Calculate cost including mining
    const breakTime = this.ctx.getBreakTime(blockBelow);
    if (breakTime >= COST_INF) return;

    let cost = breakTime + 4.0; // Mining + fall

    neighbors.push({
      x: x,
      y: destY,
      z: z,
      moveCost: cost,
      hash: `${x},${destY},${z}`,
      toBreak: [{ x, y: y - 1, z }]
    });
  }

  /**
   * Check parkour movement (long jump)
   */
  private checkParkour(
    x: number, y: number, z: number,
    dx: number, dz: number,
    neighbors: NeighborMove[]
  ): void {
    // Check we're not starting from water
    const currentBlock = this.ctx.getBlock(x, y, z);
    if (this.ctx.isWater(currentBlock)) return;

    // Check head clearance
    const headSpace = this.ctx.getBlock(x, y + 2, z);
    if (!this.ctx.canWalkThrough(headSpace)) return;

    // Check gap (must be empty for parkour)
    const gap1 = this.ctx.getBlock(x + dx, y, z + dz);
    const gap2 = this.ctx.getBlock(x + dx, y - 1, z + dz);
    if (this.ctx.canWalkOn(gap2) || !this.ctx.canWalkThrough(gap1)) return;

    const maxDist = this.ctx.allowSprint ? 4 : 2;

    for (let dist = 2; dist <= maxDist; dist++) {
      const destX = x + dx * dist;
      const destZ = z + dz * dist;

      // Check landing
      const landing = this.ctx.getBlock(destX, y - 1, destZ);
      if (!this.ctx.canWalkOn(landing)) continue;

      // Check body space
      const body1 = this.ctx.getBlock(destX, y, destZ);
      const body2 = this.ctx.getBlock(destX, y + 1, destZ);
      if (!this.ctx.canWalkThrough(body1) || !this.ctx.canWalkThrough(body2)) continue;

      // Check path clearance
      let clearPath = true;
      for (let d = 1; d < dist; d++) {
        const midX = x + dx * d;
        const midZ = z + dz * d;
        const mid1 = this.ctx.getBlock(midX, y, midZ);
        const mid2 = this.ctx.getBlock(midX, y + 1, midZ);
        if (!this.ctx.canWalkThrough(mid1) || !this.ctx.canWalkThrough(mid2)) {
          clearPath = false;
          break;
        }
      }

      if (!clearPath) break;

      // Calculate cost
      let cost = (dist === 4 ? 3.564 : 4.633) * dist + this.ctx.jumpPenalty;

      neighbors.push({
        x: destX,
        y: y,
        z: destZ,
        moveCost: cost,
        hash: `${destX},${y},${destZ}`,
        parkour: true
      });

      break; // Only consider first valid landing
    }
  }

  /**
   * Check swim up movement
   */
  private checkSwimUp(
    x: number, y: number, z: number,
    neighbors: NeighborMove[]
  ): void {
    const destY = y + 1;

    // Check destination is water or air (surfacing)
    const destBlock = this.ctx.getBlock(x, destY, z);
    if (!destBlock) return;

    // Can swim up if destination is water or air
    if (!this.ctx.isWater(destBlock) && !this.ctx.canWalkThrough(destBlock)) return;

    // Cost: SWIM_UP_ONE_COST = 20 / 3.0 ≈ 6.667 ticks
    const cost = 6.667 * this.ctx.getFavoring(x, destY, z);

    neighbors.push({
      x: x,
      y: destY,
      z: z,
      moveCost: cost,
      hash: `${x},${destY},${z}`
    });
  }

  /**
   * Check swim down movement
   */
  private checkSwimDown(
    x: number, y: number, z: number,
    neighbors: NeighborMove[]
  ): void {
    const destY = y - 1;

    // Check destination is water
    const destBlock = this.ctx.getBlock(x, destY, z);
    if (!destBlock || !this.ctx.isWater(destBlock)) return;

    // Cost: SWIM_DOWN_ONE_COST = 20 / 8.0 = 2.5 ticks
    const cost = 2.5 * this.ctx.getFavoring(x, destY, z);

    neighbors.push({
      x: x,
      y: destY,
      z: z,
      moveCost: cost,
      hash: `${x},${destY},${z}`
    });
  }

  /**
   * Check horizontal swimming movement
   */
  private checkSwimHorizontal(
    x: number, y: number, z: number,
    dx: number, dz: number,
    neighbors: NeighborMove[]
  ): void {
    const destX = x + dx;
    const destZ = z + dz;

    // Check destination is water
    const destBlock = this.ctx.getBlock(destX, y, destZ);
    if (!destBlock || !this.ctx.isWater(destBlock)) return;

    // Cost: WALK_ONE_IN_WATER_COST ≈ 9.091 ticks
    const cost = 9.091 * this.ctx.getFavoring(destX, y, destZ);

    neighbors.push({
      x: destX,
      y: y,
      z: destZ,
      moveCost: cost,
      hash: `${destX},${y},${destZ}`
    });
  }

  /**
   * Check water exit movement (from water to land)
   */
  private checkWaterExit(
    x: number, y: number, z: number,
    dx: number, dz: number,
    neighbors: NeighborMove[]
  ): void {
    const destX = x + dx;
    const destZ = z + dz;

    // Check destination floor (must be able to stand)
    const floor = this.ctx.getBlock(destX, y - 1, destZ);
    if (!this.ctx.canWalkOn(floor)) return;

    // Check destination body space (must not be water and must be passable)
    const body1 = this.ctx.getBlock(destX, y, destZ);
    const body2 = this.ctx.getBlock(destX, y + 1, destZ);

    if (this.ctx.isWater(body1)) return; // Still in water
    if (!this.ctx.canWalkThrough(body1)) return;
    if (!this.ctx.canWalkThrough(body2)) return;

    // Cost: swim + walk
    const cost = (4.633 + 4.5) * this.ctx.getFavoring(destX, y, destZ);

    neighbors.push({
      x: destX,
      y: y,
      z: destZ,
      moveCost: cost,
      hash: `${destX},${y},${destZ}`
    });
  }

  /**
   * Check water entry movement (from land to water)
   */
  private checkWaterEntry(
    x: number, y: number, z: number,
    dx: number, dz: number,
    neighbors: NeighborMove[]
  ): void {
    const destX = x + dx;
    const destZ = z + dz;

    // Check destination is water
    const destBlock = this.ctx.getBlock(destX, y, destZ);
    if (!destBlock || !this.ctx.isWater(destBlock)) return;

    // Check head space at destination
    const head = this.ctx.getBlock(destX, y + 1, destZ);
    if (!this.ctx.canWalkThrough(head) && !this.ctx.isWater(head)) return;

    // Cost: walk + swim
    const cost = (4.633 + 4.5) * this.ctx.getFavoring(destX, y, destZ);

    neighbors.push({
      x: destX,
      y: y,
      z: destZ,
      moveCost: cost,
      hash: `${destX},${y},${destZ}`
    });
  }

  /**
   * Check door/fence gate/trapdoor movement
   */
  private checkDoor(
    x: number, y: number, z: number,
    dx: number, dz: number,
    neighbors: NeighborMove[]
  ): void {
    const midX = x + dx;
    const midZ = z + dz;
    const destX = x + dx * 2;
    const destZ = z + dz * 2;

    // Check if there's a door/gate in the way
    const block = this.ctx.getBlock(midX, y, midZ);
    if (!block) return;

    const blockName = block.name || '';
    const isDoor = blockName.endsWith('_door');
    const isFenceGate = blockName.endsWith('_fence_gate');
    const isTrapdoor = blockName.endsWith('_trapdoor');

    if (!isDoor && !isFenceGate && !isTrapdoor) return;

    // Iron doors require redstone - skip them
    if (blockName === 'iron_door') return;

    // For horizontal doors, we go 2 blocks through
    // For trapdoors, we might go up or down

    if (isTrapdoor) {
      // Check if trapdoor is above or below us
      const trapAbove = this.ctx.getBlock(x, y + 1, z);
      const trapBelow = this.ctx.getBlock(x, y - 1, z);

      if (trapAbove && (trapAbove.name || '').endsWith('_trapdoor')) {
        // Can go up through trapdoor
        const destY = y + 1;
        const headSpace = this.ctx.getBlock(x, y + 2, z);
        if (this.ctx.canWalkThrough(headSpace)) {
          const cost = (4.633 + 2.0) * this.ctx.getFavoring(x, destY, z); // Walk + interact
          neighbors.push({
            x: x,
            y: destY,
            z: z,
            moveCost: cost,
            hash: `${x},${destY},${z}`
          });
        }
      }

      if (trapBelow && (trapBelow.name || '').endsWith('_trapdoor')) {
        // Can go down through trapdoor
        const destY = y - 1;
        const floor = this.ctx.getBlock(x, y - 2, z);
        if (this.ctx.canWalkOn(floor)) {
          const cost = (4.633 + 2.0) * this.ctx.getFavoring(x, destY, z);
          neighbors.push({
            x: x,
            y: destY,
            z: z,
            moveCost: cost,
            hash: `${x},${destY},${z}`
          });
        }
      }
      return;
    }

    // Horizontal doors/gates - destination is 2 blocks away
    // Check destination floor
    const floor = this.ctx.getBlock(destX, y - 1, destZ);
    if (!this.ctx.canWalkOn(floor)) return;

    // Check body space at destination
    const body1 = this.ctx.getBlock(destX, y, destZ);
    const body2 = this.ctx.getBlock(destX, y + 1, destZ);

    if (!this.ctx.canWalkThrough(body1)) return;
    if (!this.ctx.canWalkThrough(body2)) return;

    // Check if door blocks head (for doors that are 2 blocks tall)
    if (isDoor) {
      const doorTop = this.ctx.getBlock(midX, y + 1, midZ);
      if (doorTop && !(doorTop.name || '').endsWith('_door')) {
        if (!this.ctx.canWalkThrough(doorTop)) return;
      }
    }

    // Cost: walk through door (2 blocks) + interact cost
    const cost = (4.633 * 2 + 2.0) * this.ctx.getFavoring(destX, y, destZ);

    neighbors.push({
      x: destX,
      y: y,
      z: destZ,
      moveCost: cost,
      hash: `${destX},${y},${destZ}`
    });
  }

  /**
   * Get squared distance from start
   */
  private getDistFromStartSq(node: PathNode): number {
    const dx = node.x - this.startX;
    const dy = node.y - this.startY;
    const dz = node.z - this.startZ;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Make result object
   */
  private makeResult(status: PathResult['status'], endNode?: PathNode): PathResult {
    // If no end node provided, try to find best partial path using coefficients
    if (!endNode) {
      endNode = this.findBestPartialPath();
    }

    const path = this.reconstructPath(endNode);

    return {
      status,
      path,
      cost: endNode?.cost ?? 0,
      time: performance.now() - this.startTime,
      visitedNodes: this.closedSet.size,
      generatedNodes: this.closedSet.size + this.openSet.getSize()
    };
  }

  /**
   * Find best partial path using multi-coefficient system
   */
  private findBestPartialPath(): PathNode {
    // Try each coefficient in order (lower = more optimal)
    for (let i = 0; i < AStar.COEFFICIENTS.length; i++) {
      const node = this.bestSoFar[i];
      if (node && this.getDistFromStartSq(node) > AStar.MIN_DIST_PATH * AStar.MIN_DIST_PATH) {
        return node;
      }
    }

    // Fall back to node closest to goal
    return this.bestNode;
  }

  /**
   * Reconstruct path from end node
   */
  private reconstructPath(endNode: PathNode | null): PathNode[] {
    const path: PathNode[] = [];
    let current: PathNode | null = endNode;

    while (current) {
      path.push(current);
      current = current.previous;
    }

    return path.reverse();
  }
}

/**
 * Neighbor move data for expansion
 */
interface NeighborMove {
  x: number;
  y: number;
  z: number;
  moveCost: number;
  hash: string;
  toBreak?: { x: number; y: number; z: number }[];
  toPlace?: { x: number; y: number; z: number }[];
  parkour?: boolean;
}
