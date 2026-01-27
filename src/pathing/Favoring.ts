import { BlockPos, PathNode } from '../types';

/**
 * Favoring system for path cost multipliers
 *
 * Provides multiplicative modifiers to path costs based on:
 * - Previous path (backtrack penalty)
 * - Dangerous entities (mob avoidance)
 * - Custom exclusion areas
 *
 * Using multiplication instead of addition because:
 * - Multiplicative modifiers scale with path length
 * - If a block is bad, avoiding it gets increasingly valuable on long paths
 * - Additive penalties have constant impact regardless of path length
 */
export class Favoring {
  private favorings: Map<string, number> = new Map();
  private readonly defaultValue: number = 1.0;

  constructor() {}

  /**
   * Apply backtrack penalty to previous path
   * Makes the pathfinder prefer finding new routes over retracing steps
   */
  applyBacktrackPenalty(previousPath: PathNode[], coefficient: number = 1.05): void {
    for (const node of previousPath) {
      const hash = `${node.x},${node.y},${node.z}`;
      const current = this.favorings.get(hash) ?? this.defaultValue;
      this.favorings.set(hash, current * coefficient);
    }
  }

  /**
   * Apply spherical avoidance around a position
   * Used for mob avoidance
   */
  applySpherical(
    center: BlockPos,
    radius: number,
    coefficient: number
  ): void {
    const radiusSq = radius * radius;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq <= radiusSq) {
            const x = center.x + dx;
            const y = center.y + dy;
            const z = center.z + dz;
            const hash = `${x},${y},${z}`;

            // Scale coefficient by distance (closer = higher penalty)
            const distanceFactor = 1 - Math.sqrt(distSq) / radius;
            const scaledCoefficient = 1 + (coefficient - 1) * distanceFactor;

            const current = this.favorings.get(hash) ?? this.defaultValue;
            this.favorings.set(hash, current * scaledCoefficient);
          }
        }
      }
    }
  }

  /**
   * Apply cylindrical avoidance (ignores Y for tall entities)
   */
  applyCylindrical(
    center: BlockPos,
    radius: number,
    height: number,
    coefficient: number
  ): void {
    const radiusSq = radius * radius;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = 0; dy <= height; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const distSq = dx * dx + dz * dz;
          if (distSq <= radiusSq) {
            const x = center.x + dx;
            const y = center.y + dy;
            const z = center.z + dz;
            const hash = `${x},${y},${z}`;

            const current = this.favorings.get(hash) ?? this.defaultValue;
            this.favorings.set(hash, current * coefficient);
          }
        }
      }
    }
  }

  /**
   * Set explicit favoring for a position
   */
  set(x: number, y: number, z: number, coefficient: number): void {
    const hash = `${x},${y},${z}`;
    this.favorings.set(hash, coefficient);
  }

  /**
   * Get favoring multiplier for a position
   */
  get(x: number, y: number, z: number): number {
    const hash = `${x},${y},${z}`;
    return this.favorings.get(hash) ?? this.defaultValue;
  }

  /**
   * Clear all favorings
   */
  clear(): void {
    this.favorings.clear();
  }
}

/**
 * Avoidance configuration for entities
 */
export interface AvoidanceConfig {
  position: BlockPos;
  radius: number;
  coefficient: number;
}

/**
 * Create avoidance configs from nearby entities
 */
export function createAvoidances(
  bot: any, // Mineflayer bot
  playerPosition: BlockPos,
  maxDistance: number = 32
): AvoidanceConfig[] {
  const avoidances: AvoidanceConfig[] = [];

  // Entity type configurations
  const entityConfigs: Record<string, { radius: number; coefficient: number; condition?: (entity: any) => boolean }> = {
    // Hostile mobs
    'zombie': { radius: 8, coefficient: 2.0 },
    'skeleton': { radius: 12, coefficient: 2.5 },  // Can shoot from distance
    'creeper': { radius: 10, coefficient: 3.0 },   // Explosions are bad
    'spider': { radius: 6, coefficient: 1.5, condition: (e) => !isDaytime() },
    'enderman': { radius: 8, coefficient: 2.0, condition: (e) => e.metadata?.[17] ?? false },  // Angry
    'zombie_pigman': { radius: 8, coefficient: 2.0, condition: (e) => isAngry(e) },
    'zombified_piglin': { radius: 8, coefficient: 2.0, condition: (e) => isAngry(e) },
    'witch': { radius: 10, coefficient: 2.0 },
    'blaze': { radius: 12, coefficient: 2.5 },
    'ghast': { radius: 16, coefficient: 2.0 },
    'wither_skeleton': { radius: 8, coefficient: 2.5 },
    'drowned': { radius: 8, coefficient: 2.0 },
    'phantom': { radius: 10, coefficient: 2.0 },
    'ravager': { radius: 10, coefficient: 3.0 },
    'vindicator': { radius: 8, coefficient: 2.5 },
    'evoker': { radius: 12, coefficient: 2.5 },
    'pillager': { radius: 12, coefficient: 2.0 },
    'hoglin': { radius: 8, coefficient: 2.0 },
    'piglin_brute': { radius: 10, coefficient: 2.5 },
    'warden': { radius: 20, coefficient: 5.0 },  // Stay far away!

    // Environmental hazards
    'tnt': { radius: 8, coefficient: 3.0 },
    'primed_tnt': { radius: 8, coefficient: 5.0 },
  };

  // Check daytime (approximation)
  function isDaytime(): boolean {
    // Would need actual time from bot.time.day
    return true;
  }

  // Check if entity is angry
  function isAngry(entity: any): boolean {
    // Check if zombie piglin is angry by checking target
    return entity.target != null;
  }

  if (!bot.entities) return avoidances;

  for (const entity of Object.values(bot.entities) as any[]) {
    // Skip self
    if (entity === bot.entity) continue;

    // Skip if too far
    if (!entity.position) continue;
    const entityPos = new BlockPos(
      Math.floor(entity.position.x),
      Math.floor(entity.position.y),
      Math.floor(entity.position.z)
    );

    if (entityPos.distanceSquared(playerPosition) > maxDistance * maxDistance) {
      continue;
    }

    // Check if we have config for this entity type
    const config = entityConfigs[entity.name ?? entity.type];
    if (!config) continue;

    // Check condition if specified
    if (config.condition && !config.condition(entity)) continue;

    avoidances.push({
      position: entityPos,
      radius: config.radius,
      coefficient: config.coefficient
    });
  }

  return avoidances;
}

/**
 * Build favoring map from avoidances
 */
export function buildFavoring(
  previousPath?: PathNode[],
  avoidances?: AvoidanceConfig[],
  backtrackCoefficient: number = 1.05
): Favoring {
  const favoring = new Favoring();

  // Apply backtrack penalty
  if (previousPath && previousPath.length > 0) {
    favoring.applyBacktrackPenalty(previousPath, backtrackCoefficient);
  }

  // Apply mob avoidances
  if (avoidances) {
    for (const avoidance of avoidances) {
      favoring.applySpherical(
        avoidance.position,
        avoidance.radius,
        avoidance.coefficient
      );
    }
  }

  return favoring;
}
