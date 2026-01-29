/**
 * EnterNetherPortalTask - Legacy Nether Portal Entry
 * Based on BaritonePlus EnterNetherPortalTask.java
 *
 * Handles finding, approaching, and entering nether portals
 * to travel between overworld and nether dimensions.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { GoToNearTask } from '../concrete/GoToNearTask';
import { TimeoutWanderTask } from '../concrete/TimeoutWanderTask';
import { TimerGame } from '../../utils/timers/TimerGame';
import { Dimension } from './PortalNavTask';

/**
 * State for EnterNetherPortalTask
 */
enum NetherPortalState {
  FINDING_PORTAL,
  APPROACHING,
  ENTERING,
  WAITING,
  WANDERING,
  FINISHED,
}

/**
 * Configuration for EnterNetherPortalTask
 */
export interface NetherPortalConfig {
  /** Timeout before trying to exit and re-enter portal */
  portalTimeout: number;
  /** Whether to build a portal if none found */
  buildIfMissing: boolean;
  /** Custom portal filter */
  portalFilter?: (pos: Vec3) => boolean;
}

const DEFAULT_NETHER_CONFIG: NetherPortalConfig = {
  portalTimeout: 10,
  buildIfMissing: false,
};

/**
 * Task to enter a nether portal and travel to another dimension.
 * Based on BaritonePlus EnterNetherPortalTask.java
 */
export class EnterNetherPortalTask extends Task {
  private targetDimension: Dimension;
  private config: NetherPortalConfig;
  private state: NetherPortalState = NetherPortalState.FINDING_PORTAL;
  private portalTimeout: TimerGame;
  private leftPortal: boolean = false;
  private currentPortalPos: Vec3 | null = null;

  constructor(
    bot: Bot,
    targetDimension: Dimension,
    config: Partial<NetherPortalConfig> = {}
  ) {
    super(bot);

    if (targetDimension === Dimension.END) {
      throw new Error("Can't use a nether portal to reach the End. Use an End portal.");
    }

    this.targetDimension = targetDimension;
    this.config = { ...DEFAULT_NETHER_CONFIG, ...config };
    this.portalTimeout = new TimerGame(bot, this.config.portalTimeout);
  }

  get displayName(): string {
    const dimName = this.targetDimension === Dimension.NETHER ? 'Nether' : 'Overworld';
    return `EnterPortal(${dimName})`;
  }

  onStart(): void {
    this.state = NetherPortalState.FINDING_PORTAL;
    this.leftPortal = false;
    this.currentPortalPos = null;
    this.portalTimeout.reset();
  }

  onTick(): Task | null {
    if (this.getCurrentDimension() === this.targetDimension) {
      this.state = NetherPortalState.FINISHED;
      return null;
    }

    switch (this.state) {
      case NetherPortalState.FINDING_PORTAL:
        return this.handleFindingPortal();
      case NetherPortalState.APPROACHING:
        return this.handleApproaching();
      case NetherPortalState.ENTERING:
        return this.handleEntering();
      case NetherPortalState.WAITING:
        return this.handleWaiting();
      case NetherPortalState.WANDERING:
        return this.handleWandering();
      default:
        return null;
    }
  }

  private handleFindingPortal(): Task | null {
    const portal = this.findNearestNetherPortal();
    if (portal) {
      this.currentPortalPos = portal;
      this.state = NetherPortalState.APPROACHING;
      return null;
    }

    if (this.config.buildIfMissing) {
      // Building portal is complex - for now, just wander
    }

    this.state = NetherPortalState.WANDERING;
    return null;
  }

  private handleApproaching(): Task | null {
    if (!this.currentPortalPos) {
      this.state = NetherPortalState.FINDING_PORTAL;
      return null;
    }

    const block = this.bot.blockAt(this.currentPortalPos);
    if (!block || block.name !== 'nether_portal') {
      this.currentPortalPos = null;
      this.state = NetherPortalState.FINDING_PORTAL;
      return null;
    }

    if (this.isInPortal()) {
      this.state = NetherPortalState.WAITING;
      this.portalTimeout.reset();
      return null;
    }

    const dist = this.bot.entity.position.distanceTo(this.currentPortalPos);
    if (dist <= 1.5) {
      this.state = NetherPortalState.ENTERING;
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
      this.state = NetherPortalState.FINDING_PORTAL;
      return null;
    }

    if (this.isInPortal()) {
      this.state = NetherPortalState.WAITING;
      this.portalTimeout.reset();
      return null;
    }

    this.bot.setControlState('forward', true);
    return null;
  }

  private handleWaiting(): Task | null {
    if (!this.isInPortal()) {
      this.portalTimeout.reset();
      this.state = NetherPortalState.APPROACHING;
      return null;
    }

    this.bot.clearControlStates();

    if (this.portalTimeout.elapsed() && !this.leftPortal) {
      this.state = NetherPortalState.WANDERING;
      this.leftPortal = true;
      return null;
    }

    return null;
  }

  private handleWandering(): Task | null {
    const portal = this.findNearestNetherPortal();
    if (portal) {
      this.currentPortalPos = portal;
      this.state = NetherPortalState.APPROACHING;
      return null;
    }

    return new TimeoutWanderTask(this.bot, 5);
  }

  onStop(interruptTask: ITask | null): void {
    this.bot.clearControlStates();
    this.currentPortalPos = null;
  }

  isFinished(): boolean {
    return this.state === NetherPortalState.FINISHED ||
           this.getCurrentDimension() === this.targetDimension;
  }

  private findNearestNetherPortal(): Vec3 | null {
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
              if (this.config.portalFilter && !this.config.portalFilter(checkPos)) {
                continue;
              }

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
 * Helper to enter the nether (legacy API)
 */
export function enterNetherLegacy(bot: Bot): EnterNetherPortalTask {
  return new EnterNetherPortalTask(bot, Dimension.NETHER);
}

/**
 * Helper to return to overworld (legacy API)
 */
export function returnToOverworld(bot: Bot): EnterNetherPortalTask {
  return new EnterNetherPortalTask(bot, Dimension.OVERWORLD);
}
