/**
 * FleeFromEntitiesTask - Run Away From Entities
 * Based on AltoClef/BaritonePlus RunAwayFromEntitiesTask.java
 *
 * Tasks for fleeing from dangerous entities:
 * - RunAwayFromEntitiesTask: Flee from entities matching criteria
 * - RunAwayFromHostilesTask: Flee from hostile mobs
 * - RunAwayFromPlayersTask: Flee from player entities
 *
 * These tasks calculate the optimal flee direction and navigate
 * away from threats.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { defaultGroundedShouldForce } from '../interfaces';
import { GoToNearTask } from './GoToTask';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';
import { isHostileMob } from '../../utils/EntityHelper';

/**
 * Interface for tasks that require being grounded
 */
interface ITaskRequiresGroundedLocal {
  readonly requiresGrounded: boolean;
  shouldForce(interruptingCandidate: ITask | null): boolean;
}

/**
 * Entity supplier function type
 */
export type EntitySupplier = () => Entity[];

/**
 * RunAwayFromEntitiesTask - Flee from a set of entities
 *
 * Intent: When the bot is threatened by entities (hostile mobs,
 * dangerous players, etc.), this task calculates the best direction
 * to run and navigates away.
 *
 * The flee direction is calculated by summing the inverse vectors
 * from each threat entity, weighted by their distance.
 */
export class RunAwayFromEntitiesTask extends Task implements ITaskRequiresGroundedLocal {
  readonly requiresGrounded = true;

  protected entitySupplier: EntitySupplier;
  protected distanceToRun: number;
  private useXZOnly: boolean;
  private penaltyFactor: number;

  private progressChecker: MovementProgressChecker;
  private fleeTarget: Vec3 | null = null;

  /**
   * @param bot The mineflayer bot
   * @param entitySupplier Function that returns entities to flee from
   * @param distanceToRun Distance to maintain from entities
   * @param xzOnly If true, only consider horizontal distance
   * @param penalty Penalty factor for entities (higher = stronger flee)
   */
  constructor(
    bot: Bot,
    entitySupplier: EntitySupplier,
    distanceToRun: number = 15,
    xzOnly: boolean = false,
    penalty: number = 1.0
  ) {
    super(bot);
    this.entitySupplier = entitySupplier;
    this.distanceToRun = distanceToRun;
    this.useXZOnly = xzOnly;
    this.penaltyFactor = penalty;
    this.progressChecker = new MovementProgressChecker(bot);
  }

  shouldForce(interruptingCandidate: ITask | null): boolean {
    return defaultGroundedShouldForce(this.bot, interruptingCandidate);
  }

  get displayName(): string {
    return `RunAway(${this.distanceToRun}m)`;
  }

  onStart(): void {
    this.progressChecker.reset();
    this.fleeTarget = null;
  }

  onTick(): Task | null {
    const entities = this.entitySupplier();

    // Check if we're safe
    if (this.isSafeFromEntities(entities)) {
      return null;
    }

    // Calculate flee direction
    const fleeDir = this.calculateFleeDirection(entities);
    if (!fleeDir) {
      // No clear flee direction - just run
      this.bot.setControlState('forward', true);
      this.bot.setControlState('sprint', true);
      return null;
    }

    // Calculate target position
    const playerPos = this.bot.entity.position;
    this.fleeTarget = playerPos.plus(fleeDir.scaled(this.distanceToRun));

    // Check progress
    this.progressChecker.setProgress(playerPos);
    if (this.progressChecker.failed()) {
      // Not making progress - try different direction
      this.progressChecker.reset();
      const randomAngle = Math.random() * Math.PI * 2;
      const randomDir = new Vec3(Math.cos(randomAngle), 0, Math.sin(randomAngle));
      this.fleeTarget = playerPos.plus(randomDir.scaled(this.distanceToRun));
    }

    // Navigate to flee target
    return new GoToNearTask(
      this.bot,
      Math.floor(this.fleeTarget.x),
      Math.floor(this.fleeTarget.y),
      Math.floor(this.fleeTarget.z),
      2
    );
  }

  /**
   * Calculate the optimal flee direction based on entity positions
   */
  private calculateFleeDirection(entities: Entity[]): Vec3 | null {
    if (entities.length === 0) return null;

    const playerPos = this.bot.entity.position;
    let fleeDir = new Vec3(0, 0, 0);

    for (const entity of entities) {
      if (!entity || entity.isValid === false) continue;

      // Vector from entity to player
      let toPlayer = playerPos.minus(entity.position);

      if (this.useXZOnly) {
        toPlayer = new Vec3(toPlayer.x, 0, toPlayer.z);
      }

      const dist = toPlayer.norm();
      if (dist < 0.1) {
        // Entity is on top of us - random direction
        const angle = Math.random() * Math.PI * 2;
        toPlayer = new Vec3(Math.cos(angle), 0, Math.sin(angle));
      } else {
        // Normalize and weight by inverse distance
        const weight = this.penaltyFactor / (dist + 0.1);
        toPlayer = toPlayer.scaled(weight / dist);
      }

      fleeDir = fleeDir.plus(toPlayer);
    }

    // Normalize the flee direction
    const len = fleeDir.norm();
    if (len < 0.1) {
      return null; // No clear direction
    }

    return fleeDir.scaled(1 / len);
  }

  /**
   * Check if we're at a safe distance from all entities
   */
  private isSafeFromEntities(entities: Entity[]): boolean {
    const playerPos = this.bot.entity.position;
    const safeDist = this.distanceToRun * 1.1; // Slight buffer

    for (const entity of entities) {
      if (!entity || entity.isValid === false) continue;

      let dist: number;
      if (this.useXZOnly) {
        const dx = playerPos.x - entity.position.x;
        const dz = playerPos.z - entity.position.z;
        dist = Math.sqrt(dx * dx + dz * dz);
      } else {
        dist = playerPos.distanceTo(entity.position);
      }

      if (dist < safeDist) {
        return false;
      }
    }

    return true;
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    const entities = this.entitySupplier();
    return this.isSafeFromEntities(entities);
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RunAwayFromEntitiesTask)) return false;
    return Math.abs(this.distanceToRun - other.distanceToRun) < 1 &&
           this.useXZOnly === other.useXZOnly;
  }
}

/**
 * RunAwayFromHostilesTask - Flee from hostile mobs
 *
 * Intent: Automatically detect and flee from hostile mobs within range.
 * Useful for survival scenarios when the bot is low on health or resources.
 */
export class RunAwayFromHostilesTask extends RunAwayFromEntitiesTask {
  private detectionRange: number;

  constructor(bot: Bot, distanceToRun: number = 20, detectionRange: number = 15) {
    super(
      bot,
      () => this.getHostileMobs(),
      distanceToRun,
      false,
      1.5 // Higher penalty for hostiles
    );
    this.detectionRange = detectionRange;
  }

  get displayName(): string {
    return `FleeHostiles(${this.distanceToRun}m)`;
  }

  private getHostileMobs(): Entity[] {
    const hostiles: Entity[] = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity === this.bot.entity) continue;
      if (entity.isValid === false) continue;

      // Check if hostile
      if (!isHostileMob(entity)) continue;

      // Check range
      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.detectionRange) {
        hostiles.push(entity);
      }
    }

    return hostiles;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RunAwayFromHostilesTask)) return false;
    return super.isEqual(other) && Math.abs(this.detectionRange - other.detectionRange) < 1;
  }
}

/**
 * RunAwayFromPlayersTask - Flee from player entities
 *
 * Intent: Flee from other players. Useful in PvP scenarios or
 * when avoiding specific players.
 */
export class RunAwayFromPlayersTask extends RunAwayFromEntitiesTask {
  private targetPlayers: string[];
  private detectionRange: number;

  /**
   * @param bot The mineflayer bot
   * @param playerNames Player names to flee from (empty = all players)
   * @param distanceToRun Distance to maintain
   * @param detectionRange Range to detect players
   */
  constructor(
    bot: Bot,
    playerNames: string[] = [],
    distanceToRun: number = 30,
    detectionRange: number = 20
  ) {
    super(
      bot,
      () => this.getPlayerEntities(),
      distanceToRun,
      false,
      2.0 // Higher penalty for players
    );
    this.targetPlayers = playerNames;
    this.detectionRange = detectionRange;
  }

  get displayName(): string {
    const names = this.targetPlayers.length > 0
      ? this.targetPlayers.join(', ')
      : 'all players';
    return `FleePlayers(${names})`;
  }

  private getPlayerEntities(): Entity[] {
    const players: Entity[] = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity === this.bot.entity) continue;
      if (entity.type !== 'player') continue;
      if (entity.isValid === false) continue;

      // Check if specific players only
      if (this.targetPlayers.length > 0) {
        if (!this.targetPlayers.includes(entity.username ?? '')) {
          continue;
        }
      }

      // Check range
      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.detectionRange) {
        players.push(entity);
      }
    }

    return players;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RunAwayFromPlayersTask)) return false;
    return super.isEqual(other) &&
           JSON.stringify(this.targetPlayers) === JSON.stringify(other.targetPlayers);
  }
}

/**
 * RunAwayFromCreepersTask - Specific task for fleeing from creepers
 *
 * Intent: Creepers are especially dangerous due to explosions.
 * This task maintains extra distance and has higher priority.
 */
export class RunAwayFromCreepersTask extends RunAwayFromEntitiesTask {
  private detectionRange: number;

  constructor(bot: Bot, distanceToRun: number = 10, detectionRange: number = 8) {
    super(
      bot,
      () => this.getCreepers(),
      distanceToRun,
      false,
      3.0 // Very high penalty for creepers
    );
    this.detectionRange = detectionRange;
  }

  get displayName(): string {
    return 'FleeCreepers';
  }

  private getCreepers(): Entity[] {
    const creepers: Entity[] = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (entity.name !== 'creeper') continue;
      if (entity.isValid === false) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist <= this.detectionRange) {
        creepers.push(entity);
      }
    }

    return creepers;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RunAwayFromCreepersTask)) return false;
    return super.isEqual(other);
  }
}

/**
 * DodgeProjectilesTask - Dodge incoming projectiles
 *
 * Intent: When projectiles (arrows, fireballs) are heading toward
 * the player, this task calculates and executes a dodge maneuver.
 */
export class DodgeProjectilesTask extends Task {
  private dodgeRange: number;
  private dodgeDirection: Vec3 | null = null;
  private dodgeTimer: number = 0;

  constructor(bot: Bot, dodgeRange: number = 10) {
    super(bot);
    this.dodgeRange = dodgeRange;
  }

  get displayName(): string {
    return 'DodgeProjectiles';
  }

  onStart(): void {
    this.dodgeDirection = null;
    this.dodgeTimer = 0;
  }

  onTick(): Task | null {
    // Find incoming projectiles
    const projectiles = this.findIncomingProjectiles();

    if (projectiles.length === 0) {
      this.bot.clearControlStates();
      return null;
    }

    // Calculate dodge direction
    this.dodgeDirection = this.calculateDodgeDirection(projectiles);

    if (this.dodgeDirection) {
      // Look perpendicular and strafe
      const playerPos = this.bot.entity.position;
      const targetPos = playerPos.plus(this.dodgeDirection.scaled(5));

      this.bot.lookAt(targetPos, true);
      this.bot.setControlState('forward', true);
      this.bot.setControlState('sprint', true);

      // Jump occasionally to avoid splash damage
      if (Math.random() > 0.7) {
        this.bot.setControlState('jump', true);
      }
    }

    this.dodgeTimer++;
    return null;
  }

  private findIncomingProjectiles(): Entity[] {
    const projectiles: Entity[] = [];
    const playerPos = this.bot.entity.position;

    const projectileTypes = ['arrow', 'spectral_arrow', 'fireball', 'small_fireball',
                            'wither_skull', 'dragon_fireball', 'trident', 'shulker_bullet'];

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;
      if (!entity.name || !projectileTypes.includes(entity.name)) continue;
      if (entity.isValid === false) continue;

      // Check distance
      const dist = playerPos.distanceTo(entity.position);
      if (dist > this.dodgeRange) continue;

      // Check if heading toward player
      const velocity = entity.velocity;
      if (!velocity || (velocity.x === 0 && velocity.y === 0 && velocity.z === 0)) {
        continue;
      }

      // Check if velocity is pointing toward player
      const toPlayer = playerPos.minus(entity.position);
      const dot = toPlayer.x * velocity.x + toPlayer.y * velocity.y + toPlayer.z * velocity.z;
      if (dot > 0) {
        projectiles.push(entity);
      }
    }

    return projectiles;
  }

  private calculateDodgeDirection(projectiles: Entity[]): Vec3 | null {
    if (projectiles.length === 0) return null;

    const playerPos = this.bot.entity.position;

    // Average the dodge directions for all projectiles
    let dodgeDir = new Vec3(0, 0, 0);

    for (const proj of projectiles) {
      const velocity = proj.velocity;
      if (!velocity) continue;

      // Dodge perpendicular to projectile velocity
      const perpendicular = new Vec3(-velocity.z, 0, velocity.x);
      const len = Math.sqrt(perpendicular.x * perpendicular.x + perpendicular.z * perpendicular.z);

      if (len > 0.01) {
        // Choose the perpendicular direction that's away from other threats
        const normalized = perpendicular.scaled(1 / len);
        dodgeDir = dodgeDir.plus(normalized);
      }
    }

    const finalLen = dodgeDir.norm();
    if (finalLen < 0.1) return null;

    return dodgeDir.scaled(1 / finalLen);
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
  }

  isFinished(): boolean {
    return this.findIncomingProjectiles().length === 0 || this.dodgeTimer > 40;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof DodgeProjectilesTask)) return false;
    return Math.abs(this.dodgeRange - other.dodgeRange) < 1;
  }
}

export default {
  RunAwayFromEntitiesTask,
  RunAwayFromHostilesTask,
  RunAwayFromPlayersTask,
  RunAwayFromCreepersTask,
  DodgeProjectilesTask,
};
