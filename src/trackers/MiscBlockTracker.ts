/**
 * MiscBlockTracker - Miscellaneous Block Tracking
 * Based on BaritonePlus MiscBlockTracker.java
 *
 * Tracks specific block-related state that doesn't fit in other trackers:
 * - Last used nether portal per dimension
 * - Dimension transition handling
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BlockPos } from '../types';

/**
 * Dimension enum
 */
export enum Dimension {
  OVERWORLD = 'overworld',
  NETHER = 'the_nether',
  END = 'the_end',
}

/**
 * Get current dimension from bot
 */
function getCurrentDimension(bot: Bot): Dimension {
  const dimensionName = (bot as any).game?.dimension ?? '';
  if (dimensionName.includes('nether')) return Dimension.NETHER;
  if (dimensionName.includes('end')) return Dimension.END;
  return Dimension.OVERWORLD;
}

/**
 * MiscBlockTracker - Track miscellaneous block positions
 *
 * This tracker remembers important block positions across dimension changes,
 * such as the nether portal used to enter each dimension.
 */
export class MiscBlockTracker {
  private bot: Bot;
  private lastNetherPortals: Map<Dimension, BlockPos> = new Map();
  private lastDimension: Dimension | null = null;
  private newDimensionTriggered: boolean = false;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  /**
   * Update tracking state - call each tick
   */
  tick(): void {
    const currentDim = getCurrentDimension(this.bot);

    // Detect dimension change
    if (currentDim !== this.lastDimension) {
      this.lastDimension = currentDim;
      this.newDimensionTriggered = true;
    }

    // After dimension change, look for nether portal
    if (this.newDimensionTriggered) {
      this.searchForNetherPortal();
    }
  }

  /**
   * Search for nether portal near player after dimension change
   */
  private searchForNetherPortal(): void {
    const playerPos = this.bot.entity.position;
    const searchPos = new BlockPos(
      Math.floor(playerPos.x),
      Math.floor(playerPos.y),
      Math.floor(playerPos.z)
    );

    // Search in 3x3x3 area around player
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const checkPos = new Vec3(
            searchPos.x + dx,
            searchPos.y + dy,
            searchPos.z + dz
          );

          const block = this.bot.blockAt(checkPos);
          if (block?.name === 'nether_portal') {
            // Find lowest portal block
            let portalPos = checkPos.clone();
            while (portalPos.y > 0) {
              const below = this.bot.blockAt(portalPos.offset(0, -1, 0));
              if (below?.name === 'nether_portal') {
                portalPos = portalPos.offset(0, -1, 0);
              } else {
                break;
              }
            }

            // Check if block below portal is solid
            const belowPortal = this.bot.blockAt(portalPos.offset(0, -1, 0));
            if (belowPortal?.boundingBox === 'block') {
              const currentDim = getCurrentDimension(this.bot);
              this.lastNetherPortals.set(
                currentDim,
                new BlockPos(
                  Math.floor(portalPos.x),
                  Math.floor(portalPos.y),
                  Math.floor(portalPos.z)
                )
              );
              this.newDimensionTriggered = false;
              return;
            }
          }
        }
      }
    }
  }

  /**
   * Get the last used nether portal in a dimension
   */
  getLastUsedNetherPortal(dimension: Dimension): BlockPos | null {
    const portalPos = this.lastNetherPortals.get(dimension);
    if (!portalPos) return null;

    // Verify portal still exists
    const block = this.bot.blockAt(new Vec3(portalPos.x, portalPos.y, portalPos.z));
    if (block?.name !== 'nether_portal') {
      this.lastNetherPortals.delete(dimension);
      return null;
    }

    return portalPos;
  }

  /**
   * Set a known portal position
   */
  setNetherPortal(dimension: Dimension, pos: BlockPos): void {
    this.lastNetherPortals.set(dimension, pos);
  }

  /**
   * Check if we have a recorded portal for a dimension
   */
  hasNetherPortal(dimension: Dimension): boolean {
    return this.lastNetherPortals.has(dimension);
  }

  /**
   * Reset all tracked portals
   */
  reset(): void {
    this.lastNetherPortals.clear();
    this.newDimensionTriggered = false;
  }

  /**
   * Get all tracked portals
   */
  getAllPortals(): Map<Dimension, BlockPos> {
    return new Map(this.lastNetherPortals);
  }
}

export default MiscBlockTracker;
