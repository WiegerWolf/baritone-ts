import { Goal } from '../types';
import { WALK_ONE_BLOCK_COST } from '../core/ActionCosts';

/**
 * Goal to follow an entity (dynamic goal)
 */
export class GoalFollow implements Goal {
  private lastX: number;
  private lastY: number;
  private lastZ: number;

  public readonly rangeSq: number;

  constructor(
    public readonly entity: any, // Mineflayer entity
    public readonly range: number = 2
  ) {
    this.lastX = Math.floor(entity.position.x);
    this.lastY = Math.floor(entity.position.y);
    this.lastZ = Math.floor(entity.position.z);
    this.rangeSq = range * range;
  }

  isEnd(x: number, y: number, z: number): boolean {
    this.updatePosition();
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dz = z - this.lastZ;
    return dx * dx + dy * dy + dz * dz <= this.rangeSq;
  }

  heuristic(x: number, y: number, z: number): number {
    this.updatePosition();
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dz = z - this.lastZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return Math.max(0, dist - this.range) * WALK_ONE_BLOCK_COST;
  }

  private updatePosition(): void {
    if (this.entity?.position) {
      this.lastX = Math.floor(this.entity.position.x);
      this.lastY = Math.floor(this.entity.position.y);
      this.lastZ = Math.floor(this.entity.position.z);
    }
  }

  /**
   * Check if entity has moved significantly (goal changed)
   */
  hasChanged(): boolean {
    if (!this.entity?.position) return false;
    const x = Math.floor(this.entity.position.x);
    const y = Math.floor(this.entity.position.y);
    const z = Math.floor(this.entity.position.z);
    return x !== this.lastX || y !== this.lastY || z !== this.lastZ;
  }

  /**
   * Check if goal is still valid (entity exists)
   */
  isValid(): boolean {
    return this.entity != null && this.entity.position != null;
  }
}
