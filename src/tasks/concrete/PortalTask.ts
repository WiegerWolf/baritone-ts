/**
 * PortalTask - Nether Portal Navigation Tasks
 * Based on BaritonePlus's EnterNetherPortalTask.java
 *
 * WHY: Dimension travel is essential for many Minecraft goals. The nether
 * provides fast travel (8:1 ratio) and unique resources like blaze rods.
 * This task handles finding, building, and entering nether portals.
 */

import type { Bot } from 'mineflayer';
import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GetToBlockTask, GoToNearTask } from './GoToTask';
import { TimeoutWanderTask } from './MovementUtilTask';
import { DoToClosestBlockTask } from './BlockSearchTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { Dimension } from './ResourceTask';

/**
 * State for portal task
 */
enum PortalState {
  FINDING_PORTAL,
  APPROACHING,
  ENTERING,
  WAITING,
  BUILDING_PORTAL,
  WANDERING,
  FINISHED
}

/**
 * Configuration for EnterNetherPortalTask
 */
export interface PortalConfig {
  /** Timeout before trying to exit and re-enter portal */
  portalTimeout: number;
  /** Whether to build a portal if none found */
  buildIfMissing: boolean;
  /** Custom portal filter */
  portalFilter?: (pos: Vec3) => boolean;
}

const DEFAULT_CONFIG: PortalConfig = {
  portalTimeout: 10,
  buildIfMissing: false, // Building portals is complex, disabled by default
};

/**
 * Task to enter a nether portal and travel to another dimension.
 *
 * WHY: The nether is critical for progression - it has fortresses with
 * blaze rods and other resources. This task handles the portal mechanics:
 * finding portals, entering them, and waiting for the dimension change.
 *
 * Based on BaritonePlus EnterNetherPortalTask.java
 */
export class EnterNetherPortalTask extends Task {
  private targetDimension: Dimension;
  private config: PortalConfig;
  private state: PortalState = PortalState.FINDING_PORTAL;
  private portalTimeout: TimerGame;
  private leftPortal: boolean = false;
  private currentPortalPos: Vec3 | null = null;

  constructor(
    bot: Bot,
    targetDimension: Dimension,
    config: Partial<PortalConfig> = {}
  ) {
    super(bot);

    if (targetDimension === Dimension.END) {
      throw new Error("Can't build a nether portal to the End. Use an End portal.");
    }

    this.targetDimension = targetDimension;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.portalTimeout = new TimerGame(bot, this.config.portalTimeout);
  }

  get displayName(): string {
    const dimName = this.targetDimension === Dimension.NETHER ? 'Nether' : 'Overworld';
    return `EnterPortal(${dimName})`;
  }

  onStart(): void {
    this.state = PortalState.FINDING_PORTAL;
    this.leftPortal = false;
    this.currentPortalPos = null;
    this.portalTimeout.reset();
  }

  onTick(): Task | null {
    // Check if we've arrived
    if (this.getCurrentDimension() === this.targetDimension) {
      this.state = PortalState.FINISHED;
      return null;
    }

    switch (this.state) {
      case PortalState.FINDING_PORTAL:
        return this.handleFindingPortal();

      case PortalState.APPROACHING:
        return this.handleApproaching();

      case PortalState.ENTERING:
        return this.handleEntering();

      case PortalState.WAITING:
        return this.handleWaiting();

      case PortalState.WANDERING:
        return this.handleWandering();

      default:
        return null;
    }
  }

  private handleFindingPortal(): Task | null {
    // Look for nether portal blocks
    const portal = this.findNearestPortal();

    if (portal) {
      this.currentPortalPos = portal;
      this.state = PortalState.APPROACHING;
      return null;
    }

    // No portal found
    if (this.config.buildIfMissing) {
      this.state = PortalState.BUILDING_PORTAL;
      // Building portal is complex - would need obsidian placement
      // For now, just wander
    }

    this.state = PortalState.WANDERING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentPortalPos) {
      this.state = PortalState.FINDING_PORTAL;
      return null;
    }

    // Check if portal is still valid
    const block = this.bot.blockAt(this.currentPortalPos);
    if (!block || block.name !== 'nether_portal') {
      this.currentPortalPos = null;
      this.state = PortalState.FINDING_PORTAL;
      return null;
    }

    // Check if we're in the portal
    if (this.isInPortal()) {
      this.state = PortalState.WAITING;
      this.portalTimeout.reset();
      return null;
    }

    // Move to portal
    const dist = this.bot.entity.position.distanceTo(this.currentPortalPos);
    if (dist <= 1.5) {
      this.state = PortalState.ENTERING;
      return null;
    }

    return new GoToNearTask(
      this.bot,
      Math.floor(this.currentPortalPos.x),
      Math.floor(this.currentPortalPos.y),
      Math.floor(this.currentPortalPos.z),
      1
    );
  }

  private handleEntering(): Task | null {
    if (!this.currentPortalPos) {
      this.state = PortalState.FINDING_PORTAL;
      return null;
    }

    // Walk into the portal
    if (this.isInPortal()) {
      this.state = PortalState.WAITING;
      this.portalTimeout.reset();
      return null;
    }

    // Move forward into portal
    this.bot.setControlState('forward', true);
    return null;
  }

  private handleWaiting(): Task | null {
    // We're in the portal - wait for teleport
    if (!this.isInPortal()) {
      // We left the portal
      this.portalTimeout.reset();
      this.state = PortalState.APPROACHING;
      return null;
    }

    // Stop all movement while in portal
    this.bot.clearControlStates();

    // Check for timeout - might need to exit and re-enter
    if (this.portalTimeout.elapsed() && !this.leftPortal) {
      // Portal seems stuck, try exiting
      this.state = PortalState.WANDERING;
      this.leftPortal = true;
      return null;
    }

    return null;
  }

  private handleWandering(): Task | null {
    // Wander briefly then try again
    const portal = this.findNearestPortal();
    if (portal) {
      this.currentPortalPos = portal;
      this.state = PortalState.APPROACHING;
      return null;
    }

    return new TimeoutWanderTask(this.bot, 5);
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.currentPortalPos = null;
  }

  isFinished(): boolean {
    return this.state === PortalState.FINISHED ||
           this.getCurrentDimension() === this.targetDimension;
  }

  // ---- Helper methods ----

  private findNearestPortal(): Vec3 | null {
    const playerPos = this.bot.entity.position;
    const searchRadius = 64;

    let nearest: Vec3 | null = null;
    let nearestDist = Infinity;

    for (let r = 1; r <= searchRadius; r++) {
      for (let x = -r; x <= r; x++) {
        for (let y = -Math.min(r, 32); y <= Math.min(r, 32); y++) {
          for (let z = -r; z <= r; z++) {
            if (Math.abs(x) !== r && Math.abs(y) !== r && Math.abs(z) !== r) continue;

            const checkPos = new Vec3(
              Math.floor(playerPos.x) + x,
              Math.floor(playerPos.y) + y,
              Math.floor(playerPos.z) + z
            );

            const block = this.bot.blockAt(checkPos);
            if (block && block.name === 'nether_portal') {
              // Check custom filter
              if (this.config.portalFilter && !this.config.portalFilter(checkPos)) {
                continue;
              }

              // Check for standable position (solid block below)
              const below = this.bot.blockAt(checkPos.offset(0, -1, 0));
              if (below && below.boundingBox === 'block') {
                const dist = playerPos.distanceTo(checkPos);
                if (dist < nearestDist) {
                  nearestDist = dist;
                  nearest = checkPos;
                }
              }
            }
          }
        }
      }

      if (nearest) break;
    }

    return nearest;
  }

  private isInPortal(): boolean {
    const playerBlockPos = this.bot.entity.position.floored();
    const block = this.bot.blockAt(playerBlockPos);
    return block !== null && block.name === 'nether_portal';
  }

  private getCurrentDimension(): Dimension {
    const dimensionName = (this.bot as any).game?.dimension ?? 'minecraft:overworld';
    if (dimensionName.includes('nether')) return Dimension.NETHER;
    if (dimensionName.includes('end')) return Dimension.END;
    return Dimension.OVERWORLD;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof EnterNetherPortalTask)) return false;
    return this.targetDimension === other.targetDimension;
  }
}

/**
 * Task to go to a specific dimension.
 *
 * WHY: Many goals require being in a specific dimension. This task
 * handles the logic of determining what kind of portal is needed.
 */
export class GoToDimensionTask extends Task {
  private targetDimension: Dimension;
  private finished: boolean = false;

  constructor(bot: Bot, targetDimension: Dimension) {
    super(bot);
    this.targetDimension = targetDimension;
  }

  get displayName(): string {
    const dimName = this.targetDimension === Dimension.NETHER ? 'Nether'
      : this.targetDimension === Dimension.END ? 'End'
      : 'Overworld';
    return `GoToDimension(${dimName})`;
  }

  onStart(): void {
    this.finished = false;
  }

  onTick(): Task | null {
    const current = this.getCurrentDimension();

    if (current === this.targetDimension) {
      this.finished = true;
      return null;
    }

    // Handle End dimension separately (needs end portal)
    if (this.targetDimension === Dimension.END) {
      // End portal logic would go here
      // For now, fail gracefully
      this.finished = true;
      return null;
    }

    // Nether portal for overworld <-> nether travel
    return new EnterNetherPortalTask(this.bot, this.targetDimension);
  }

  onStop(interruptTask: ITask | null): void {
    // Nothing to clean up
  }

  isFinished(): boolean {
    return this.finished || this.getCurrentDimension() === this.targetDimension;
  }

  private getCurrentDimension(): Dimension {
    const dimensionName = (this.bot as any).game?.dimension ?? 'minecraft:overworld';
    if (dimensionName.includes('nether')) return Dimension.NETHER;
    if (dimensionName.includes('end')) return Dimension.END;
    return Dimension.OVERWORLD;
  }

  isEqual(other: ITask | null): boolean {
    if (!other) return false;
    if (!(other instanceof GoToDimensionTask)) return false;
    return this.targetDimension === other.targetDimension;
  }
}

/**
 * Helper to enter the nether
 */
export function enterNether(bot: Bot): EnterNetherPortalTask {
  return new EnterNetherPortalTask(bot, Dimension.NETHER);
}

/**
 * Helper to return to overworld
 */
export function returnToOverworld(bot: Bot): EnterNetherPortalTask {
  return new EnterNetherPortalTask(bot, Dimension.OVERWORLD);
}

/**
 * Helper to go to a dimension
 */
export function goToDimension(bot: Bot, dimension: Dimension): GoToDimensionTask {
  return new GoToDimensionTask(bot, dimension);
}
