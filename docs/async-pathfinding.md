# Async Pathfinding

Baritone-TS supports non-blocking path computation for responsive bots.

## Overview

Path computation can be expensive for long distances. Async pathfinding allows:
- UI responsiveness during computation
- Progress tracking and cancellation
- Timeout handling
- Background computation

## Basic Async Navigation

Use `goto()` for promise-based navigation:

```typescript
import { GoalBlock } from 'baritone-ts';

async function navigate() {
  const goal = new GoalBlock(100, 64, 100);

  try {
    await bot.pathfinder.goto(goal);
    console.log('Arrived!');
  } catch (error) {
    console.log('Navigation failed:', error.message);
  }
}
```

## Async Path Computation

Compute a path without immediately executing it:

```typescript
import { computePathAsync, GoalBlock } from 'baritone-ts';

const goal = new GoalBlock(100, 64, 100);

const result = await computePathAsync(
  bot.entity.position.x,
  bot.entity.position.y,
  bot.entity.position.z,
  goal,
  bot.pathfinder.ctx
);

if (result.status === 'success') {
  console.log(`Found path with ${result.path.length} movements`);
  // Optionally execute it
  bot.pathfinder.setPath(result.path);
}
```

## Path Computation Options

```typescript
const result = await computePathAsync(
  startX, startY, startZ,
  goal,
  ctx,
  {
    // Timeout
    timeout: 10000,          // Max computation time (ms)

    // Progress callback
    onProgress: (progress) => {
      console.log(`Progress: ${(progress.estimatedProgress * 100).toFixed(1)}%`);
      console.log(`Nodes explored: ${progress.nodesExplored}`);
      console.log(`Best distance: ${progress.bestDistanceToGoal}`);
    },

    // Cancellation
    signal: abortController.signal,

    // Partial results
    allowPartial: true,      // Return best path even if incomplete
    minPartialLength: 10,    // Minimum movements for partial path

    // Performance tuning
    nodesPerYield: 1000,     // Nodes between async yields
  }
);
```

## Result Object

```typescript
interface PathResult {
  status: 'success' | 'partial' | 'failed' | 'timeout' | 'cancelled';

  // The computed path (if any)
  path: Movement[];

  // Statistics
  nodesExplored: number;
  computationTime: number;  // ms
  pathLength: number;       // movements
  pathCost: number;         // total ticks

  // For partial results
  distanceToGoal: number;

  // Error info (if failed)
  error?: Error;
}
```

## Progress Tracking

Monitor computation progress:

```typescript
const result = await computePathAsync(
  startX, startY, startZ,
  goal,
  ctx,
  {
    onProgress: (progress) => {
      // Estimated completion (0-1)
      const percent = progress.estimatedProgress * 100;

      // Nodes explored so far
      const nodes = progress.nodesExplored;

      // Best heuristic distance found
      const distance = progress.bestDistanceToGoal;

      // Current best path cost
      const cost = progress.bestPathCost;

      console.log(`${percent.toFixed(1)}% | ${nodes} nodes | ${distance.toFixed(1)} blocks away`);
    }
  }
);
```

## Cancellation

Cancel a running computation:

```typescript
const controller = new AbortController();

// Start computation
const promise = computePathAsync(
  startX, startY, startZ,
  goal,
  ctx,
  { signal: controller.signal }
);

// Cancel after 5 seconds
setTimeout(() => {
  controller.abort();
}, 5000);

try {
  const result = await promise;
  if (result.status === 'cancelled') {
    console.log('Computation was cancelled');
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Computation aborted');
  }
}
```

## Timeout Handling

```typescript
const result = await computePathAsync(
  startX, startY, startZ,
  goal,
  ctx,
  {
    timeout: 5000,  // 5 second timeout
    allowPartial: true
  }
);

switch (result.status) {
  case 'success':
    console.log('Found complete path');
    break;
  case 'partial':
    console.log(`Timed out, but found partial path (${result.distanceToGoal} blocks from goal)`);
    break;
  case 'timeout':
    console.log('Timed out with no usable path');
    break;
}
```

## Multi-Coefficient A*

Baritone-TS uses 7 A* coefficient variants for graceful degradation:

```typescript
// Coefficients tried in order (higher = more greedy)
const COEFFICIENTS = [
  1.0,    // Optimal (slowest)
  1.5,
  2.0,
  2.5,
  3.0,
  4.0,
  5.0     // Most greedy (fastest)
];
```

As timeout approaches, the algorithm switches to more greedy coefficients:

```typescript
const result = await computePathAsync(
  startX, startY, startZ,
  goal,
  ctx,
  {
    timeout: 10000,
    onProgress: (progress) => {
      console.log(`Using coefficient: ${progress.currentCoefficient}`);
    }
  }
);
```

## Parallel Path Computation

Compute multiple paths simultaneously:

```typescript
import { computePathAsync, GoalBlock } from 'baritone-ts';

const destinations = [
  new GoalBlock(100, 64, 100),
  new GoalBlock(200, 64, 200),
  new GoalBlock(300, 64, 300)
];

const results = await Promise.all(
  destinations.map(goal =>
    computePathAsync(
      bot.entity.position.x,
      bot.entity.position.y,
      bot.entity.position.z,
      goal,
      bot.pathfinder.ctx,
      { timeout: 5000 }
    )
  )
);

// Find best path
const validResults = results.filter(r => r.status === 'success');
const bestPath = validResults.reduce((best, current) =>
  current.pathCost < best.pathCost ? current : best
);
```

## Background Computation

Compute path in background while doing other things:

```typescript
// Start computation
const pathPromise = computePathAsync(
  startX, startY, startZ,
  goal,
  ctx,
  {
    timeout: 30000,
    onProgress: (p) => console.log(`Computing: ${(p.estimatedProgress * 100).toFixed(1)}%`)
  }
);

// Do other things while computing
await doOtherStuff();

// Wait for result
const result = await pathPromise;
```

## Worker Thread Computation

For truly non-blocking computation, use worker threads:

```typescript
import { AsyncPathfinder } from 'baritone-ts';

const asyncPathfinder = new AsyncPathfinder(bot.pathfinder.ctx, {
  useWorker: true,  // Use worker thread
  workerCount: 2    // Number of workers
});

const result = await asyncPathfinder.computePath(
  bot.entity.position,
  goal
);
```

## Chunked Pathfinding

For very long distances, compute path in chunks:

```typescript
import { computePathAsync, GoalNear, GoalBlock } from 'baritone-ts';

async function pathInChunks(start, finalGoal, chunkSize = 64) {
  const paths = [];
  let current = { ...start };

  while (true) {
    // Compute distance to goal
    const dx = finalGoal.x - current.x;
    const dz = finalGoal.z - current.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // If close enough, path directly to goal
    if (distance <= chunkSize) {
      const result = await computePathAsync(
        current.x, current.y, current.z,
        new GoalBlock(finalGoal.x, finalGoal.y, finalGoal.z),
        ctx
      );
      if (result.status === 'success') {
        paths.push(result.path);
      }
      break;
    }

    // Otherwise, path toward goal
    const ratio = chunkSize / distance;
    const intermediateX = current.x + dx * ratio;
    const intermediateZ = current.z + dz * ratio;

    const result = await computePathAsync(
      current.x, current.y, current.z,
      new GoalXZ(intermediateX, intermediateZ),
      ctx,
      { timeout: 5000, allowPartial: true }
    );

    if (result.status === 'failed') break;

    paths.push(result.path);

    // Update current position
    const lastMove = result.path[result.path.length - 1];
    current = lastMove.dest;
  }

  // Merge all paths
  return mergePaths(paths);
}
```

## Events

```typescript
bot.on('path_started', () => {
  console.log('Path computation started');
});

bot.on('path_progress', (progress) => {
  console.log(`${(progress.estimatedProgress * 100).toFixed(1)}% complete`);
});

bot.on('path_found', (path) => {
  console.log(`Found path with ${path.length} movements`);
});

bot.on('path_failed', (error) => {
  console.log('Path computation failed:', error.message);
});
```

## Example: Responsive Navigation

```typescript
import { createBot } from 'mineflayer';
import { pathfinder, computePathAsync, GoalBlock } from 'baritone-ts';

const bot = createBot({ host: 'localhost', username: 'AsyncBot' });

bot.once('spawn', () => {
  pathfinder(bot);
});

bot.on('chat', async (username, message) => {
  const match = message.match(/^goto (-?\d+) (-?\d+) (-?\d+)$/);
  if (!match) return;

  const [, x, y, z] = match.map(Number);
  const goal = new GoalBlock(x, y, z);

  console.log('Computing path...');

  const result = await computePathAsync(
    bot.entity.position.x,
    bot.entity.position.y,
    bot.entity.position.z,
    goal,
    bot.pathfinder.ctx,
    {
      timeout: 10000,
      allowPartial: true,
      onProgress: (p) => {
        // Update every second
        if (Date.now() % 1000 < 50) {
          bot.chat(`Computing: ${(p.estimatedProgress * 100).toFixed(0)}%`);
        }
      }
    }
  );

  switch (result.status) {
    case 'success':
      bot.chat(`Found path! ${result.path.length} movements, ETA: ${(result.pathCost / 20).toFixed(1)}s`);
      bot.pathfinder.setPath(result.path);
      break;

    case 'partial':
      bot.chat(`Found partial path (${result.distanceToGoal.toFixed(1)} blocks from goal)`);
      bot.pathfinder.setPath(result.path);
      break;

    case 'timeout':
    case 'failed':
      bot.chat('Could not find path to destination');
      break;
  }
});
```
