/**
 * MathHelper - Math Utilities
 * Based on BaritonePlus MathsHelper.java and BaritoneHelper.java
 *
 * Provides vector math utilities and pathfinding heuristics.
 */

import { Vec3 } from 'vec3';

// ============================================================================
// Vector Projection Utilities (from MathsHelper.java)
// ============================================================================

/**
 * Project a vector onto another vector
 * @param vec The vector to project
 * @param onto The vector to project onto
 * @param assumeOntoNormalized If true, skip normalizing the 'onto' vector
 * @returns The projected vector
 */
export function projectVector(vec: Vec3, onto: Vec3, assumeOntoNormalized: boolean = false): Vec3 {
  let normalizedOnto = onto;
  if (!assumeOntoNormalized) {
    const length = Math.sqrt(onto.x * onto.x + onto.y * onto.y + onto.z * onto.z);
    if (length === 0) return new Vec3(0, 0, 0);
    normalizedOnto = new Vec3(onto.x / length, onto.y / length, onto.z / length);
  }

  const dotProduct = vec.x * normalizedOnto.x + vec.y * normalizedOnto.y + vec.z * normalizedOnto.z;
  return new Vec3(
    normalizedOnto.x * dotProduct,
    normalizedOnto.y * dotProduct,
    normalizedOnto.z * dotProduct
  );
}

/**
 * Project a vector onto a plane defined by its normal
 * @param vec The vector to project
 * @param normal The normal of the plane
 * @param assumeNormalNormalized If true, skip normalizing the normal vector
 * @returns The projected vector onto the plane
 */
export function projectOntoPlane(vec: Vec3, normal: Vec3, assumeNormalNormalized: boolean = false): Vec3 {
  const projection = projectVector(vec, normal, assumeNormalNormalized);
  return new Vec3(
    vec.x - projection.x,
    vec.y - projection.y,
    vec.z - projection.z
  );
}

// ============================================================================
// Pathfinding Heuristics (from BaritoneHelper.java)
// ============================================================================

/**
 * Calculate Baritone's generic heuristic from start to target position
 * This approximates the movement cost between two points.
 * @param start The starting position
 * @param target The target position
 * @returns The heuristic cost estimate
 */
export function calculateGenericHeuristic(start: Vec3, target: Vec3): number {
  return calculateGenericHeuristicXYZ(
    start.x, start.y, start.z,
    target.x, target.y, target.z
  );
}

/**
 * Calculate Baritone's generic heuristic from start to target coordinates
 * Based on GoalBlock.calculate() from Baritone
 * @returns The heuristic cost estimate
 */
export function calculateGenericHeuristicXYZ(
  xStart: number,
  yStart: number,
  zStart: number,
  xTarget: number,
  yTarget: number,
  zTarget: number
): number {
  const xDiff = xTarget - xStart;
  const yDiffRaw = Math.floor(yTarget) - Math.floor(yStart);
  const yDiff = yDiffRaw < 0 ? yDiffRaw + 1 : yDiffRaw;
  const zDiff = zTarget - zStart;

  // GoalBlock.calculate implementation
  // This is Baritone's heuristic that accounts for diagonal movement
  return goalBlockCalculate(xDiff, yDiff, zDiff);
}

/**
 * Baritone's GoalBlock.calculate implementation
 * Computes movement cost heuristic considering diagonal movement
 */
function goalBlockCalculate(xDiff: number, yDiff: number, zDiff: number): number {
  const x = Math.abs(xDiff);
  const y = Math.abs(yDiff);
  const z = Math.abs(zDiff);

  // Diagonal movement cost is sqrt(2) ~= 1.414
  const SQRT_2 = Math.SQRT2;

  // Calculate the minimum distance considering diagonal movement
  // The heuristic favors diagonal movement when possible
  const diagonal = Math.min(x, z);
  const straight = x + z - 2 * diagonal;

  // Horizontal cost: diagonal * sqrt(2) + straight * 1
  const horizontalCost = diagonal * SQRT_2 + straight;

  // Vertical cost: going up costs more than going down
  // Typically: up = 2.5 blocks of cost, down = 1 block of cost
  const UP_COST = 2.5;
  const DOWN_COST = 1.0;
  const verticalCost = yDiff > 0 ? yDiff * UP_COST : Math.abs(yDiff) * DOWN_COST;

  return horizontalCost + verticalCost;
}

// ============================================================================
// General Math Utilities
// ============================================================================

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linear interpolation between two Vec3 positions
 */
export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return new Vec3(
    lerp(a.x, b.x, t),
    lerp(a.y, b.y, t),
    lerp(a.z, b.z, t)
  );
}

/**
 * Calculate the squared distance between two points (faster than distance)
 */
export function distanceSquared(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Calculate the squared horizontal (XZ) distance between two points
 */
export function distanceSquaredXZ(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return dx * dx + dz * dz;
}

/**
 * Normalize an angle to [-180, 180) degrees
 */
export function normalizeAngle(angle: number): number {
  angle = angle % 360;
  if (angle >= 180) angle -= 360;
  if (angle < -180) angle += 360;
  return angle;
}

/**
 * Calculate the shortest angle difference between two angles (in degrees)
 */
export function angleDifference(a: number, b: number): number {
  return normalizeAngle(b - a);
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate yaw angle from a direction vector (XZ plane)
 */
export function yawFromDirection(dx: number, dz: number): number {
  return toDegrees(Math.atan2(-dx, dz));
}

/**
 * Calculate pitch angle from a direction vector
 */
export function pitchFromDirection(dx: number, dy: number, dz: number): number {
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  return toDegrees(-Math.atan2(dy, horizontalDistance));
}

/**
 * Get direction vector from yaw and pitch (in degrees)
 */
export function directionFromAngles(yaw: number, pitch: number): Vec3 {
  const yawRad = toRadians(yaw);
  const pitchRad = toRadians(pitch);
  const cosPitch = Math.cos(pitchRad);

  return new Vec3(
    -Math.sin(yawRad) * cosPitch,
    -Math.sin(pitchRad),
    Math.cos(yawRad) * cosPitch
  );
}

export default {
  projectVector,
  projectOntoPlane,
  calculateGenericHeuristic,
  calculateGenericHeuristicXYZ,
  clamp,
  lerp,
  lerpVec3,
  distanceSquared,
  distanceSquaredXZ,
  normalizeAngle,
  angleDifference,
  toRadians,
  toDegrees,
  yawFromDirection,
  pitchFromDirection,
  directionFromAngles,
};
