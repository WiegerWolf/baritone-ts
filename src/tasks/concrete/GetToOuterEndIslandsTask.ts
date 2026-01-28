/**
 * GetToOuterEndIslandsTask - Travel to the Outer End Islands
 * Based on BaritonePlus GetToOuterEndIslandsTask.java
 *
 * Intent: After beating the Ender Dragon, travel to the outer End islands
 * via the End Gateway using an ender pearl. This is required to reach
 * End Cities for elytra and shulker boxes.
 *
 * Process:
 * 1. Beat the game to spawn End Gateway
 * 2. Obtain ender pearl
 * 3. Navigate close to gateway
 * 4. Throw pearl into gateway to teleport
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { Task } from '../Task';
import type { ITask } from '../interfaces';
import { BlockPos } from '../../types';
import { GoToNearTask, GetToBlockTask } from './GoToTask';
import { BeatMinecraftTask } from './BeatMinecraftTask';
import { ThrowEnderPearlSimpleProjectileTask } from './ThrowEnderPearlTask';
import { GoalAnd, GoalComposite, GoalYLevel, GoalGetToBlock } from '../../goals';
import { Dimension } from './ResourceTask';

/**
 * State for GetToOuterEndIslandsTask
 */
export enum OuterEndIslandsState {
  BEATING_GAME,
  GETTING_PEARL,
  NAVIGATING_TO_GATEWAY,
  THROWING_PEARL,
  FINISHED,
  FAILED,
}

/**
 * Offsets around gateway for safe standing positions
 */
const GATEWAY_OFFSETS = [
  { x: 1, y: -1, z: 1 },
  { x: 1, y: -1, z: -1 },
  { x: -1, y: -1, z: 1 },
  { x: -1, y: -1, z: -1 },
  { x: 2, y: -1, z: 0 },
  { x: 0, y: -1, z: 2 },
  { x: -2, y: -1, z: 0 },
  { x: 0, y: -1, z: -2 },
];

/**
 * Radius of the main End island
 */
export const END_ISLAND_START_RADIUS = 800;

/**
 * GetToOuterEndIslandsTask - Navigate to the outer End islands
 *
 * This task orchestrates beating the game (if needed) and then using
 * the End Gateway to teleport to the outer islands where End Cities spawn.
 */
export class GetToOuterEndIslandsTask extends Task {
  private state: OuterEndIslandsState = OuterEndIslandsState.BEATING_GAME;
  private beatGameTask: BeatMinecraftTask | null = null;
  private gatewayPos: Vec3 | null = null;
  private throwTask: ThrowEnderPearlSimpleProjectileTask | null = null;

  constructor(bot: Bot) {
    super(bot);
  }

  get displayName(): string {
    return 'GetToOuterEndIslands';
  }

  onStart(): void {
    this.state = OuterEndIslandsState.BEATING_GAME;
    this.beatGameTask = null;
    this.gatewayPos = null;
    this.throwTask = null;
  }

  onTick(): Task | null {
    // Check if already at outer islands
    if (this.isAtOuterIslands()) {
      this.state = OuterEndIslandsState.FINISHED;
      return null;
    }

    switch (this.state) {
      case OuterEndIslandsState.BEATING_GAME:
        return this.handleBeatingGame();

      case OuterEndIslandsState.GETTING_PEARL:
        return this.handleGettingPearl();

      case OuterEndIslandsState.NAVIGATING_TO_GATEWAY:
        return this.handleNavigatingToGateway();

      case OuterEndIslandsState.THROWING_PEARL:
        return this.handleThrowingPearl();

      default:
        return null;
    }
  }

  private handleBeatingGame(): Task | null {
    // Check for End Gateway
    const gateway = this.findEndGateway();
    if (gateway) {
      this.gatewayPos = gateway;
      this.state = OuterEndIslandsState.GETTING_PEARL;
      return null;
    }

    // Check if we're in the End - if so, we've beaten the game
    // but gateway might not be loaded yet
    if (this.getCurrentDimension() === Dimension.END) {
      // Wait for gateway or wander to find it
      return null;
    }

    // Need to beat the game first
    if (!this.beatGameTask) {
      this.beatGameTask = new BeatMinecraftTask(this.bot);
    }

    return this.beatGameTask;
  }

  private handleGettingPearl(): Task | null {
    // Check if we have an ender pearl
    if (this.hasEnderPearl()) {
      this.state = OuterEndIslandsState.NAVIGATING_TO_GATEWAY;
      return null;
    }

    // Try to find pearls in inventory or nearby
    // In the End, we could kill endermen
    // For now, just fail if no pearl (shouldn't happen after beating game)
    this.state = OuterEndIslandsState.FAILED;
    return null;
  }

  private handleNavigatingToGateway(): Task | null {
    if (!this.gatewayPos) {
      this.state = OuterEndIslandsState.BEATING_GAME;
      return null;
    }

    // Check if close enough to gateway
    const playerPos = this.bot.entity.position;
    const dist = playerPos.distanceTo(this.gatewayPos);

    if (dist <= 5 && this.bot.entity.onGround) {
      this.state = OuterEndIslandsState.THROWING_PEARL;
      return null;
    }

    // Navigate to a safe position near the gateway
    // Use one of the offset positions
    const best = this.findBestApproachPosition();
    if (best) {
      return new GetToBlockTask(this.bot, best.x, best.y, best.z);
    }

    // Fallback: just go near the gateway
    return new GoToNearTask(
      this.bot,
      Math.floor(this.gatewayPos.x),
      Math.floor(this.gatewayPos.y),
      Math.floor(this.gatewayPos.z),
      4
    );
  }

  private handleThrowingPearl(): Task | null {
    if (!this.gatewayPos) {
      this.state = OuterEndIslandsState.NAVIGATING_TO_GATEWAY;
      return null;
    }

    // Throw pearl at gateway
    if (!this.throwTask) {
      this.throwTask = new ThrowEnderPearlSimpleProjectileTask(
        this.bot,
        this.gatewayPos
      );
    }

    if (this.throwTask.isFinished()) {
      // Pearl thrown - should teleport us
      // Check if we're at outer islands after a moment
      this.state = OuterEndIslandsState.FINISHED;
      return null;
    }

    return this.throwTask;
  }

  // ---- Helper methods ----

  private findEndGateway(): Vec3 | null {
    // Search for end_gateway blocks nearby
    const playerPos = this.bot.entity.position;
    const searchRadius = 100;

    for (let x = -searchRadius; x <= searchRadius; x += 4) {
      for (let z = -searchRadius; z <= searchRadius; z += 4) {
        for (let y = 50; y <= 100; y += 4) {
          const pos = new Vec3(
            Math.floor(playerPos.x) + x,
            y,
            Math.floor(playerPos.z) + z
          );
          const block = this.bot.blockAt(pos);
          if (block?.name === 'end_gateway') {
            return pos;
          }
        }
      }
    }

    return null;
  }

  private hasEnderPearl(): boolean {
    return this.bot.inventory.items().some(item => item.name === 'ender_pearl');
  }

  private findBestApproachPosition(): BlockPos | null {
    if (!this.gatewayPos) return null;

    const gx = Math.floor(this.gatewayPos.x);
    const gy = Math.floor(this.gatewayPos.y);
    const gz = Math.floor(this.gatewayPos.z);

    // Find a valid standing position from the offsets
    for (const offset of GATEWAY_OFFSETS) {
      const pos = new BlockPos(gx + offset.x, gy + offset.y, gz + offset.z);
      const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
      const blockAbove = this.bot.blockAt(new Vec3(pos.x, pos.y + 1, pos.z));

      // Check if standing position is solid and space above is clear
      if (block?.boundingBox === 'block' && blockAbove?.boundingBox === 'empty') {
        return new BlockPos(pos.x, pos.y + 1, pos.z);
      }
    }

    return null;
  }

  private getCurrentDimension(): Dimension {
    const dimensionName = (this.bot as any).game?.dimension ?? '';
    if (dimensionName.includes('nether')) return Dimension.NETHER;
    if (dimensionName.includes('end')) return Dimension.END;
    return Dimension.OVERWORLD;
  }

  private isAtOuterIslands(): boolean {
    // Check if we're in the End and far from 0,0
    if (this.getCurrentDimension() !== Dimension.END) {
      return false;
    }

    const playerPos = this.bot.entity.position;
    const distFromCenter = Math.sqrt(
      playerPos.x * playerPos.x + playerPos.z * playerPos.z
    );

    return distFromCenter > END_ISLAND_START_RADIUS;
  }

  onStop(interruptTask: ITask | null): void {
    // Clean up
  }

  isFinished(): boolean {
    return this.state === OuterEndIslandsState.FINISHED ||
           this.state === OuterEndIslandsState.FAILED ||
           this.isAtOuterIslands();
  }

  isFailed(): boolean {
    return this.state === OuterEndIslandsState.FAILED;
  }

  isEqual(other: ITask | null): boolean {
    return other instanceof GetToOuterEndIslandsTask;
  }
}

/**
 * Factory function
 */
export function getToOuterEndIslands(bot: Bot): GetToOuterEndIslandsTask {
  return new GetToOuterEndIslandsTask(bot);
}

export default {
  GetToOuterEndIslandsTask,
  getToOuterEndIslands,
  OuterEndIslandsState,
  END_ISLAND_START_RADIUS,
};
