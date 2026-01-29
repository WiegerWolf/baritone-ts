import type { Entity } from 'prismarine-entity';
import { Goal } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

/**
 * Entity supplier type for GoalRunAwayFromEntities
 */
export type EntitySupplier = () => Entity[];

/**
 * GoalRunAwayFromEntities - Goal to flee from multiple entities
 * Based on BaritonePlus GoalRunAwayFromEntities.java
 *
 * Calculates heuristic based on inverse distance to entities,
 * making positions farther from entities more desirable.
 */
export class GoalRunAwayFromEntities implements Goal {
  constructor(
    public readonly getEntities: EntitySupplier,
    public readonly minDistance: number = 16,
    public readonly xzOnly: boolean = false,
    public readonly penaltyFactor: number = 10
  ) {}

  isEnd(x: number, y: number, z: number): boolean {
    const entities = this.getEntities();
    const minDistSq = this.minDistance * this.minDistance;

    for (const entity of entities) {
      if (!entity || entity.isValid === false) continue;

      let distSq: number;
      if (this.xzOnly) {
        const dx = entity.position.x - x;
        const dz = entity.position.z - z;
        distSq = dx * dx + dz * dz;
      } else {
        const dx = entity.position.x - x;
        const dy = entity.position.y - y;
        const dz = entity.position.z - z;
        distSq = dx * dx + dy * dy + dz * dz;
      }

      if (distSq < minDistSq) {
        return false;
      }
    }

    return true;
  }

  heuristic(x: number, y: number, z: number): number {
    const entities = this.getEntities();
    let costSum = 0;
    let count = 0;
    const maxEntities = 10; // Limit to prevent calculation explosion

    for (const entity of entities) {
      if (count >= maxEntities) break;
      if (!entity || entity.isValid === false) continue;

      const cost = this.getCostOfEntity(entity, x, y, z);
      if (cost !== 0) {
        // Closer entities have bigger weight (1/distance)
        costSum += 1 / cost;
      } else {
        // On top of entity - very bad
        costSum += 1000;
      }

      count++;
    }

    if (count > 0) {
      costSum /= count;
    }

    return costSum * this.penaltyFactor;
  }

  private getCostOfEntity(entity: Entity, x: number, y: number, z: number): number {
    const ex = Math.floor(entity.position.x);
    const ey = Math.floor(entity.position.y);
    const ez = Math.floor(entity.position.z);

    let heuristic = 0;

    if (!this.xzOnly) {
      heuristic += Math.abs(ey - y) * WALK_ONE_BLOCK_COST;
    }

    const dx = ex - x;
    const dz = ez - z;
    heuristic += Math.sqrt(dx * dx + dz * dz) * WALK_ONE_BLOCK_COST;

    return heuristic;
  }
}
