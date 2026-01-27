import { PathNode, PathResult, Goal, CalculationContext, BlockPos } from '../types';
import { AStar } from './AStar';

/**
 * AsyncPathfinder provides non-blocking path computation
 * Based on Baritone's async pathfinding approach
 *
 * Key features:
 * - Non-blocking computation using chunked processing
 * - Progress callbacks
 * - Cancellation support
 * - Automatic timeout handling
 */

/**
 * Async path computation options
 */
export interface AsyncPathOptions {
  // Maximum time per computation chunk (ms)
  chunkTimeMs: number;
  // Total timeout (ms)
  totalTimeoutMs: number;
  // Progress callback (called after each chunk)
  onProgress?: (progress: AsyncPathProgress) => void;
  // Completion callback
  onComplete?: (result: PathResult) => void;
  // Error callback
  onError?: (error: Error) => void;
}

/**
 * Progress information during async computation
 */
export interface AsyncPathProgress {
  // Nodes visited so far
  visitedNodes: number;
  // Nodes generated so far
  generatedNodes: number;
  // Best cost so far
  bestCostSoFar: number;
  // Estimated progress (0-1)
  estimatedProgress: number;
  // Elapsed time (ms)
  elapsedMs: number;
  // Has partial path
  hasPartialPath: boolean;
}

/**
 * Async path computation state
 */
export enum AsyncPathState {
  IDLE,
  COMPUTING,
  COMPLETE,
  CANCELLED,
  ERROR
}

const DEFAULT_OPTIONS: AsyncPathOptions = {
  chunkTimeMs: 20,     // 20ms per chunk (one tick)
  totalTimeoutMs: 10000 // 10 second total timeout
};

export class AsyncPathfinder {
  private astar: AStar | null = null;
  private state: AsyncPathState = AsyncPathState.IDLE;
  private options: AsyncPathOptions;
  private startTime: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private result: PathResult | null = null;

  constructor(options: Partial<AsyncPathOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Start async path computation
   */
  compute(
    startX: number,
    startY: number,
    startZ: number,
    goal: Goal,
    ctx: CalculationContext
  ): Promise<PathResult> {
    return new Promise((resolve, reject) => {
      // Cancel any existing computation
      this.cancel();

      // Initialize A*
      this.astar = new AStar(
        startX, startY, startZ,
        goal,
        ctx,
        this.options.totalTimeoutMs,
        this.options.totalTimeoutMs / 2
      );

      this.state = AsyncPathState.COMPUTING;
      this.startTime = Date.now();
      this.result = null;

      // Set up completion/error handlers
      const complete = (result: PathResult) => {
        this.cleanup();
        this.state = AsyncPathState.COMPLETE;
        this.result = result;
        this.options.onComplete?.(result);
        resolve(result);
      };

      const error = (err: Error) => {
        this.cleanup();
        this.state = AsyncPathState.ERROR;
        this.options.onError?.(err);
        reject(err);
      };

      // Start chunked computation
      this.intervalId = setInterval(() => {
        try {
          this.computeChunk(complete, error);
        } catch (e) {
          error(e as Error);
        }
      }, 0); // Run as fast as possible, but yield to event loop
    });
  }

  /**
   * Compute one chunk of the path
   */
  private computeChunk(
    complete: (result: PathResult) => void,
    error: (err: Error) => void
  ): void {
    if (!this.astar || this.state !== AsyncPathState.COMPUTING) {
      return;
    }

    // Check total timeout
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.options.totalTimeoutMs) {
      // Return result with timeout status (will contain best partial path)
      const result = this.astar.compute(1); // One last computation to get final result
      complete({
        ...result,
        status: 'timeout'
      });
      return;
    }

    // Compute for chunk time
    const result = this.astar.compute(this.options.chunkTimeMs);

    // Report progress
    if (this.options.onProgress) {
      const progress: AsyncPathProgress = {
        visitedNodes: result.visitedNodes,
        generatedNodes: result.generatedNodes,
        bestCostSoFar: result.cost,
        estimatedProgress: this.estimateProgress(result),
        elapsedMs: elapsed,
        hasPartialPath: result.path.length > 0
      };
      this.options.onProgress(progress);
    }

    // Check if complete
    if (result.status === 'success' || result.status === 'noPath') {
      complete(result);
      return;
    }

    // Continue if partial
    if (result.status === 'timeout') {
      complete(result);
    }
  }

  /**
   * Estimate progress (rough approximation)
   */
  private estimateProgress(result: PathResult): number {
    if (result.status === 'success') return 1;
    if (result.status === 'noPath') return 1;

    // Estimate based on time used
    const elapsed = Date.now() - this.startTime;
    const timeProgress = elapsed / this.options.totalTimeoutMs;

    // Cap at 0.95 until actually complete
    return Math.min(0.95, timeProgress);
  }

  /**
   * Cancel current computation
   */
  cancel(): void {
    if (this.state === AsyncPathState.COMPUTING) {
      this.state = AsyncPathState.CANCELLED;
      this.cleanup();
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.astar = null;
  }

  /**
   * Get current state
   */
  getState(): AsyncPathState {
    return this.state;
  }

  /**
   * Check if computing
   */
  isComputing(): boolean {
    return this.state === AsyncPathState.COMPUTING;
  }

  /**
   * Get last result
   */
  getResult(): PathResult | null {
    return this.result;
  }

  /**
   * Update options
   */
  setOptions(options: Partial<AsyncPathOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Compute path asynchronously (convenience function)
 */
export async function computePathAsync(
  startX: number,
  startY: number,
  startZ: number,
  goal: Goal,
  ctx: CalculationContext,
  options?: Partial<AsyncPathOptions>
): Promise<PathResult> {
  const pathfinder = new AsyncPathfinder(options);
  return pathfinder.compute(startX, startY, startZ, goal, ctx);
}
