/**
 * WorldLocateBlacklist - Block Position Blacklisting
 * Based on AltoClef/BaritonePlus WorldLocateBlacklist.java
 *
 * Blacklist for world block positions that have proven unreachable.
 */

import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { AbstractObjectBlacklist } from './AbstractObjectBlacklist';

/**
 * Blacklist for world block positions
 */
export class WorldLocateBlacklist extends AbstractObjectBlacklist<Vec3> {
  constructor(bot: Bot) {
    super(bot);
  }

  protected getPos(item: Vec3): Vec3 {
    return item;
  }

  protected getKey(item: Vec3): string {
    return `${Math.floor(item.x)},${Math.floor(item.y)},${Math.floor(item.z)}`;
  }

  /**
   * Blacklist by coordinates directly
   */
  blacklistPosition(x: number, y: number, z: number, failuresAllowed: number = 3): void {
    this.blacklistItem(new Vec3(x, y, z), failuresAllowed);
  }

  /**
   * Check if coordinates are unreachable
   */
  isPositionUnreachable(x: number, y: number, z: number): boolean {
    return this.unreachable(new Vec3(x, y, z));
  }

  /**
   * Clear blacklist for coordinates
   */
  clearPosition(x: number, y: number, z: number): void {
    this.clearItem(new Vec3(x, y, z));
  }
}

export default WorldLocateBlacklist;
