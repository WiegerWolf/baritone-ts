import { Vec3 } from 'vec3';
import { Goal } from '../types';

/**
 * Projectile data for GoalDodgeProjectiles
 */
export interface ProjectileData {
  position: Vec3;
  velocity: Vec3;
  gravity: number;
}

/**
 * Projectile supplier type for GoalDodgeProjectiles
 */
export type ProjectileSupplier = () => ProjectileData[];

/**
 * GoalDodgeProjectiles - Goal to avoid incoming projectiles
 * Based on BaritonePlus GoalDodgeProjectiles.java
 *
 * Uses projectile physics to calculate closest approach points
 * and penalizes positions near predicted impact locations.
 */
export class GoalDodgeProjectiles implements Goal {
  private cachedHits: Map<ProjectileData, Vec3> = new Map();
  private lastCacheTime: number = 0;
  private readonly CACHE_TTL = 50; // ms

  constructor(
    public readonly getProjectiles: ProjectileSupplier,
    public readonly distanceHorizontal: number = 3,
    public readonly distanceVertical: number = 3
  ) {}

  isEnd(x: number, y: number, z: number): boolean {
    const projectiles = this.getProjectiles();
    const pos = new Vec3(x, y, z);

    for (const proj of projectiles) {
      if (!proj) continue;

      const hit = this.getCachedHit(proj, pos);
      if (this.isHitCloseEnough(hit, pos)) {
        return false;
      }
    }

    return true;
  }

  heuristic(x: number, y: number, z: number): number {
    const pos = new Vec3(x, y, z);
    let costFactor = 0;

    const projectiles = this.getProjectiles();
    for (const proj of projectiles) {
      if (!proj) continue;

      const hit = this.getCachedHit(proj, pos);

      // Calculate penalty based on distance to projectile's trajectory
      const flatDistSq = this.getFlatDistanceSqr(
        proj.position.x, proj.position.z,
        proj.velocity.x, proj.velocity.z,
        pos.x, pos.z
      );

      if (this.isHitCloseEnough(hit, pos)) {
        costFactor += flatDistSq;
      }
    }

    // Negative because we want to AVOID these positions
    return -costFactor;
  }

  /**
   * Get cached closest approach or calculate new
   */
  private getCachedHit(proj: ProjectileData, targetPos: Vec3): Vec3 {
    const now = Date.now();

    // Clear cache periodically
    if (now - this.lastCacheTime > this.CACHE_TTL) {
      this.cachedHits.clear();
      this.lastCacheTime = now;
    }

    let hit = this.cachedHits.get(proj);
    if (!hit) {
      hit = this.calculateClosestApproach(proj, targetPos);
      this.cachedHits.set(proj, hit);
    }

    return hit;
  }

  /**
   * Calculate closest approach point of projectile to target
   */
  private calculateClosestApproach(proj: ProjectileData, targetPos: Vec3): Vec3 {
    // Simplified projectile motion:
    // p(t) = p0 + v*t + 0.5*g*t^2 (for y-component only)
    // Find t that minimizes distance to target

    const { position: p0, velocity: v, gravity: g } = proj;

    // For XZ plane, projectile moves linearly
    // For Y, we have parabolic motion

    // Time to closest XZ approach:
    const dx = targetPos.x - p0.x;
    const dz = targetPos.z - p0.z;
    const vxz = Math.sqrt(v.x * v.x + v.z * v.z);

    if (vxz < 0.01) {
      // Projectile not moving horizontally
      return p0.clone();
    }

    // Time to reach same XZ plane as target
    const dotXZ = (dx * v.x + dz * v.z) / (vxz * vxz);
    const t = Math.max(0, dotXZ);

    // Position at time t
    return new Vec3(
      p0.x + v.x * t,
      p0.y + v.y * t - 0.5 * g * t * t,
      p0.z + v.z * t
    );
  }

  /**
   * Check if hit point is close enough to be dangerous
   */
  private isHitCloseEnough(hit: Vec3, target: Vec3): boolean {
    const dx = target.x - hit.x;
    const dz = target.z - hit.z;
    const horizontalSq = dx * dx + dz * dz;
    const vertical = Math.abs(target.y - hit.y);

    return horizontalSq < this.distanceHorizontal * this.distanceHorizontal &&
           vertical < this.distanceVertical;
  }

  /**
   * Calculate squared distance from a point to a line in XZ plane
   */
  private getFlatDistanceSqr(
    px: number, pz: number,  // Projectile position
    vx: number, vz: number,  // Projectile velocity
    tx: number, tz: number   // Target position
  ): number {
    // Distance from point to line
    const velLenSq = vx * vx + vz * vz;
    if (velLenSq < 0.01) {
      // No velocity - just return distance to projectile
      const ddx = tx - px;
      const ddz = tz - pz;
      return ddx * ddx + ddz * ddz;
    }

    // Using cross product for point-to-line distance
    const dx = tx - px;
    const dz = tz - pz;

    // Cross product magnitude (2D)
    const cross = Math.abs(dx * vz - dz * vx);

    // Distance = |cross| / |velocity|
    return (cross * cross) / velLenSq;
  }
}
