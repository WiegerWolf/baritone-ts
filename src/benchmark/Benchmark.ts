/**
 * Benchmarking utilities for Baritone-TS
 *
 * Used to measure and compare pathfinding performance
 */

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
  memoryUsed?: number;
}

export interface BenchmarkOptions {
  iterations?: number;
  warmupIterations?: number;
  collectMemory?: boolean;
}

const DEFAULT_OPTIONS: BenchmarkOptions = {
  iterations: 100,
  warmupIterations: 10,
  collectMemory: false
};

/**
 * Run a benchmark
 */
export function benchmark(
  name: string,
  fn: () => void,
  options: BenchmarkOptions = {}
): BenchmarkResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Warmup
  for (let i = 0; i < opts.warmupIterations!; i++) {
    fn();
  }

  // Force GC if available
  if (opts.collectMemory && global.gc) {
    global.gc();
  }

  const startMemory = opts.collectMemory ? process.memoryUsage().heapUsed : 0;

  // Benchmark
  const times: number[] = [];
  const startTotal = performance.now();

  for (let i = 0; i < opts.iterations!; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  const endTotal = performance.now();
  const endMemory = opts.collectMemory ? process.memoryUsage().heapUsed : 0;

  const totalTime = endTotal - startTotal;
  const avgTime = totalTime / opts.iterations!;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return {
    name,
    iterations: opts.iterations!,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    opsPerSecond: 1000 / avgTime,
    memoryUsed: opts.collectMemory ? endMemory - startMemory : undefined
  };
}

/**
 * Run multiple benchmarks and compare
 */
export function compareBenchmarks(
  benchmarks: Array<{ name: string; fn: () => void }>,
  options: BenchmarkOptions = {}
): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];

  for (const b of benchmarks) {
    results.push(benchmark(b.name, b.fn, options));
  }

  return results;
}

/**
 * Format benchmark results as a table
 */
export function formatResults(results: BenchmarkResult[]): string {
  const lines: string[] = [];

  lines.push('┌─────────────────────────────────────────────────────────────────────────┐');
  lines.push('│                        Benchmark Results                                │');
  lines.push('├─────────────────────┬───────────┬───────────┬───────────┬──────────────┤');
  lines.push('│ Name                │ Avg (ms)  │ Min (ms)  │ Max (ms)  │ Ops/sec      │');
  lines.push('├─────────────────────┼───────────┼───────────┼───────────┼──────────────┤');

  for (const r of results) {
    const name = r.name.padEnd(19).slice(0, 19);
    const avg = r.avgTime.toFixed(3).padStart(9);
    const min = r.minTime.toFixed(3).padStart(9);
    const max = r.maxTime.toFixed(3).padStart(9);
    const ops = r.opsPerSecond.toFixed(1).padStart(12);
    lines.push(`│ ${name} │ ${avg} │ ${min} │ ${max} │ ${ops} │`);
  }

  lines.push('└─────────────────────┴───────────┴───────────┴───────────┴──────────────┘');

  if (results.some(r => r.memoryUsed !== undefined)) {
    lines.push('');
    lines.push('Memory Usage:');
    for (const r of results) {
      if (r.memoryUsed !== undefined) {
        const kb = (r.memoryUsed / 1024).toFixed(2);
        lines.push(`  ${r.name}: ${kb} KB`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Benchmark suite for running related benchmarks
 */
export class BenchmarkSuite {
  private benchmarks: Array<{ name: string; fn: () => void }> = [];
  private setupFn?: () => void;
  private teardownFn?: () => void;

  constructor(public readonly name: string) {}

  /**
   * Set setup function (runs before each benchmark)
   */
  setup(fn: () => void): this {
    this.setupFn = fn;
    return this;
  }

  /**
   * Set teardown function (runs after each benchmark)
   */
  teardown(fn: () => void): this {
    this.teardownFn = fn;
    return this;
  }

  /**
   * Add a benchmark
   */
  add(name: string, fn: () => void): this {
    this.benchmarks.push({ name, fn });
    return this;
  }

  /**
   * Run all benchmarks
   */
  run(options: BenchmarkOptions = {}): BenchmarkResult[] {
    const results: BenchmarkResult[] = [];

    for (const b of this.benchmarks) {
      if (this.setupFn) this.setupFn();

      const result = benchmark(b.name, b.fn, options);
      results.push(result);

      if (this.teardownFn) this.teardownFn();
    }

    return results;
  }

  /**
   * Run and print results
   */
  runAndPrint(options: BenchmarkOptions = {}): void {
    console.log(`\n=== ${this.name} ===\n`);
    const results = this.run(options);
    console.log(formatResults(results));
  }
}

/**
 * Create a simple timer for manual profiling
 */
export class Timer {
  private startTime: number = 0;
  private endTime: number = 0;
  private laps: number[] = [];

  start(): this {
    this.startTime = performance.now();
    this.laps = [];
    return this;
  }

  lap(): number {
    const now = performance.now();
    const lapTime = now - (this.laps.length > 0 ? this.laps[this.laps.length - 1] + this.startTime : this.startTime);
    this.laps.push(now - this.startTime);
    return lapTime;
  }

  stop(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  get elapsed(): number {
    if (this.endTime > 0) {
      return this.endTime - this.startTime;
    }
    return performance.now() - this.startTime;
  }

  get lapTimes(): number[] {
    return this.laps.map((t, i) => i === 0 ? t : t - this.laps[i - 1]);
  }
}

/**
 * Memory profiler
 */
export class MemoryProfiler {
  private snapshots: Array<{ label: string; heap: number; external: number }> = [];

  snapshot(label: string): this {
    const usage = process.memoryUsage();
    this.snapshots.push({
      label,
      heap: usage.heapUsed,
      external: usage.external
    });
    return this;
  }

  getDiff(from: string, to: string): { heap: number; external: number } | null {
    const fromSnap = this.snapshots.find(s => s.label === from);
    const toSnap = this.snapshots.find(s => s.label === to);

    if (!fromSnap || !toSnap) return null;

    return {
      heap: toSnap.heap - fromSnap.heap,
      external: toSnap.external - fromSnap.external
    };
  }

  print(): void {
    console.log('\nMemory Snapshots:');
    for (let i = 0; i < this.snapshots.length; i++) {
      const s = this.snapshots[i];
      const heapMB = (s.heap / 1024 / 1024).toFixed(2);
      const extMB = (s.external / 1024 / 1024).toFixed(2);

      let diff = '';
      if (i > 0) {
        const prev = this.snapshots[i - 1];
        const heapDiff = ((s.heap - prev.heap) / 1024).toFixed(2);
        diff = ` (${Number(heapDiff) >= 0 ? '+' : ''}${heapDiff} KB)`;
      }

      console.log(`  ${s.label}: ${heapMB} MB heap, ${extMB} MB external${diff}`);
    }
  }
}
