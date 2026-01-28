# Custom Extensions

Baritone-TS is designed for extensibility. You can create custom goals, movements, processes, tasks, and trackers.

## Custom Goals

### Basic Custom Goal

```typescript
import { Goal } from 'baritone-ts';

class GoalDiamond implements Goal {
  constructor(private bot: Bot) {}

  isEnd(x: number, y: number, z: number): boolean {
    // Goal is satisfied when standing on diamond ore
    const block = this.bot.blockAt(new Vec3(x, y - 1, z));
    return block?.name === 'diamond_ore' || block?.name === 'deepslate_diamond_ore';
  }

  heuristic(x: number, y: number, z: number): number {
    // Estimate: prefer Y=11 where diamonds are common
    const optimalY = 11;
    const yDistance = Math.abs(y - optimalY);
    return yDistance * 4; // ~4 ticks per block vertical
  }
}

// Usage
bot.pathfinder.setGoal(new GoalDiamond(bot));
```

### Dynamic Goal

```typescript
class GoalClosestOre implements Goal {
  private targetPos: Vec3 | null = null;

  constructor(
    private bot: Bot,
    private oreTypes: string[]
  ) {}

  private updateTarget(): void {
    const tracker = this.bot.pathfinder.trackers.blocks;
    const nearest = tracker.findNearest(this.oreTypes);
    this.targetPos = nearest;
  }

  isEnd(x: number, y: number, z: number): boolean {
    this.updateTarget();
    if (!this.targetPos) return false;

    // Adjacent to ore
    const dx = Math.abs(x - this.targetPos.x);
    const dy = Math.abs(y - this.targetPos.y);
    const dz = Math.abs(z - this.targetPos.z);
    return dx <= 1 && dy <= 1 && dz <= 1 && (dx + dy + dz) >= 1;
  }

  heuristic(x: number, y: number, z: number): number {
    this.updateTarget();
    if (!this.targetPos) return Infinity;

    const dx = Math.abs(x - this.targetPos.x);
    const dy = Math.abs(y - this.targetPos.y);
    const dz = Math.abs(z - this.targetPos.z);

    // Manhattan distance * sprint cost
    return (dx + dy + dz) * 3.564;
  }
}
```

### Composite Goal

```typescript
class GoalAnyOf implements Goal {
  constructor(private goals: Goal[]) {}

  isEnd(x: number, y: number, z: number): boolean {
    return this.goals.some(g => g.isEnd(x, y, z));
  }

  heuristic(x: number, y: number, z: number): number {
    // Return lowest heuristic (closest goal)
    return Math.min(...this.goals.map(g => g.heuristic(x, y, z)));
  }
}

class GoalAllOf implements Goal {
  constructor(private goals: Goal[]) {}

  isEnd(x: number, y: number, z: number): boolean {
    return this.goals.every(g => g.isEnd(x, y, z));
  }

  heuristic(x: number, y: number, z: number): number {
    // Return highest heuristic (furthest goal)
    return Math.max(...this.goals.map(g => g.heuristic(x, y, z)));
  }
}
```

## Custom Movements

### Basic Custom Movement

```typescript
import { Movement, MovementStatus, MoveResult, CalculationContext } from 'baritone-ts';
import { Vec3 } from 'vec3';

class MovementTeleport extends Movement {
  constructor(
    from: Vec3,
    to: Vec3,
    private teleportCost: number = 100
  ) {
    super(from, to);
  }

  getCost(ctx: CalculationContext, result: MoveResult): number {
    // Check if teleportation is possible
    const hasPearl = ctx.hasItem('ender_pearl');
    if (!hasPearl) {
      result.cost = Infinity;
      return Infinity;
    }

    // Calculate cost based on distance
    const distance = this.from.distanceTo(this.to);
    result.cost = this.teleportCost + distance;
    return result.cost;
  }

  tick(ctx: CalculationContext): MovementStatus {
    switch (this.state) {
      case 'PREPPING':
        // Equip ender pearl
        if (!this.equipPearl(ctx)) {
          return MovementStatus.FAILED;
        }
        this.state = 'AIMING';
        return MovementStatus.RUNNING;

      case 'AIMING':
        // Look at target
        ctx.lookHelper.lookAt(this.to);
        if (ctx.lookHelper.isLookingAt(this.to, 0.1)) {
          this.state = 'THROWING';
        }
        return MovementStatus.RUNNING;

      case 'THROWING':
        // Throw pearl
        ctx.bot.activateItem();
        this.state = 'WAITING';
        return MovementStatus.RUNNING;

      case 'WAITING':
        // Wait for teleportation
        if (ctx.bot.entity.position.distanceTo(this.to) < 2) {
          return MovementStatus.SUCCESS;
        }
        return MovementStatus.RUNNING;

      default:
        return MovementStatus.FAILED;
    }
  }

  private equipPearl(ctx: CalculationContext): boolean {
    const pearl = ctx.bot.inventory.findInventoryItem('ender_pearl');
    if (!pearl) return false;
    ctx.bot.equip(pearl, 'hand');
    return true;
  }
}
```

### Register Custom Movement

```typescript
// Add to movement factory
ctx.movementFactory.registerGenerator('teleport', (from, ctx) => {
  const movements: Movement[] = [];

  // Only generate if we have pearls
  if (!ctx.hasItem('ender_pearl')) {
    return movements;
  }

  // Generate teleport movements to nearby positions
  const radius = 20;
  for (let dx = -radius; dx <= radius; dx += 4) {
    for (let dz = -radius; dz <= radius; dz += 4) {
      const to = from.offset(dx, 0, dz);
      if (ctx.isPassable(to) && ctx.isSolid(to.offset(0, -1, 0))) {
        movements.push(new MovementTeleport(from, to));
      }
    }
  }

  return movements;
});
```

## Custom Processes

### Basic Custom Process

```typescript
import { BaseProcess, ProcessTickResult, Goal } from 'baritone-ts';

interface PatrolOptions {
  waypoints: Vec3[];
  loop: boolean;
  waitTime: number;
}

class PatrolProcess extends BaseProcess {
  private currentIndex = 0;
  private waitUntil = 0;

  constructor(
    bot: Bot,
    pathfinder: Pathfinder,
    private options: PatrolOptions
  ) {
    super(bot, pathfinder, options);
  }

  onTick(): ProcessTickResult {
    // Check if waiting
    if (Date.now() < this.waitUntil) {
      return { idle: true };
    }

    // Get current waypoint
    const waypoint = this.options.waypoints[this.currentIndex];

    // Check if at waypoint
    const distance = this.bot.entity.position.distanceTo(waypoint);
    if (distance < 2) {
      // Wait at waypoint
      this.waitUntil = Date.now() + this.options.waitTime;

      // Move to next waypoint
      this.currentIndex++;
      if (this.currentIndex >= this.options.waypoints.length) {
        if (this.options.loop) {
          this.currentIndex = 0;
        } else {
          return { complete: true };
        }
      }

      return { idle: true };
    }

    // Path to waypoint
    return {
      goal: new GoalNear(waypoint.x, waypoint.y, waypoint.z, 2)
    };
  }

  onStart(): void {
    console.log('Starting patrol');
    this.currentIndex = 0;
  }

  onStop(): void {
    console.log('Patrol stopped');
  }
}

// Usage
const patrol = new PatrolProcess(bot, bot.pathfinder, {
  waypoints: [
    new Vec3(0, 64, 0),
    new Vec3(50, 64, 0),
    new Vec3(50, 64, 50),
    new Vec3(0, 64, 50)
  ],
  loop: true,
  waitTime: 5000
});

bot.pathfinder.processManager.register('patrol', patrol);
bot.pathfinder.processManager.activate('patrol');
```

## Custom Tasks

### Basic Custom Task

```typescript
import { Task, TaskStatus } from 'baritone-ts';

interface CollectDropsOptions {
  itemNames: string[];
  radius: number;
  timeout: number;
}

class CollectDropsTask extends Task {
  private startTime = 0;

  constructor(
    bot: Bot,
    private options: CollectDropsOptions
  ) {
    super(bot);
  }

  get name(): string {
    return 'CollectDropsTask';
  }

  tick(): TaskStatus {
    // Check timeout
    if (Date.now() - this.startTime > this.options.timeout) {
      return TaskStatus.SUCCESS; // Timeout = done
    }

    // Find nearby items
    const items = Object.values(this.bot.entities)
      .filter(e => e.type === 'object' && e.objectType === 'Item')
      .filter(e => e.position.distanceTo(this.bot.entity.position) < this.options.radius)
      .filter(e => this.options.itemNames.includes(e.metadata[8]?.itemId || ''));

    if (items.length === 0) {
      return TaskStatus.SUCCESS; // No items left
    }

    // Go to nearest item
    const nearest = items.reduce((a, b) =>
      a.position.distanceTo(this.bot.entity.position) <
      b.position.distanceTo(this.bot.entity.position) ? a : b
    );

    this.pathfinder.setGoal(new GoalNear(
      nearest.position.x,
      nearest.position.y,
      nearest.position.z,
      1
    ));

    return TaskStatus.IN_PROGRESS;
  }

  onStart(): void {
    this.startTime = Date.now();
  }

  reset(): void {
    this.startTime = 0;
  }

  cancel(): void {
    this.pathfinder.stop();
  }
}
```

### Composite Task

```typescript
import { Task, TaskStatus } from 'baritone-ts';

class MiningExpeditionTask extends Task {
  private subtask: Task | null = null;
  private phase: 'prepare' | 'mine' | 'return' = 'prepare';
  private startPosition: Vec3 | null = null;

  constructor(
    bot: Bot,
    private options: { ores: string[]; quantity: number }
  ) {
    super(bot);
  }

  get name(): string {
    return 'MiningExpeditionTask';
  }

  tick(): TaskStatus {
    // Execute subtask if set
    if (this.subtask) {
      const status = this.subtask.tick();
      if (status === TaskStatus.IN_PROGRESS) {
        return TaskStatus.IN_PROGRESS;
      }
      if (status === TaskStatus.FAILED) {
        return TaskStatus.FAILED;
      }
      this.subtask = null;
    }

    switch (this.phase) {
      case 'prepare':
        // Ensure we have a pickaxe
        if (!this.hasPick()) {
          this.subtask = new CraftItemTask(this.bot, {
            itemName: 'iron_pickaxe',
            quantity: 1
          });
          return TaskStatus.IN_PROGRESS;
        }
        this.startPosition = this.bot.entity.position.clone();
        this.phase = 'mine';
        return TaskStatus.IN_PROGRESS;

      case 'mine':
        // Check if we have enough ores
        const count = this.countOres();
        if (count >= this.options.quantity) {
          this.phase = 'return';
          return TaskStatus.IN_PROGRESS;
        }

        // Mine ores
        this.subtask = new MineOresTask(this.bot, {
          targetOres: this.options.ores,
          quantity: this.options.quantity - count
        });
        return TaskStatus.IN_PROGRESS;

      case 'return':
        // Return to start
        const distance = this.bot.entity.position.distanceTo(this.startPosition!);
        if (distance < 3) {
          return TaskStatus.SUCCESS;
        }

        this.subtask = new GoToPositionTask(this.bot, {
          position: this.startPosition!,
          tolerance: 3
        });
        return TaskStatus.IN_PROGRESS;

      default:
        return TaskStatus.FAILED;
    }
  }

  private hasPick(): boolean {
    return this.bot.inventory.items().some(i =>
      i.name.includes('pickaxe')
    );
  }

  private countOres(): number {
    return this.bot.inventory.items()
      .filter(i => this.options.ores.some(o => i.name.includes(o.replace('_ore', ''))))
      .reduce((sum, i) => sum + i.count, 0);
  }

  reset(): void {
    this.subtask = null;
    this.phase = 'prepare';
    this.startPosition = null;
  }
}
```

## Custom Trackers

### Basic Custom Tracker

```typescript
import { Tracker } from 'baritone-ts';

interface PlayerData {
  name: string;
  position: Vec3;
  health: number;
  distance: number;
  lastSeen: number;
}

class PlayerTracker extends Tracker<PlayerData[]> {
  private players: Map<string, PlayerData> = new Map();
  private updateInterval = 20; // ticks

  protected shouldUpdate(): boolean {
    return this.ticksSinceUpdate >= this.updateInterval;
  }

  protected doUpdate(): PlayerData[] {
    const now = Date.now();

    // Update known players
    for (const player of Object.values(this.bot.players)) {
      if (player.entity && player.username !== this.bot.username) {
        this.players.set(player.username, {
          name: player.username,
          position: player.entity.position.clone(),
          health: player.entity.health,
          distance: player.entity.position.distanceTo(this.bot.entity.position),
          lastSeen: now
        });
      }
    }

    // Remove stale players
    for (const [name, data] of this.players) {
      if (now - data.lastSeen > 60000) { // 1 minute
        this.players.delete(name);
      }
    }

    return Array.from(this.players.values());
  }

  getPlayers(): PlayerData[] {
    this.ensureUpdated();
    return Array.from(this.players.values());
  }

  getPlayer(name: string): PlayerData | undefined {
    this.ensureUpdated();
    return this.players.get(name);
  }

  getNearestPlayer(): PlayerData | undefined {
    const players = this.getPlayers();
    if (players.length === 0) return undefined;
    return players.reduce((a, b) => a.distance < b.distance ? a : b);
  }

  getPlayersInRange(range: number): PlayerData[] {
    return this.getPlayers().filter(p => p.distance <= range);
  }
}

// Register and use
const playerTracker = new PlayerTracker(bot, ctx);
trackers.register('players', playerTracker);

const nearbyPlayers = trackers.get('players').getPlayersInRange(20);
```

## Extension Best Practices

### Goal Best Practices

1. **Keep heuristic admissible** - Never overestimate cost
2. **Make heuristic fast** - Called frequently during search
3. **Handle edge cases** - Return `Infinity` for impossible goals

### Movement Best Practices

1. **Use state machine pattern** - Clear state transitions
2. **Handle interruptions** - Check for validity each tick
3. **Report costs accurately** - Use tick-based costs

### Process Best Practices

1. **Single responsibility** - One behavior per process
2. **Handle activation/deactivation** - Clean up state
3. **Support pausing** - Save and restore state

### Task Best Practices

1. **Clear completion criteria** - Know when done
2. **Handle prerequisites** - Delegate to subtasks
3. **Support cancellation** - Clean up on cancel

### Tracker Best Practices

1. **Lazy evaluation** - Only update when accessed
2. **Cache appropriately** - Balance freshness vs performance
3. **Clean up old data** - Prevent memory leaks
