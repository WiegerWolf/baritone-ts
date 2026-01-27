import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import { BaseProcess, ProcessPriority, ProcessTickResult, ProcessState } from './Process';
import { Goal } from '../types';
import { GoalNear, GoalGetToBlock } from '../goals';

/**
 * BuildProcess handles automated building
 * Based on Baritone's building behavior
 *
 * Features:
 * - Build from simple block lists
 * - Place blocks in correct order
 * - Break incorrect blocks
 * - Handle scaffolding for unreachable positions
 */

/**
 * Block placement instruction
 */
export interface PlaceInstruction {
  // Position to place at
  pos: Vec3;
  // Block type to place
  blockName: string;
  // Priority (lower = earlier)
  priority?: number;
}

/**
 * Build configuration
 */
export interface BuildConfig {
  // Build from bottom to top (recommended)
  bottomToTop: boolean;
  // Break blocks that don't match
  correctMisplaced: boolean;
  // Place scaffolding if needed
  useScaffolding: boolean;
  // Scaffolding block name
  scaffoldingBlock: string;
  // Maximum reach distance
  maxReach: number;
  // Pause between placements (ticks)
  placementDelay: number;
}

const DEFAULT_CONFIG: BuildConfig = {
  bottomToTop: true,
  correctMisplaced: true,
  useScaffolding: false,
  scaffoldingBlock: 'dirt',
  maxReach: 4.5,
  placementDelay: 2
};

type BuildState = 'planning' | 'moving' | 'breaking' | 'placing' | 'complete';

export class BuildProcess extends BaseProcess {
  readonly displayName = 'Build';

  private config: BuildConfig;
  private instructions: PlaceInstruction[] = [];
  private remainingInstructions: PlaceInstruction[] = [];
  private currentInstruction: PlaceInstruction | null = null;
  private buildState: BuildState = 'planning';
  private blocksPlaced: number = 0;
  private blocksBroken: number = 0;
  private lastPlaceTick: number = 0;
  private scaffoldPositions: Vec3[] = [];

  constructor(bot: Bot, pathfinder: any, config: Partial<BuildConfig> = {}) {
    super(bot, pathfinder, ProcessPriority.NORMAL);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set build instructions
   */
  setInstructions(instructions: PlaceInstruction[]): void {
    this.instructions = [...instructions];
    this.sortInstructions();
    this.remainingInstructions = [...this.instructions];
    this.currentInstruction = null;
    this.buildState = 'planning';
  }

  /**
   * Add a single placement instruction
   */
  addInstruction(pos: Vec3, blockName: string, priority?: number): void {
    this.instructions.push({ pos: pos.clone(), blockName, priority });
    this.sortInstructions();
    this.remainingInstructions = this.instructions.filter(i => !this.isPlaced(i));
  }

  /**
   * Create a simple box build
   */
  createBox(corner1: Vec3, corner2: Vec3, blockName: string): void {
    const instructions: PlaceInstruction[] = [];

    const minX = Math.min(corner1.x, corner2.x);
    const maxX = Math.max(corner1.x, corner2.x);
    const minY = Math.min(corner1.y, corner2.y);
    const maxY = Math.max(corner1.y, corner2.y);
    const minZ = Math.min(corner1.z, corner2.z);
    const maxZ = Math.max(corner1.z, corner2.z);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          // Only place on edges (hollow box)
          const isEdge = x === minX || x === maxX ||
                        y === minY || y === maxY ||
                        z === minZ || z === maxZ;
          if (isEdge) {
            instructions.push({
              pos: new Vec3(x, y, z),
              blockName,
              priority: y // Build from bottom to top
            });
          }
        }
      }
    }

    this.setInstructions(instructions);
  }

  /**
   * Create a floor/platform
   */
  createFloor(corner1: Vec3, corner2: Vec3, blockName: string): void {
    const instructions: PlaceInstruction[] = [];

    const minX = Math.min(corner1.x, corner2.x);
    const maxX = Math.max(corner1.x, corner2.x);
    const y = corner1.y;
    const minZ = Math.min(corner1.z, corner2.z);
    const maxZ = Math.max(corner1.z, corner2.z);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        instructions.push({
          pos: new Vec3(x, y, z),
          blockName,
          priority: 0
        });
      }
    }

    this.setInstructions(instructions);
  }

  /**
   * Create a wall
   */
  createWall(start: Vec3, end: Vec3, height: number, blockName: string): void {
    const instructions: PlaceInstruction[] = [];

    const dx = Math.sign(end.x - start.x);
    const dz = Math.sign(end.z - start.z);
    const length = Math.max(Math.abs(end.x - start.x), Math.abs(end.z - start.z));

    for (let y = 0; y < height; y++) {
      for (let i = 0; i <= length; i++) {
        const x = start.x + (dx * i);
        const z = start.z + (dz * i);
        instructions.push({
          pos: new Vec3(x, start.y + y, z),
          blockName,
          priority: y
        });
      }
    }

    this.setInstructions(instructions);
  }

  /**
   * Sort instructions by priority and Y level
   */
  private sortInstructions(): void {
    this.instructions.sort((a, b) => {
      // First by priority if set
      if (a.priority !== undefined && b.priority !== undefined) {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
      }

      // Then by Y level (bottom to top if configured)
      if (this.config.bottomToTop) {
        return a.pos.y - b.pos.y;
      }
      return b.pos.y - a.pos.y;
    });
  }

  onActivate(): void {
    super.onActivate();
    this.blocksPlaced = 0;
    this.blocksBroken = 0;
    this.buildState = 'planning';
    this.remainingInstructions = this.instructions.filter(i => !this.isPlaced(i));
  }

  onDeactivate(): void {
    super.onDeactivate();
    this.currentInstruction = null;
  }

  tick(): ProcessTickResult {
    switch (this.buildState) {
      case 'planning':
        return this.handlePlanning();
      case 'moving':
        return this.handleMoving();
      case 'breaking':
        return this.handleBreaking();
      case 'placing':
        return this.handlePlacing();
      case 'complete':
        return this.completeResult(
          `Built ${this.blocksPlaced} blocks, broke ${this.blocksBroken}`
        );
    }
  }

  private handlePlanning(): ProcessTickResult {
    // Filter out already placed blocks
    this.remainingInstructions = this.remainingInstructions.filter(i => !this.isPlaced(i));

    if (this.remainingInstructions.length === 0) {
      this.buildState = 'complete';
      return this.completeResult(
        `Build complete: ${this.blocksPlaced} placed, ${this.blocksBroken} broken`
      );
    }

    // Find next instruction that can be placed
    this.currentInstruction = this.findNextPlaceable();

    if (!this.currentInstruction) {
      // Check if we need scaffolding
      if (this.config.useScaffolding) {
        const needsScaffold = this.remainingInstructions[0];
        if (needsScaffold) {
          // Try to build scaffolding
          const scaffoldPos = this.findScaffoldPosition(needsScaffold.pos);
          if (scaffoldPos) {
            this.currentInstruction = {
              pos: scaffoldPos,
              blockName: this.config.scaffoldingBlock,
              priority: -1
            };
            this.scaffoldPositions.push(scaffoldPos);
          }
        }
      }

      if (!this.currentInstruction) {
        return this.failedResult('Cannot find placeable position');
      }
    }

    this.buildState = 'moving';
    return this.waitResult(`Planning: ${this.remainingInstructions.length} blocks remaining`);
  }

  private handleMoving(): ProcessTickResult {
    if (!this.currentInstruction) {
      this.buildState = 'planning';
      return this.waitResult('No current instruction');
    }

    const pos = this.bot.entity.position;
    const targetPos = this.currentInstruction.pos;
    const dist = pos.distanceTo(targetPos);

    if (dist <= this.config.maxReach) {
      // Check if we need to break first
      const block = this.bot.blockAt(targetPos);
      if (block && block.name !== 'air' && block.name !== this.currentInstruction.blockName) {
        if (this.config.correctMisplaced) {
          this.buildState = 'breaking';
          return this.waitResult('Breaking misplaced block');
        }
      }

      // Ready to place
      this.buildState = 'placing';
      return this.waitResult('Ready to place');
    }

    // Need to move closer
    const goal = new GoalNear(targetPos.x, targetPos.y, targetPos.z, this.config.maxReach - 1);
    return this.newGoalResult(goal, `Moving to build position`);
  }

  private handleBreaking(): ProcessTickResult {
    if (!this.currentInstruction) {
      this.buildState = 'planning';
      return this.waitResult('No instruction');
    }

    const block = this.bot.blockAt(this.currentInstruction.pos);
    if (!block || block.name === 'air') {
      // Already broken
      this.buildState = 'placing';
      return this.waitResult('Block cleared');
    }

    // Break the block
    this.bot.dig(block).then(() => {
      this.blocksBroken++;
      this.buildState = 'placing';
    }).catch(() => {
      this.buildState = 'planning';
    });

    return this.waitResult('Breaking block...');
  }

  private handlePlacing(): ProcessTickResult {
    if (!this.currentInstruction) {
      this.buildState = 'planning';
      return this.waitResult('No instruction');
    }

    // Check placement delay
    const currentTick = Date.now();
    if (currentTick - this.lastPlaceTick < this.config.placementDelay * 50) {
      return this.waitResult('Waiting for placement cooldown');
    }

    const targetPos = this.currentInstruction.pos;
    const block = this.bot.blockAt(targetPos);

    // Check if already placed correctly
    if (block && block.name === this.currentInstruction.blockName) {
      this.currentInstruction = null;
      this.buildState = 'planning';
      return this.waitResult('Block already placed');
    }

    // Find a reference block to place against
    const referenceBlock = this.findReferenceBlock(targetPos);
    if (!referenceBlock) {
      // Can't place here yet
      this.currentInstruction = null;
      this.buildState = 'planning';
      return this.waitResult('No reference block found');
    }

    // Find the item to place
    const placeItem = this.bot.inventory.items().find(
      item => item.name === this.currentInstruction!.blockName ||
              item.name === this.currentInstruction!.blockName.replace('_block', '')
    );

    if (!placeItem) {
      return this.failedResult(`Missing block: ${this.currentInstruction.blockName}`);
    }

    // Equip and place
    this.bot.equip(placeItem, 'hand').then(() => {
      const faceVector = new Vec3(
        targetPos.x - referenceBlock.position.x,
        targetPos.y - referenceBlock.position.y,
        targetPos.z - referenceBlock.position.z
      );
      return this.bot.placeBlock(referenceBlock, faceVector);
    }).then(() => {
      this.blocksPlaced++;
      this.lastPlaceTick = Date.now();
      this.currentInstruction = null;
      this.buildState = 'planning';
    }).catch(() => {
      this.currentInstruction = null;
      this.buildState = 'planning';
    });

    return this.waitResult('Placing block...');
  }

  /**
   * Check if instruction is already placed correctly
   */
  private isPlaced(instruction: PlaceInstruction): boolean {
    const block = this.bot.blockAt(instruction.pos);
    return block !== null && block.name === instruction.blockName;
  }

  /**
   * Find the next instruction that can be placed
   */
  private findNextPlaceable(): PlaceInstruction | null {
    const pos = this.bot.entity.position;

    for (const instruction of this.remainingInstructions) {
      // Check if already placed
      if (this.isPlaced(instruction)) continue;

      // Check if we have a reference block
      const ref = this.findReferenceBlock(instruction.pos);
      if (!ref) continue;

      // Check if reachable (or will be after moving)
      return instruction;
    }

    return null;
  }

  /**
   * Find a solid block adjacent to target position
   */
  private findReferenceBlock(targetPos: Vec3): any | null {
    const directions = [
      new Vec3(0, -1, 0), // Below
      new Vec3(0, 1, 0),  // Above
      new Vec3(1, 0, 0),  // East
      new Vec3(-1, 0, 0), // West
      new Vec3(0, 0, 1),  // South
      new Vec3(0, 0, -1)  // North
    ];

    for (const dir of directions) {
      const checkPos = targetPos.plus(dir);
      const block = this.bot.blockAt(checkPos);
      if (block && block.boundingBox === 'block') {
        return block;
      }
    }

    return null;
  }

  /**
   * Find position for scaffolding to reach target
   */
  private findScaffoldPosition(targetPos: Vec3): Vec3 | null {
    // Try to place scaffold below target
    const below = targetPos.offset(0, -1, 0);
    const belowBlock = this.bot.blockAt(below);

    if (belowBlock && belowBlock.name === 'air') {
      // Check if we can place scaffold here
      if (this.findReferenceBlock(below)) {
        return below;
      }
    }

    // Try adjacent positions
    const adjacent = [
      targetPos.offset(1, 0, 0),
      targetPos.offset(-1, 0, 0),
      targetPos.offset(0, 0, 1),
      targetPos.offset(0, 0, -1)
    ];

    for (const pos of adjacent) {
      const block = this.bot.blockAt(pos);
      if (block && block.name === 'air' && this.findReferenceBlock(pos)) {
        return pos;
      }
    }

    return null;
  }

  /**
   * Get build progress
   */
  getProgress(): { placed: number; remaining: number; total: number } {
    return {
      placed: this.blocksPlaced,
      remaining: this.remainingInstructions.length,
      total: this.instructions.length
    };
  }

  /**
   * Get current instruction
   */
  getCurrentInstruction(): PlaceInstruction | null {
    return this.currentInstruction;
  }
}
