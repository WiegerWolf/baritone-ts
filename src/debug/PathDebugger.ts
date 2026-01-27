/**
 * PathDebugger - Visual debugging utilities for pathfinding
 *
 * Provides tools to visualize and debug paths, movements, and A* state.
 * Can output to console or generate data for external visualization.
 */

import { PathNode, BlockPos, Goal } from '../types';
import { PathResult } from '../types';

/**
 * Debug event types
 */
export type DebugEventType =
  | 'path_start'
  | 'path_complete'
  | 'node_visited'
  | 'node_expanded'
  | 'movement_start'
  | 'movement_complete'
  | 'goal_check'
  | 'obstacle_detected'
  | 'path_invalidated';

/**
 * Debug event data
 */
export interface DebugEvent {
  type: DebugEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Path visualization options
 */
export interface VisualizationOptions {
  showCosts: boolean;
  showHeuristics: boolean;
  showParents: boolean;
  maxWidth: number;
  maxHeight: number;
}

const DEFAULT_VIZ_OPTIONS: VisualizationOptions = {
  showCosts: true,
  showHeuristics: false,
  showParents: true,
  maxWidth: 80,
  maxHeight: 40
};

/**
 * PathDebugger class for debugging pathfinding
 */
export class PathDebugger {
  private events: DebugEvent[] = [];
  private enabled: boolean = true;
  private maxEvents: number = 10000;
  private listeners: Map<DebugEventType, Array<(event: DebugEvent) => void>> = new Map();

  /**
   * Enable/disable debugging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if debugging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Log a debug event
   */
  log(type: DebugEventType, data: Record<string, unknown> = {}): void {
    if (!this.enabled) return;

    const event: DebugEvent = {
      type,
      timestamp: performance.now(),
      data
    };

    this.events.push(event);

    // Trim old events if needed
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents / 2);
    }

    // Notify listeners
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        listener(event);
      }
    }
  }

  /**
   * Add event listener
   */
  on(type: DebugEventType, listener: (event: DebugEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off(type: DebugEventType, listener: (event: DebugEvent) => void): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      const index = typeListeners.indexOf(listener);
      if (index >= 0) {
        typeListeners.splice(index, 1);
      }
    }
  }

  /**
   * Get all events
   */
  getEvents(): DebugEvent[] {
    return [...this.events];
  }

  /**
   * Get events of a specific type
   */
  getEventsByType(type: DebugEventType): DebugEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get statistics about the pathfinding
   */
  getStats(): {
    totalEvents: number;
    nodesVisited: number;
    nodesExpanded: number;
    pathsComputed: number;
    totalTime: number;
  } {
    const nodesVisited = this.events.filter(e => e.type === 'node_visited').length;
    const nodesExpanded = this.events.filter(e => e.type === 'node_expanded').length;
    const pathStarts = this.events.filter(e => e.type === 'path_start');
    const pathCompletes = this.events.filter(e => e.type === 'path_complete');

    let totalTime = 0;
    for (let i = 0; i < Math.min(pathStarts.length, pathCompletes.length); i++) {
      totalTime += pathCompletes[i].timestamp - pathStarts[i].timestamp;
    }

    return {
      totalEvents: this.events.length,
      nodesVisited,
      nodesExpanded,
      pathsComputed: pathCompletes.length,
      totalTime
    };
  }
}

/**
 * Visualize a path as ASCII art
 */
export function visualizePath(
  path: PathNode[],
  options: Partial<VisualizationOptions> = {}
): string {
  if (path.length === 0) return 'Empty path';

  const opts = { ...DEFAULT_VIZ_OPTIONS, ...options };

  // Find bounds
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const node of path) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minZ = Math.min(minZ, node.z);
    maxZ = Math.max(maxZ, node.z);
  }

  // Add padding
  minX -= 1;
  maxX += 1;
  minZ -= 1;
  maxZ += 1;

  // Limit size
  const width = Math.min(maxX - minX + 1, opts.maxWidth);
  const height = Math.min(maxZ - minZ + 1, opts.maxHeight);

  // Create grid
  const grid: string[][] = [];
  for (let z = 0; z < height; z++) {
    grid.push(new Array(width).fill('.'));
  }

  // Plot path
  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    const x = node.x - minX;
    const z = node.z - minZ;

    if (x >= 0 && x < width && z >= 0 && z < height) {
      if (i === 0) {
        grid[z][x] = 'S'; // Start
      } else if (i === path.length - 1) {
        grid[z][x] = 'E'; // End
      } else {
        // Direction indicator
        const prev = path[i - 1];
        const dx = node.x - prev.x;
        const dz = node.z - prev.z;

        if (dx > 0) grid[z][x] = '>';
        else if (dx < 0) grid[z][x] = '<';
        else if (dz > 0) grid[z][x] = 'v';
        else if (dz < 0) grid[z][x] = '^';
        else grid[z][x] = '*';
      }
    }
  }

  // Build output
  const lines: string[] = [];
  lines.push(`Path: ${path.length} nodes`);
  lines.push(`Bounds: (${minX},${minZ}) to (${maxX},${maxZ})`);
  lines.push('');

  // Top border
  lines.push('┌' + '─'.repeat(width) + '┐');

  // Grid
  for (const row of grid) {
    lines.push('│' + row.join('') + '│');
  }

  // Bottom border
  lines.push('└' + '─'.repeat(width) + '┘');

  // Legend
  lines.push('');
  lines.push('Legend: S=Start, E=End, ><v^=Direction, .=Empty');

  if (opts.showCosts && path.length > 0) {
    lines.push(`Total cost: ${path[path.length - 1].cost.toFixed(2)}`);
  }

  return lines.join('\n');
}

/**
 * Visualize A* search state
 */
export function visualizeSearchState(
  visited: Set<string>,
  open: PathNode[],
  current: PathNode | null,
  goal: Goal,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; y: number }
): string {
  const width = Math.min(bounds.maxX - bounds.minX + 1, 60);
  const height = Math.min(bounds.maxZ - bounds.minZ + 1, 30);

  // Create grid
  const grid: string[][] = [];
  for (let z = 0; z < height; z++) {
    grid.push(new Array(width).fill('.'));
  }

  // Plot visited nodes
  for (const hash of visited) {
    const [x, y, z] = hash.split(',').map(Number);
    if (y === bounds.y) {
      const gx = x - bounds.minX;
      const gz = z - bounds.minZ;
      if (gx >= 0 && gx < width && gz >= 0 && gz < height) {
        grid[gz][gx] = '·';
      }
    }
  }

  // Plot open nodes
  for (const node of open) {
    if (node.y === bounds.y) {
      const gx = node.x - bounds.minX;
      const gz = node.z - bounds.minZ;
      if (gx >= 0 && gx < width && gz >= 0 && gz < height) {
        grid[gz][gx] = 'o';
      }
    }
  }

  // Plot current node
  if (current && current.y === bounds.y) {
    const gx = current.x - bounds.minX;
    const gz = current.z - bounds.minZ;
    if (gx >= 0 && gx < width && gz >= 0 && gz < height) {
      grid[gz][gx] = '@';
    }
  }

  // Build output
  const lines: string[] = [];
  lines.push(`A* Search State (Y=${bounds.y})`);
  lines.push(`Visited: ${visited.size}, Open: ${open.length}`);
  lines.push('');

  for (const row of grid) {
    lines.push(row.join(''));
  }

  lines.push('');
  lines.push('Legend: .=unvisited, ·=visited, o=open, @=current');

  return lines.join('\n');
}

/**
 * Format path result for debugging
 */
export function formatPathResult(result: PathResult): string {
  const lines: string[] = [];

  lines.push('=== Path Result ===');
  lines.push(`Status: ${result.status}`);
  lines.push(`Path length: ${result.path.length} nodes`);

  if (result.path.length > 0) {
    const start = result.path[0];
    const end = result.path[result.path.length - 1];
    lines.push(`Start: (${start.x}, ${start.y}, ${start.z})`);
    lines.push(`End: (${end.x}, ${end.y}, ${end.z})`);
    lines.push(`Total cost: ${end.cost.toFixed(2)} ticks`);

    // Calculate distance
    let distance = 0;
    for (let i = 1; i < result.path.length; i++) {
      const prev = result.path[i - 1];
      const curr = result.path[i];
      distance += Math.sqrt(
        Math.pow(curr.x - prev.x, 2) +
        Math.pow(curr.y - prev.y, 2) +
        Math.pow(curr.z - prev.z, 2)
      );
    }
    lines.push(`Distance: ${distance.toFixed(2)} blocks`);
  }

  return lines.join('\n');
}

/**
 * Create a path trace showing each step
 */
export function tracePathSteps(path: PathNode[]): string {
  const lines: string[] = [];

  lines.push('=== Path Trace ===');
  lines.push('');

  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    const prefix = i === 0 ? 'START' : i === path.length - 1 ? 'END  ' : `${i.toString().padStart(5)}`;

    let direction = '';
    if (i > 0) {
      const prev = path[i - 1];
      const dx = node.x - prev.x;
      const dy = node.y - prev.y;
      const dz = node.z - prev.z;

      if (dy > 0) direction = '↑';
      else if (dy < 0) direction = '↓';
      else if (dx > 0 && dz === 0) direction = '→';
      else if (dx < 0 && dz === 0) direction = '←';
      else if (dz > 0 && dx === 0) direction = '↓';
      else if (dz < 0 && dx === 0) direction = '↑';
      else if (dx > 0 && dz > 0) direction = '↘';
      else if (dx > 0 && dz < 0) direction = '↗';
      else if (dx < 0 && dz > 0) direction = '↙';
      else if (dx < 0 && dz < 0) direction = '↖';
    }

    lines.push(
      `${prefix} ${direction.padEnd(2)} (${node.x.toString().padStart(4)}, ${node.y.toString().padStart(3)}, ${node.z.toString().padStart(4)}) cost=${node.cost.toFixed(2)}`
    );
  }

  return lines.join('\n');
}

/**
 * Global debug instance
 */
export const pathDebugger = new PathDebugger();
