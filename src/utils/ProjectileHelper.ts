/**
 * ProjectileHelper - Projectile Motion Mathematics
 * Based on AltoClef/BaritonePlus ProjectileHelper.java
 *
 * Provides utilities for:
 * - Calculating projectile trajectories
 * - Predicting projectile intercepts
 * - Calculating throw angles
 */

import { Vec3 } from 'vec3';

/**
 * Gravity constants for different projectile types
 */
export const ARROW_GRAVITY_ACCEL = 0.05000000074505806;
export const THROWN_ENTITY_GRAVITY_ACCEL = 0.03;
export const FIREBALL_GRAVITY_ACCEL = 0; // Fireballs have no gravity

/**
 * Projectile types with their gravity values
 */
export enum ProjectileType {
  ARROW = 'arrow',
  THROWN = 'thrown',
  FIREBALL = 'fireball',
  ENDER_PEARL = 'ender_pearl',
  SNOWBALL = 'snowball',
  EGG = 'egg',
  POTION = 'potion',
  TRIDENT = 'trident',
}

/**
 * Gravity values for projectile types
 */
export const PROJECTILE_GRAVITY: Record<ProjectileType, number> = {
  [ProjectileType.ARROW]: ARROW_GRAVITY_ACCEL,
  [ProjectileType.THROWN]: THROWN_ENTITY_GRAVITY_ACCEL,
  [ProjectileType.FIREBALL]: 0,
  [ProjectileType.ENDER_PEARL]: THROWN_ENTITY_GRAVITY_ACCEL,
  [ProjectileType.SNOWBALL]: THROWN_ENTITY_GRAVITY_ACCEL,
  [ProjectileType.EGG]: THROWN_ENTITY_GRAVITY_ACCEL,
  [ProjectileType.POTION]: THROWN_ENTITY_GRAVITY_ACCEL,
  [ProjectileType.TRIDENT]: 0.05,
};

/**
 * Cached projectile data for tracking
 */
export interface CachedProjectile {
  position: Vec3;
  velocity: Vec3;
  gravity: number;
  type?: ProjectileType;
}

/**
 * Check if a projectile type has gravity
 * @param type The projectile type
 */
export function hasGravity(type: ProjectileType): boolean {
  return PROJECTILE_GRAVITY[type] > 0;
}

/**
 * Get the closest point on a flat (XZ) trajectory line to a target position
 * @param shootX Starting X position
 * @param shootZ Starting Z position
 * @param velX Velocity in X direction
 * @param velZ Velocity in Z direction
 * @param playerX Target X position
 * @param playerZ Target Z position
 * @returns The closest point on the trajectory (Y = 0)
 */
export function getClosestPointOnFlatLine(
  shootX: number,
  shootZ: number,
  velX: number,
  velZ: number,
  playerX: number,
  playerZ: number
): Vec3 {
  const deltaX = playerX - shootX;
  const deltaZ = playerZ - shootZ;

  // Calculus: minimize distance function, solve for t
  // d/dt[(shootX + velX*t - playerX)^2 + (shootZ + velZ*t - playerZ)^2] = 0
  const t = (velX * deltaX + velZ * deltaZ) / (velX * velX + velZ * velZ);

  const hitX = shootX + velX * t;
  const hitZ = shootZ + velZ * t;

  return new Vec3(hitX, 0, hitZ);
}

/**
 * Get the squared flat (XZ) distance from a trajectory to a target
 * @param shootX Starting X
 * @param shootZ Starting Z
 * @param velX Velocity X
 * @param velZ Velocity Z
 * @param playerX Target X
 * @param playerZ Target Z
 */
export function getFlatDistanceSquared(
  shootX: number,
  shootZ: number,
  velX: number,
  velZ: number,
  playerX: number,
  playerZ: number
): number {
  const closest = getClosestPointOnFlatLine(shootX, shootZ, velX, velZ, playerX, playerZ);
  const dx = closest.x - playerX;
  const dz = closest.z - playerZ;
  return dx * dx + dz * dz;
}

/**
 * Calculate the height of a projectile at a given horizontal distance
 * @param gravity Gravity acceleration
 * @param horizontalVel Initial horizontal velocity
 * @param verticalVel Initial vertical velocity
 * @param initialHeight Starting height
 * @param distanceTraveled Horizontal distance traveled
 * @returns Height at the given distance
 */
export function getProjectileHeight(
  gravity: number,
  horizontalVel: number,
  verticalVel: number,
  initialHeight: number,
  distanceTraveled: number
): number {
  if (horizontalVel === 0) return initialHeight;

  const time = distanceTraveled / horizontalVel;
  // y = y0 + v0*t - 0.5*g*t^2
  return initialHeight + verticalVel * time - 0.5 * gravity * time * time;
}

/**
 * Calculate where a projectile will be at its closest approach to a target
 * @param shootOrigin Starting position
 * @param shootVelocity Initial velocity
 * @param yGravity Gravity acceleration in Y direction
 * @param playerOrigin Target position
 * @returns The predicted intercept point
 */
export function calculateArrowClosestApproach(
  shootOrigin: Vec3,
  shootVelocity: Vec3,
  yGravity: number,
  playerOrigin: Vec3
): Vec3 {
  // Find the XZ point where trajectory is closest
  const flatEncounter = getClosestPointOnFlatLine(
    shootOrigin.x,
    shootOrigin.z,
    shootVelocity.x,
    shootVelocity.z,
    playerOrigin.x,
    playerOrigin.z
  );

  // Calculate horizontal distance to that point
  const dx = flatEncounter.x - shootOrigin.x;
  const dz = flatEncounter.z - shootOrigin.z;
  const encounterDistanceTraveled = Math.sqrt(dx * dx + dz * dz);

  // Calculate horizontal and vertical velocity components
  const horizontalVel = Math.sqrt(
    shootVelocity.x * shootVelocity.x + shootVelocity.z * shootVelocity.z
  );
  const verticalVel = shootVelocity.y;
  const initialHeight = shootOrigin.y;

  // Calculate height at encounter point
  const hitHeight = getProjectileHeight(
    yGravity,
    horizontalVel,
    verticalVel,
    initialHeight,
    encounterDistanceTraveled
  );

  return new Vec3(flatEncounter.x, hitHeight, flatEncounter.z);
}

/**
 * Calculate closest approach using a CachedProjectile
 */
export function calculateProjectileClosestApproach(
  projectile: CachedProjectile,
  targetPos: Vec3
): Vec3 {
  return calculateArrowClosestApproach(
    projectile.position,
    projectile.velocity,
    projectile.gravity,
    targetPos
  );
}

/**
 * Calculate the required launch angles for projectile motion
 * Returns [low angle, high angle] in degrees
 *
 * @param launchHeight Height difference (positive = launching down)
 * @param launchTargetDistance Horizontal distance to target
 * @param launchVelocity Initial velocity magnitude
 * @param gravity Gravity acceleration
 * @returns [low angle, high angle] or [45, 45] if unreachable
 */
export function calculateAnglesForSimpleProjectileMotion(
  launchHeight: number,
  launchTargetDistance: number,
  launchVelocity: number,
  gravity: number
): [number, number] {
  // Using projectile motion formula:
  // tan(theta) = (v^2 +/- sqrt(v^4 - g(gx^2 + 2yv^2))) / (gx)
  // where x = distance, y = -height (height is measured down), v = velocity, g = gravity

  const v = launchVelocity;
  const g = gravity;
  const x = launchTargetDistance;
  const y = -launchHeight;

  const root = v * v * v * v - g * (g * x * x + 2 * y * v * v);

  if (root < 0) {
    // Imaginary root means not enough power
    // Return 45 degrees as the optimal angle for maximum distance
    return [45, 45];
  }

  const sqrtRoot = Math.sqrt(root);
  const tanTheta0 = (v * v + sqrtRoot) / (g * x);
  const tanTheta1 = (v * v - sqrtRoot) / (g * x);

  const angle0 = Math.atan(tanTheta0) * (180 / Math.PI);
  const angle1 = Math.atan(tanTheta1) * (180 / Math.PI);

  // Return [smaller angle, larger angle]
  return [Math.min(angle0, angle1), Math.max(angle0, angle1)];
}

/**
 * Get the throw origin for an entity (slightly below position)
 * @param entityPos Entity position
 * @returns The throw origin position
 */
export function getThrowOrigin(entityPos: Vec3): Vec3 {
  // Minecraft magic number: thrown items start 0.1 blocks below position
  return entityPos.offset(0, -0.1, 0);
}

/**
 * Predict future position of a projectile
 * @param projectile The projectile data
 * @param ticksAhead Number of ticks to predict ahead
 * @returns Predicted position
 */
export function predictProjectilePosition(
  projectile: CachedProjectile,
  ticksAhead: number
): Vec3 {
  const t = ticksAhead / 20; // Convert ticks to seconds
  const g = projectile.gravity;

  // x = x0 + vx*t
  // y = y0 + vy*t - 0.5*g*t^2
  // z = z0 + vz*t
  return new Vec3(
    projectile.position.x + projectile.velocity.x * t,
    projectile.position.y + projectile.velocity.y * t - 0.5 * g * t * t,
    projectile.position.z + projectile.velocity.z * t
  );
}

/**
 * Calculate time for a projectile to reach a horizontal distance
 * @param horizontalVel Horizontal velocity magnitude
 * @param distance Target horizontal distance
 * @returns Time in seconds, or Infinity if velocity is 0
 */
export function getTimeToDistance(horizontalVel: number, distance: number): number {
  if (horizontalVel <= 0) return Infinity;
  return distance / horizontalVel;
}

/**
 * Check if a projectile will hit near a target position
 * @param projectile The projectile data
 * @param targetPos Target position
 * @param hitRadius Maximum distance to count as a "hit"
 * @returns True if projectile will pass within hitRadius of target
 */
export function willProjectileHit(
  projectile: CachedProjectile,
  targetPos: Vec3,
  hitRadius: number = 1.0
): boolean {
  const closest = calculateProjectileClosestApproach(projectile, targetPos);
  const distance = closest.distanceTo(targetPos);
  return distance <= hitRadius;
}

/**
 * Calculate velocity needed to hit a target
 * @param origin Launch position
 * @param target Target position
 * @param launchAngle Launch angle in degrees (0-90)
 * @param gravity Gravity acceleration
 * @returns Required initial velocity magnitude, or null if impossible
 */
export function calculateRequiredVelocity(
  origin: Vec3,
  target: Vec3,
  launchAngle: number,
  gravity: number
): number | null {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  const angleRad = launchAngle * (Math.PI / 180);
  const sinAngle = Math.sin(angleRad);
  const cosAngle = Math.cos(angleRad);

  // v = sqrt((g * x^2) / (2 * cos^2(theta) * (x * tan(theta) - y)))
  const denominator = 2 * cosAngle * cosAngle * (distance * Math.tan(angleRad) - dy);

  if (denominator <= 0) {
    return null; // Cannot reach target at this angle
  }

  const vSquared = (gravity * distance * distance) / denominator;
  return Math.sqrt(vSquared);
}

export default {
  ARROW_GRAVITY_ACCEL,
  THROWN_ENTITY_GRAVITY_ACCEL,
  FIREBALL_GRAVITY_ACCEL,
  ProjectileType,
  PROJECTILE_GRAVITY,
  hasGravity,
  getClosestPointOnFlatLine,
  getFlatDistanceSquared,
  getProjectileHeight,
  calculateArrowClosestApproach,
  calculateProjectileClosestApproach,
  calculateAnglesForSimpleProjectileMotion,
  getThrowOrigin,
  predictProjectilePosition,
  getTimeToDistance,
  willProjectileHit,
  calculateRequiredVelocity,
};
