import { PathNode, CalculationContext } from '../types';
import { Vec3 } from 'vec3';

/**
 * PathSmoother optimizes paths by removing unnecessary waypoints
 * Based on Baritone's path optimization techniques
 *
 * Features:
 * - Line-of-sight smoothing
 * - Corner cutting detection
 * - Movement-aware optimization
 */

/**
 * Smooth a path by removing unnecessary waypoints
 * This creates more direct paths while maintaining validity
 */
export function smoothPath(
  path: PathNode[],
  ctx: CalculationContext,
  maxIterations: number = 3
): PathNode[] {
  if (path.length <= 2) return path;

  let smoothed = [...path];

  for (let iter = 0; iter < maxIterations; iter++) {
    const newSmoothed = smoothPathOnce(smoothed, ctx);
    if (newSmoothed.length === smoothed.length) break; // No improvement
    smoothed = newSmoothed;
  }

  return smoothed;
}

/**
 * Single pass of path smoothing
 */
function smoothPathOnce(path: PathNode[], ctx: CalculationContext): PathNode[] {
  if (path.length <= 2) return path;

  const result: PathNode[] = [path[0]];
  let i = 0;

  while (i < path.length - 1) {
    // Try to skip as many nodes as possible while maintaining line of sight
    let furthest = i + 1;

    for (let j = i + 2; j < path.length; j++) {
      if (canDirectlyReach(path[i], path[j], ctx)) {
        furthest = j;
      } else {
        break; // No point checking further
      }
    }

    result.push(path[furthest]);
    i = furthest;
  }

  return result;
}

/**
 * Check if we can directly walk from node A to node B
 * This performs a 3D line-of-sight check with collision detection
 */
function canDirectlyReach(
  from: PathNode,
  to: PathNode,
  ctx: CalculationContext
): boolean {
  // Don't try to shortcut large Y changes
  const dy = to.y - from.y;
  if (Math.abs(dy) > 1) return false;

  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Don't shortcut very long segments (could miss obstacles)
  if (dist > 5) return false;

  // Step along the line and check each position
  const steps = Math.ceil(dist * 2);
  if (steps === 0) return true;

  for (let step = 1; step < steps; step++) {
    const t = step / steps;
    const x = Math.floor(from.x + dx * t);
    const y = from.y + (dy > 0 ? Math.ceil(dy * t) : Math.floor(dy * t));
    const z = Math.floor(from.z + dz * t);

    // Check floor
    const floor = ctx.getBlock(x, y - 1, z);
    if (!ctx.canWalkOn(floor)) return false;

    // Check body space
    const body1 = ctx.getBlock(x, y, z);
    const body2 = ctx.getBlock(x, y + 1, z);
    if (!ctx.canWalkThrough(body1)) return false;
    if (!ctx.canWalkThrough(body2)) return false;
  }

  // Check corners for diagonal movement
  if (Math.abs(dx) > 0 && Math.abs(dz) > 0) {
    // Check that we won't clip through corners
    const signX = Math.sign(dx);
    const signZ = Math.sign(dz);

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const x = Math.floor(from.x + dx * t);
      const z = Math.floor(from.z + dz * t);
      const y = from.y;

      // Check corner blocks
      const corner1 = ctx.getBlock(x + signX, y, z);
      const corner2 = ctx.getBlock(x, y, z + signZ);

      // If both corners are blocked, can't pass diagonally
      if (!ctx.canWalkThrough(corner1) && !ctx.canWalkThrough(corner2)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Simplify path by merging consecutive same-direction movements
 */
export function simplifyPath(path: PathNode[]): PathNode[] {
  if (path.length <= 2) return path;

  const result: PathNode[] = [path[0]];
  let lastDir: { dx: number; dy: number; dz: number } | null = null;

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];

    const dir = {
      dx: Math.sign(curr.x - prev.x),
      dy: Math.sign(curr.y - prev.y),
      dz: Math.sign(curr.z - prev.z)
    };

    // If direction changed, keep this node
    if (!lastDir ||
        dir.dx !== lastDir.dx ||
        dir.dy !== lastDir.dy ||
        dir.dz !== lastDir.dz) {
      if (i > 1) { // Don't add duplicate of first node
        result.push(prev);
      }
      lastDir = dir;
    }
  }

  // Always add last node
  result.push(path[path.length - 1]);

  return result;
}

/**
 * Calculate the total cost of a path
 */
export function calculatePathCost(path: PathNode[]): number {
  if (path.length === 0) return 0;
  return path[path.length - 1].cost;
}

/**
 * Calculate the physical distance of a path
 */
export function calculatePathDistance(path: PathNode[]): number {
  let distance = 0;

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dz = curr.z - prev.z;

    distance += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return distance;
}

/**
 * Check if a path contains a specific position
 */
export function pathContains(path: PathNode[], x: number, y: number, z: number): boolean {
  return path.some(node => node.x === x && node.y === y && node.z === z);
}

/**
 * Find the index of a position in a path, or -1 if not found
 */
export function findInPath(path: PathNode[], x: number, y: number, z: number): number {
  return path.findIndex(node => node.x === x && node.y === y && node.z === z);
}

/**
 * Get a subsection of a path
 */
export function getPathSegment(path: PathNode[], startIndex: number, endIndex: number): PathNode[] {
  return path.slice(startIndex, endIndex + 1);
}

/**
 * Merge two paths at an overlap point
 */
export function mergePaths(first: PathNode[], second: PathNode[]): PathNode[] | null {
  if (first.length === 0) return second;
  if (second.length === 0) return first;

  // Find overlap point
  const firstEnd = first[first.length - 1];
  const secondStart = second[0];

  if (firstEnd.x === secondStart.x &&
      firstEnd.y === secondStart.y &&
      firstEnd.z === secondStart.z) {
    // Direct connection
    return [...first, ...second.slice(1)];
  }

  // Try to find overlap in second path
  for (let i = 0; i < second.length; i++) {
    if (first[first.length - 1].x === second[i].x &&
        first[first.length - 1].y === second[i].y &&
        first[first.length - 1].z === second[i].z) {
      return [...first, ...second.slice(i + 1)];
    }
  }

  return null; // No valid merge point
}
