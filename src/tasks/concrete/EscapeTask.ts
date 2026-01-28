/**
 * EscapeTask - Escape and Safety Tasks
 * Based on BaritonePlus's escape/safety system
 *
 * Tasks for escaping dangerous situations like lava, creepers,
 * hostile mobs, and other environmental hazards.
 */

import type { Bot } from 'mineflayer';
import type { Entity } from 'prismarine-entity';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask, GoToXZTask } from './GoToTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { MovementProgressChecker } from '../../utils/progress/MovementProgressChecker';

/**
 * State for escape tasks
 */
enum EscapeState {
  ASSESSING,
  ESCAPING,
  SPRINTING,
  JUMPING,
  SAFE,
  FINISHED,
  FAILED
}

/**
 * Configuration for EscapeFromLavaTask
 */
export interface LavaEscapeConfig {
  /** Strength of escape urgency (affects pathfinding) */
  strength: number;
  /** Sprint through lava (faster but more damage) */
  sprintThroughLava: boolean;
  /** Jump through lava (faster but more damage) */
  jumpThroughLava: boolean;
  /** Search radius for safe ground */
  safeSearchRadius: number;
}

const DEFAULT_LAVA_CONFIG: LavaEscapeConfig = {
  strength: 100,
  sprintThroughLava: true,
  jumpThroughLava: true,
  safeSearchRadius: 20,
};

/**
 * Task to escape from lava.
 *
 * WHY: Lava is extremely dangerous - rapid health loss and fire damage.
 * This task prioritizes immediate escape over everything else, using
 * sprinting and jumping to move faster through lava even at cost of more damage.
 * Getting out quickly is better than taking slow damage.
 *
 * Based on BaritonePlus EscapeFromLavaTask.java
 */
export class EscapeFromLavaTask extends Task {
  private config: LavaEscapeConfig;
  private state: EscapeState = EscapeState.ASSESSING;
  private safeTarget: Vec3 | null = null;
  private progressChecker: MovementProgressChecker;
  private escapeTimer: TimerGame;

  constructor(bot: Bot, config: Partial<LavaEscapeConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_LAVA_CONFIG, ...config };
    this.progressChecker = new MovementProgressChecker(bot);
    this.escapeTimer = new TimerGame(bot, 30); // Max 30 seconds of escape
  }

  get displayName(): string {
    return `EscapeFromLava(${EscapeState[this.state]})`;
  }

  onStart(): void {
    this.state = EscapeState.ASSESSING;
    this.safeTarget = null;
    this.progressChecker.reset();
    this.escapeTimer.reset();
  }

  onTick(): Task | null {
    // Always check if we're safe
    if (this.isSafe()) {
      this.state = EscapeState.SAFE;
      this.clearEscapeControls();
      return null;
    }

    // Timeout check
    if (this.escapeTimer.elapsed()) {
      this.state = EscapeState.FAILED;
      this.clearEscapeControls();
      return null;
    }

    switch (this.state) {
      case EscapeState.ASSESSING:
        return this.handleAssessing();

      case EscapeState.ESCAPING:
        return this.handleEscaping();

      case EscapeState.SPRINTING:
        return this.handleSprinting();

      case EscapeState.SAFE:
        this.state = EscapeState.FINISHED;
        return null;

      default:
        return null;
    }
  }

  private handleAssessing(): Task | null {
    // Find nearest safe ground
    this.safeTarget = this.findSafeGround();

    if (!this.safeTarget) {
      // No safe ground found - just move away from lava source
      this.safeTarget = this.findAnyEscapeDirection();
    }

    this.state = EscapeState.ESCAPING;
    return null;
  }

  private handleEscaping(): Task | null {
    // Apply escape controls
    this.applyEscapeControls();

    if (!this.safeTarget) {
      // Just keep moving in some direction
      this.bot.setControlState('forward', true);
      if (this.config.jumpThroughLava && this.isInLava()) {
        this.bot.setControlState('jump', true);
      }
      return null;
    }

    // Check progress
    this.progressChecker.setProgress(this.bot.entity.position);
    if (this.progressChecker.failed()) {
      // Not making progress - try different direction
      this.safeTarget = this.findAnyEscapeDirection();
      this.progressChecker.reset();
    }

    // Navigate to safe target
    return new GoToNearTask(
      this.bot,
      Math.floor(this.safeTarget.x),
      Math.floor(this.safeTarget.y),
      Math.floor(this.safeTarget.z),
      2
    );
  }

  private handleSprinting(): Task | null {
    this.applyEscapeControls();
    this.state = EscapeState.ESCAPING;
    return null;
  }

  private applyEscapeControls(): void {
    if (this.isInLava() || this.isOnLava()) {
      if (this.config.sprintThroughLava) {
        this.bot.setControlState('sprint', true);
      }
      if (this.config.jumpThroughLava) {
        this.bot.setControlState('jump', true);
      }
    }
  }

  private clearEscapeControls(): void {
    this.bot.setControlState('sprint', false);
    this.bot.setControlState('jump', false);
  }

  onStop(interruptTask: ITask | null): void {
    this.clearEscapeControls();
    this.safeTarget = null;
  }

  isFinished(): boolean {
    return this.state === EscapeState.FINISHED ||
           this.state === EscapeState.FAILED ||
           this.isSafe();
  }

  isFailed(): boolean {
    return this.state === EscapeState.FAILED;
  }

  // ---- Helper methods ----

  private isInLava(): boolean {
    const pos = this.bot.entity.position;
    const block = this.bot.blockAt(new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)));
    return block !== null && block.name.includes('lava');
  }

  private isOnLava(): boolean {
    const pos = this.bot.entity.position;
    const blockBelow = this.bot.blockAt(new Vec3(Math.floor(pos.x), Math.floor(pos.y) - 1, Math.floor(pos.z)));
    return blockBelow !== null && blockBelow.name.includes('lava');
  }

  private isOnFire(): boolean {
    // Check entity metadata for fire status
    const metadata = (this.bot.entity as any).metadata;
    if (metadata && typeof metadata[0] === 'number') {
      return (metadata[0] & 0x01) !== 0; // Fire flag
    }
    return false;
  }

  private isSafe(): boolean {
    return !this.isInLava() && !this.isOnFire() && !this.isOnLava();
  }

  private isLavaBlock(pos: Vec3): boolean {
    const block = this.bot.blockAt(pos);
    return block !== null && block.name.includes('lava');
  }

  private isLavaAdjacent(x: number, y: number, z: number): boolean {
    const offsets = [
      [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
      [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1]
    ];

    for (const [dx, dy, dz] of offsets) {
      if (this.isLavaBlock(new Vec3(x + dx, y + dy, z + dz))) {
        return true;
      }
    }
    return false;
  }

  private isSafePosition(x: number, y: number, z: number): boolean {
    // Not lava, not adjacent to lava, has solid ground
    if (this.isLavaBlock(new Vec3(x, y, z))) return false;
    if (this.isLavaAdjacent(x, y, z)) return false;

    // Check for solid ground
    const ground = this.bot.blockAt(new Vec3(x, y - 1, z));
    if (!ground || ground.boundingBox !== 'block') return false;

    // Check for air/passable above
    const above = this.bot.blockAt(new Vec3(x, y, z));
    if (above && above.boundingBox === 'block') return false;

    return true;
  }

  private findSafeGround(): Vec3 | null {
    const pos = this.bot.entity.position;
    const radius = this.config.safeSearchRadius;

    let bestPos: Vec3 | null = null;
    let bestScore = Infinity;

    // Search in expanding rings
    for (let r = 1; r <= radius; r++) {
      for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
          // Only check outer ring
          if (Math.abs(x) !== r && Math.abs(z) !== r) continue;

          for (let y = -5; y <= 5; y++) {
            const checkX = Math.floor(pos.x) + x;
            const checkY = Math.floor(pos.y) + y;
            const checkZ = Math.floor(pos.z) + z;

            if (this.isSafePosition(checkX, checkY, checkZ)) {
              const dist = Math.sqrt(x * x + y * y + z * z);
              // Prefer positions with water (cools fire)
              const hasWater = this.hasNearbyWater(checkX, checkY, checkZ);
              const score = dist - (hasWater ? 5 : 0);

              if (score < bestScore) {
                bestScore = score;
                bestPos = new Vec3(checkX, checkY, checkZ);
              }
            }
          }
        }
      }

      // Found safe position in this ring
      if (bestPos) break;
    }

    return bestPos;
  }

  private hasNearbyWater(x: number, y: number, z: number): boolean {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          const block = this.bot.blockAt(new Vec3(x + dx, y + dy, z + dz));
          if (block && block.name.includes('water')) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private findAnyEscapeDirection(): Vec3 {
    // Find direction away from most lava
    const pos = this.bot.entity.position;
    let lavaCenter = new Vec3(0, 0, 0);
    let lavaCount = 0;

    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        for (let y = -2; y <= 2; y++) {
          if (this.isLavaBlock(new Vec3(pos.x + x, pos.y + y, pos.z + z))) {
            lavaCenter = lavaCenter.plus(new Vec3(x, 0, z));
            lavaCount++;
          }
        }
      }
    }

    if (lavaCount === 0) {
      // No lava found, move in random direction
      const angle = Math.random() * Math.PI * 2;
      return pos.plus(new Vec3(Math.cos(angle) * 10, 0, Math.sin(angle) * 10));
    }

    // Move away from lava center
    lavaCenter = lavaCenter.scaled(1 / lavaCount);
    const escapeDir = new Vec3(-lavaCenter.x, 0, -lavaCenter.z);
    const len = Math.sqrt(escapeDir.x * escapeDir.x + escapeDir.z * escapeDir.z);

    if (len < 0.1) {
      // Lava all around, pick random direction
      const angle = Math.random() * Math.PI * 2;
      return pos.plus(new Vec3(Math.cos(angle) * 10, 0, Math.sin(angle) * 10));
    }

    return pos.plus(escapeDir.scaled(10 / len));
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    return other instanceof EscapeFromLavaTask;
  }
}

/**
 * Configuration for RunAwayFromCreepersTask
 */
export interface CreeperFleeConfig {
  /** Distance to maintain from creepers */
  fleeDistance: number;
  /** Extra distance for charged creepers */
  chargedCreeperDistance: number;
  /** Sprint while fleeing */
  sprint: boolean;
}

const DEFAULT_CREEPER_CONFIG: CreeperFleeConfig = {
  fleeDistance: 10,
  chargedCreeperDistance: 15,
  sprint: true,
};

/**
 * Task to run away from creepers.
 *
 * WHY: Creepers are uniquely dangerous - they explode and destroy blocks.
 * Unlike other mobs, the best strategy is always to run, not fight.
 * This task calculates safe distance based on creeper fuse state and charge.
 *
 * Based on BaritonePlus RunAwayFromCreepersTask.java
 */
export class RunAwayFromCreepersTask extends Task {
  private config: CreeperFleeConfig;
  private state: EscapeState = EscapeState.ASSESSING;
  private fleeTarget: Vec3 | null = null;
  private nearbyCreepers: Entity[] = [];

  constructor(bot: Bot, config: Partial<CreeperFleeConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_CREEPER_CONFIG, ...config };
  }

  get displayName(): string {
    return `RunAwayFromCreepers(${this.nearbyCreepers.length} creepers)`;
  }

  onStart(): void {
    this.state = EscapeState.ASSESSING;
    this.fleeTarget = null;
    this.nearbyCreepers = [];
    this.updateCreepers();
  }

  onTick(): Task | null {
    this.updateCreepers();

    // No creepers nearby - we're safe
    if (this.nearbyCreepers.length === 0) {
      this.state = EscapeState.SAFE;
      this.clearControls();
      return null;
    }

    switch (this.state) {
      case EscapeState.ASSESSING:
        return this.handleAssessing();

      case EscapeState.ESCAPING:
        return this.handleEscaping();

      case EscapeState.SAFE:
        this.state = EscapeState.FINISHED;
        return null;

      default:
        return null;
    }
  }

  private handleAssessing(): Task | null {
    // Calculate flee direction (opposite of creeper center)
    this.fleeTarget = this.calculateFleeTarget();
    this.state = EscapeState.ESCAPING;
    return null;
  }

  private handleEscaping(): Task | null {
    if (this.config.sprint) {
      this.bot.setControlState('sprint', true);
    }

    if (!this.fleeTarget) {
      // Just run forward
      this.bot.setControlState('forward', true);
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.fleeTarget.x),
      Math.floor(this.fleeTarget.y),
      Math.floor(this.fleeTarget.z),
      2
    );
  }

  private clearControls(): void {
    this.bot.setControlState('sprint', false);
    this.bot.setControlState('forward', false);
  }

  onStop(interruptTask: ITask | null): void {
    this.clearControls();
    this.nearbyCreepers = [];
    this.fleeTarget = null;
  }

  isFinished(): boolean {
    return this.state === EscapeState.FINISHED ||
           this.state === EscapeState.SAFE ||
           this.nearbyCreepers.length === 0;
  }

  // ---- Helper methods ----

  private updateCreepers(): void {
    this.nearbyCreepers = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || entity.name !== 'creeper') continue;

      const dist = playerPos.distanceTo(entity.position);
      const fleeDistance = this.getCreeperFleeDistance(entity);

      if (dist < fleeDistance) {
        this.nearbyCreepers.push(entity);
      }
    }
  }

  private getCreeperFleeDistance(creeper: Entity): number {
    // Check if charged creeper
    const metadata = (creeper as any).metadata;
    if (metadata && metadata[17] === true) {
      // Charged creepers have bigger explosion
      return this.config.chargedCreeperDistance;
    }

    // Check if fusing (ignited)
    if (metadata && metadata[16] === 1) {
      // Already fusing - need more distance
      return this.config.fleeDistance * 1.5;
    }

    return this.config.fleeDistance;
  }

  private calculateFleeTarget(): Vec3 | null {
    if (this.nearbyCreepers.length === 0) return null;

    const playerPos = this.bot.entity.position;

    // Calculate weighted center of creepers (closer = more weight)
    let creeperCenter = new Vec3(0, 0, 0);
    let totalWeight = 0;

    for (const creeper of this.nearbyCreepers) {
      const dist = playerPos.distanceTo(creeper.position);
      const weight = 1 / (dist + 1); // Inverse distance weight

      creeperCenter = creeperCenter.plus(creeper.position.scaled(weight));
      totalWeight += weight;
    }

    creeperCenter = creeperCenter.scaled(1 / totalWeight);

    // Flee in opposite direction
    const fleeDir = playerPos.minus(creeperCenter);
    const len = Math.sqrt(fleeDir.x * fleeDir.x + fleeDir.z * fleeDir.z);

    if (len < 0.1) {
      // Creepers on top of us - random direction
      const angle = Math.random() * Math.PI * 2;
      return playerPos.plus(new Vec3(
        Math.cos(angle) * this.config.fleeDistance,
        0,
        Math.sin(angle) * this.config.fleeDistance
      ));
    }

    return playerPos.plus(fleeDir.scaled(this.config.fleeDistance / len));
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RunAwayFromCreepersTask)) return false;
    return Math.abs(this.config.fleeDistance - other.config.fleeDistance) < 1;
  }
}

/**
 * Configuration for RunAwayFromHostilesTask
 */
export interface HostileFleeConfig {
  /** Distance to run from hostiles */
  fleeDistance: number;
  /** Include skeletons (might want to fight them for arrows) */
  includeSkeletons: boolean;
  /** Hostile mob types to flee from */
  hostileTypes: string[];
  /** Sprint while fleeing */
  sprint: boolean;
}

const DEFAULT_HOSTILE_CONFIG: HostileFleeConfig = {
  fleeDistance: 20,
  includeSkeletons: false,
  hostileTypes: [
    'zombie', 'husk', 'drowned', 'zombie_villager',
    'skeleton', 'stray', 'wither_skeleton',
    'spider', 'cave_spider',
    'creeper',
    'witch',
    'phantom',
    'pillager', 'vindicator', 'ravager', 'evoker', 'vex',
    'piglin_brute', 'hoglin', 'zoglin',
    'warden',
  ],
  sprint: true,
};

/**
 * Task to run away from hostile mobs.
 *
 * WHY: When low on health, resources, or just exploring, sometimes
 * running is smarter than fighting. This task handles fleeing from
 * multiple hostile mobs at once, calculating the safest escape route.
 *
 * Based on BaritonePlus RunAwayFromHostilesTask.java
 */
export class RunAwayFromHostilesTask extends Task {
  private config: HostileFleeConfig;
  private state: EscapeState = EscapeState.ASSESSING;
  private fleeTarget: Vec3 | null = null;
  private nearbyHostiles: Entity[] = [];

  constructor(bot: Bot, config: Partial<HostileFleeConfig> = {}) {
    super(bot);
    this.config = { ...DEFAULT_HOSTILE_CONFIG, ...config };
  }

  get displayName(): string {
    return `RunAwayFromHostiles(${this.nearbyHostiles.length})`;
  }

  onStart(): void {
    this.state = EscapeState.ASSESSING;
    this.fleeTarget = null;
    this.nearbyHostiles = [];
    this.updateHostiles();
  }

  onTick(): Task | null {
    this.updateHostiles();

    // No hostiles nearby - we're safe
    if (this.nearbyHostiles.length === 0) {
      this.state = EscapeState.SAFE;
      this.clearControls();
      return null;
    }

    switch (this.state) {
      case EscapeState.ASSESSING:
        return this.handleAssessing();

      case EscapeState.ESCAPING:
        return this.handleEscaping();

      case EscapeState.SAFE:
        this.state = EscapeState.FINISHED;
        return null;

      default:
        return null;
    }
  }

  private handleAssessing(): Task | null {
    this.fleeTarget = this.calculateFleeTarget();
    this.state = EscapeState.ESCAPING;
    return null;
  }

  private handleEscaping(): Task | null {
    if (this.config.sprint) {
      this.bot.setControlState('sprint', true);
    }

    if (!this.fleeTarget) {
      this.bot.setControlState('forward', true);
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.fleeTarget.x),
      Math.floor(this.fleeTarget.y),
      Math.floor(this.fleeTarget.z),
      2
    );
  }

  private clearControls(): void {
    this.bot.setControlState('sprint', false);
    this.bot.setControlState('forward', false);
  }

  onStop(interruptTask: ITask | null): void {
    this.clearControls();
    this.nearbyHostiles = [];
    this.fleeTarget = null;
  }

  isFinished(): boolean {
    return this.state === EscapeState.FINISHED ||
           this.state === EscapeState.SAFE ||
           this.nearbyHostiles.length === 0;
  }

  // ---- Helper methods ----

  private updateHostiles(): void {
    this.nearbyHostiles = [];
    const playerPos = this.bot.entity.position;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity) continue;

      const name = entity.name ?? '';

      // Check if hostile type
      if (!this.config.hostileTypes.includes(name)) continue;

      // Skip skeletons if configured
      if (!this.config.includeSkeletons && name.includes('skeleton')) continue;

      const dist = playerPos.distanceTo(entity.position);
      if (dist < this.config.fleeDistance) {
        this.nearbyHostiles.push(entity);
      }
    }
  }

  private calculateFleeTarget(): Vec3 | null {
    if (this.nearbyHostiles.length === 0) return null;

    const playerPos = this.bot.entity.position;

    // Calculate average position of hostiles
    let hostileCenter = new Vec3(0, 0, 0);
    for (const hostile of this.nearbyHostiles) {
      hostileCenter = hostileCenter.plus(hostile.position);
    }
    hostileCenter = hostileCenter.scaled(1 / this.nearbyHostiles.length);

    // Flee in opposite direction
    const fleeDir = playerPos.minus(hostileCenter);
    const len = Math.sqrt(fleeDir.x * fleeDir.x + fleeDir.z * fleeDir.z);

    if (len < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      return playerPos.plus(new Vec3(
        Math.cos(angle) * this.config.fleeDistance,
        0,
        Math.sin(angle) * this.config.fleeDistance
      ));
    }

    return playerPos.plus(fleeDir.scaled(this.config.fleeDistance / len));
  }

  /**
   * Get current hostile count
   */
  getHostileCount(): number {
    return this.nearbyHostiles.length;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof RunAwayFromHostilesTask)) return false;
    return Math.abs(this.config.fleeDistance - other.config.fleeDistance) < 1;
  }
}

/**
 * Convenience functions
 */

export function escapeFromLava(bot: Bot): EscapeFromLavaTask {
  return new EscapeFromLavaTask(bot);
}

export function escapeFromLavaUrgent(bot: Bot): EscapeFromLavaTask {
  return new EscapeFromLavaTask(bot, {
    strength: 200,
    sprintThroughLava: true,
    jumpThroughLava: true,
  });
}

export function runFromCreepers(bot: Bot, distance: number = 10): RunAwayFromCreepersTask {
  return new RunAwayFromCreepersTask(bot, { fleeDistance: distance });
}

export function runFromHostiles(bot: Bot, distance: number = 20): RunAwayFromHostilesTask {
  return new RunAwayFromHostilesTask(bot, { fleeDistance: distance });
}

export function runFromAllHostiles(bot: Bot): RunAwayFromHostilesTask {
  return new RunAwayFromHostilesTask(bot, {
    includeSkeletons: true,
    fleeDistance: 25,
    sprint: true,
  });
}
