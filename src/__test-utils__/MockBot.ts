/**
 * Mock Bot for testing Baritone-TS without a real Minecraft server
 *
 * Provides a minimal implementation of the mineflayer Bot interface
 * sufficient for unit and integration testing of pathfinding logic.
 */

import { EventEmitter } from 'events';
import { Vec3 } from 'vec3';

/**
 * Mock block for testing
 */
export interface MockBlock {
  name: string;
  type: number;
  position: Vec3;
  hardness: number;
  diggable: boolean;
  boundingBox: 'block' | 'empty';
  stateId?: number;
}

/**
 * Mock world for testing
 */
export class MockWorld {
  private blocks: Map<string, MockBlock> = new Map();

  private posKey(x: number, y: number, z: number): string {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }

  setBlock(x: number, y: number, z: number, block: Partial<MockBlock>): void {
    const pos = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
    this.blocks.set(this.posKey(x, y, z), {
      name: block.name || 'stone',
      type: block.type || 1,
      position: pos,
      hardness: block.hardness ?? 1.5,
      diggable: block.diggable ?? true,
      boundingBox: block.boundingBox || 'block',
      stateId: block.stateId
    });
  }

  getBlock(pos: Vec3): MockBlock | null {
    const key = this.posKey(pos.x, pos.y, pos.z);
    return this.blocks.get(key) || null;
  }

  /**
   * Fill a region with a block type
   */
  fillRegion(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    block: Partial<MockBlock>
  ): void {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          this.setBlock(x, y, z, block);
        }
      }
    }
  }

  /**
   * Create a flat floor
   */
  createFloor(
    x1: number, z1: number,
    x2: number, z2: number,
    y: number,
    block: Partial<MockBlock> = { name: 'stone' }
  ): void {
    this.fillRegion(x1, y, z1, x2, y, z2, block);
  }

  /**
   * Create air above a region
   */
  createAir(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
  ): void {
    this.fillRegion(x1, y1, z1, x2, y2, z2, {
      name: 'air',
      type: 0,
      hardness: 0,
      diggable: false,
      boundingBox: 'empty'
    });
  }

  /**
   * Clear all blocks
   */
  clear(): void {
    this.blocks.clear();
  }
}

/**
 * Mock entity for testing
 */
export interface MockEntity {
  id: number;
  name: string;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  isValid: boolean;
  height: number;
  width: number;
}

/**
 * Mock inventory item
 */
export interface MockItem {
  name: string;
  count: number;
  type: number;
  slot: number;
}

/**
 * Mock inventory
 */
export class MockInventory extends EventEmitter {
  private _items: MockItem[] = [];
  slots: (MockItem | null)[] = new Array(46).fill(null);

  items(): MockItem[] {
    return this._items.filter(i => i.count > 0);
  }

  addItem(item: MockItem): void {
    this._items.push(item);
    if (item.slot >= 0 && item.slot < this.slots.length) {
      this.slots[item.slot] = item;
    }
    this.emit('updateSlot', item.slot, null, item);
  }

  removeItem(name: string, count: number = 1): boolean {
    const item = this._items.find(i => i.name === name && i.count >= count);
    if (item) {
      item.count -= count;
      return true;
    }
    return false;
  }

  findItem(name: string): MockItem | null {
    return this._items.find(i => i.name === name && i.count > 0) || null;
  }
}

/**
 * Control states for the bot
 */
interface ControlStates {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  sneak: boolean;
}

/**
 * Mock Bot implementation
 */
export class MockBot extends EventEmitter {
  // Entity properties
  entity: MockEntity;

  // World
  private _world: MockWorld;

  // Inventory
  inventory: MockInventory;

  // Control states
  private controlStates: ControlStates = {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    sneak: false
  };

  // Other entities
  entities: { [id: number]: MockEntity } = {};

  // Physics simulation
  private physicsInterval: NodeJS.Timeout | null = null;
  private readonly TICK_MS = 50;

  constructor(options: { position?: Vec3; world?: MockWorld } = {}) {
    super();

    this.entity = {
      id: 0,
      name: 'MockBot',
      position: options.position || new Vec3(0, 64, 0),
      velocity: new Vec3(0, 0, 0),
      yaw: 0,
      pitch: 0,
      onGround: true,
      isValid: true,
      height: 1.8,
      width: 0.6
    };

    this._world = options.world || new MockWorld();
    this.inventory = new MockInventory();
  }

  // World access
  get blockAt(): (pos: Vec3) => MockBlock | null {
    return (pos: Vec3) => this._world.getBlock(pos);
  }

  get world(): MockWorld {
    return this._world;
  }

  // Control state management
  setControlState(control: keyof ControlStates, state: boolean): void {
    this.controlStates[control] = state;
  }

  getControlState(control: keyof ControlStates): boolean {
    return this.controlStates[control];
  }

  clearControlStates(): void {
    this.controlStates = {
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      sneak: false
    };
  }

  // Look direction
  look(yaw: number, pitch: number, force: boolean = false): Promise<void> {
    this.entity.yaw = yaw;
    this.entity.pitch = pitch;
    return Promise.resolve();
  }

  lookAt(point: Vec3, force: boolean = false): Promise<void> {
    const delta = point.minus(this.entity.position);
    const yaw = Math.atan2(-delta.x, delta.z);
    const groundDist = Math.sqrt(delta.x * delta.x + delta.z * delta.z);
    const pitch = Math.atan2(delta.y, groundDist);
    return this.look(yaw, pitch, force);
  }

  // Movement simulation
  startPhysics(): void {
    if (this.physicsInterval) return;

    this.physicsInterval = setInterval(() => {
      this.tickPhysics();
      this.emit('physicsTick');
    }, this.TICK_MS);
  }

  stopPhysics(): void {
    if (this.physicsInterval) {
      clearInterval(this.physicsInterval);
      this.physicsInterval = null;
    }
  }

  private tickPhysics(): void {
    const pos = this.entity.position;
    const vel = this.entity.velocity;

    // Apply gravity
    if (!this.entity.onGround) {
      vel.y -= 0.08; // Gravity
      vel.y *= 0.98; // Air resistance
    }

    // Apply movement
    if (this.controlStates.forward) {
      const speed = this.controlStates.sprint ? 0.28 : 0.216;
      vel.x += Math.sin(this.entity.yaw) * speed;
      vel.z += Math.cos(this.entity.yaw) * speed;
    }

    if (this.controlStates.jump && this.entity.onGround) {
      vel.y = 0.42; // Jump velocity
      this.entity.onGround = false;
    }

    // Apply velocity with friction
    pos.x += vel.x;
    pos.y += vel.y;
    pos.z += vel.z;

    vel.x *= 0.91;
    vel.z *= 0.91;

    // Ground check
    const groundBlock = this._world.getBlock(new Vec3(pos.x, pos.y - 1, pos.z));
    if (groundBlock && groundBlock.boundingBox === 'block' && pos.y <= Math.floor(pos.y) + 1) {
      pos.y = Math.floor(pos.y) + 1;
      vel.y = 0;
      this.entity.onGround = true;
    }
  }

  // Digging
  async dig(block: MockBlock, forceLook: boolean = false): Promise<void> {
    if (!block.diggable) {
      throw new Error('Block is not diggable');
    }

    // Simulate dig time
    const digTime = block.hardness * 1000; // Simplified
    await new Promise(resolve => setTimeout(resolve, Math.min(digTime, 100)));

    // Remove block from world
    this._world.setBlock(
      block.position.x,
      block.position.y,
      block.position.z,
      { name: 'air', type: 0, boundingBox: 'empty', diggable: false }
    );

    this.emit('diggingCompleted', block);
  }

  // Placing
  async placeBlock(referenceBlock: MockBlock, faceVector: Vec3): Promise<void> {
    const placePos = referenceBlock.position.plus(faceVector);

    this._world.setBlock(
      placePos.x,
      placePos.y,
      placePos.z,
      { name: 'cobblestone', type: 4, boundingBox: 'block' }
    );

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Equipment
  async equip(item: MockItem, destination: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Item usage
  activateItem(offHand: boolean = false): void {
    this.emit('itemUsed', offHand);
  }

  deactivateItem(): void {
    this.emit('itemDeactivated');
  }

  // Entity interaction
  attack(entity: MockEntity): void {
    this.emit('attack', entity);
  }

  mount(entity: MockEntity): void {
    this.emit('mount', entity);
  }

  dismount(): void {
    this.emit('dismount');
  }

  // Add test entity
  addEntity(entity: Partial<MockEntity>): MockEntity {
    const id = Object.keys(this.entities).length + 1;
    const fullEntity: MockEntity = {
      id,
      name: entity.name || 'entity',
      position: entity.position || new Vec3(0, 64, 0),
      velocity: entity.velocity || new Vec3(0, 0, 0),
      yaw: entity.yaw || 0,
      pitch: entity.pitch || 0,
      onGround: entity.onGround ?? true,
      isValid: entity.isValid ?? true,
      height: entity.height || 1.8,
      width: entity.width || 0.6
    };
    this.entities[id] = fullEntity;
    return fullEntity;
  }

  // Cleanup
  end(): void {
    this.stopPhysics();
    this.removeAllListeners();
  }
}

/**
 * Create a mock bot with a simple flat world
 */
export function createMockBot(options: {
  position?: Vec3;
  floorY?: number;
  floorRadius?: number;
} = {}): MockBot {
  const world = new MockWorld();

  // Create floor
  const y = options.floorY ?? 63;
  const r = options.floorRadius ?? 50;

  world.createFloor(-r, -r, r, r, y);
  world.createAir(-r, y + 1, -r, r, y + 10, r);

  const pos = options.position || new Vec3(0, y + 1, 0);
  return new MockBot({ position: pos, world });
}

/**
 * Create a mock bot with obstacles for pathfinding tests
 */
export function createMockBotWithObstacles(): MockBot {
  const world = new MockWorld();

  // Create floor
  world.createFloor(-20, -20, 20, 20, 63);
  world.createAir(-20, 64, -20, 20, 74, 20);

  // Create some walls
  world.fillRegion(-5, 64, -10, -5, 66, 10, { name: 'stone' }); // Vertical wall
  world.fillRegion(5, 64, -10, 5, 66, 10, { name: 'stone' }); // Parallel wall

  // Create gaps in walls
  world.createAir(-5, 64, -2, -5, 66, 2); // Gap in first wall
  world.createAir(5, 64, -2, 5, 66, 2); // Gap in second wall

  // Create a pit
  world.createAir(-3, 60, 5, 3, 63, 8);

  return new MockBot({ position: new Vec3(0, 64, 0), world });
}
