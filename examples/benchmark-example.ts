/**
 * Benchmark example for Baritone-TS
 *
 * Run with: npx ts-node examples/benchmark-example.ts
 */

import { BinaryHeap } from '../src/pathing/BinaryHeap';
import { PathNode, BlockPos } from '../src/types';
import {
  BenchmarkSuite,
  Timer,
  MemoryProfiler,
  formatResults
} from '../src/benchmark';

// ============================================================================
// Binary Heap Benchmarks
// ============================================================================

function benchmarkBinaryHeap() {
  const suite = new BenchmarkSuite('Binary Heap Operations');

  let heap: BinaryHeap;
  const nodes: PathNode[] = [];

  // Prepare test data
  for (let i = 0; i < 10000; i++) {
    const node = new PathNode(i, 64, i, Math.random() * 1000);
    node.combinedCost = Math.random() * 1000;
    nodes.push(node);
  }

  suite
    .add('Push 1000 nodes', () => {
      heap = new BinaryHeap();
      for (let i = 0; i < 1000; i++) {
        const node = new PathNode(i, 64, i, i);
        node.combinedCost = Math.random() * 1000;
        heap.push(node);
      }
    })
    .add('Pop 1000 nodes', () => {
      heap = new BinaryHeap();
      for (let i = 0; i < 1000; i++) {
        const node = new PathNode(i, 64, i, i);
        node.combinedCost = Math.random() * 1000;
        heap.push(node);
      }
      while (!heap.isEmpty()) {
        heap.pop();
      }
    })
    .add('Push/Pop mixed', () => {
      heap = new BinaryHeap();
      for (let i = 0; i < 500; i++) {
        const node = new PathNode(i, 64, i, i);
        node.combinedCost = Math.random() * 1000;
        heap.push(node);
      }
      for (let i = 0; i < 250; i++) {
        heap.pop();
        const node = new PathNode(i + 500, 64, i, i);
        node.combinedCost = Math.random() * 1000;
        heap.push(node);
      }
    })
    .add('Decrease key', () => {
      heap = new BinaryHeap();
      const testNodes: PathNode[] = [];
      for (let i = 0; i < 500; i++) {
        const node = new PathNode(i, 64, i, i);
        node.combinedCost = 1000 - i;
        testNodes.push(node);
        heap.push(node);
      }
      for (let i = 0; i < 100; i++) {
        const node = testNodes[i];
        node.combinedCost = Math.random() * 100;
        heap.update(node);
      }
    });

  suite.runAndPrint({ iterations: 100 });
}

// ============================================================================
// BlockPos Benchmarks
// ============================================================================

function benchmarkBlockPos() {
  const suite = new BenchmarkSuite('BlockPos Operations');

  let pos: BlockPos;

  suite
    .add('Create BlockPos', () => {
      for (let i = 0; i < 1000; i++) {
        pos = new BlockPos(i, 64, i);
      }
    })
    .add('Hash generation', () => {
      pos = new BlockPos(12345, 64, 67890);
      for (let i = 0; i < 1000; i++) {
        const hash = pos.hash;
      }
    })
    .add('Offset creation', () => {
      pos = new BlockPos(0, 64, 0);
      for (let i = 0; i < 1000; i++) {
        pos.offset(1, 0, 0);
      }
    })
    .add('Distance calc', () => {
      const pos1 = new BlockPos(0, 64, 0);
      const pos2 = new BlockPos(100, 80, 100);
      for (let i = 0; i < 1000; i++) {
        pos1.distanceTo(pos2);
      }
    })
    .add('Manhattan distance', () => {
      const pos1 = new BlockPos(0, 64, 0);
      const pos2 = new BlockPos(100, 80, 100);
      for (let i = 0; i < 1000; i++) {
        Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) + Math.abs(pos1.z - pos2.z);
      }
    });

  suite.runAndPrint({ iterations: 100 });
}

// ============================================================================
// Hash Map Lookup Benchmarks
// ============================================================================

function benchmarkHashLookup() {
  const suite = new BenchmarkSuite('Hash Map Lookups');

  const map = new Map<string, PathNode>();
  const set = new Set<string>();
  const positions: BlockPos[] = [];

  // Prepare test data
  for (let x = 0; x < 100; x++) {
    for (let z = 0; z < 100; z++) {
      const pos = new BlockPos(x, 64, z);
      positions.push(pos);
      const node = new PathNode(x, 64, z, 0);
      map.set(pos.hashString, node);
      set.add(pos.hashString);
    }
  }

  suite
    .add('Map.get', () => {
      for (let i = 0; i < 1000; i++) {
        const pos = positions[i % positions.length];
        map.get(pos.hashString);
      }
    })
    .add('Map.has', () => {
      for (let i = 0; i < 1000; i++) {
        const pos = positions[i % positions.length];
        map.has(pos.hashString);
      }
    })
    .add('Set.has', () => {
      for (let i = 0; i < 1000; i++) {
        const pos = positions[i % positions.length];
        set.has(pos.hashString);
      }
    })
    .add('Map.set', () => {
      const testMap = new Map<string, number>();
      for (let i = 0; i < 1000; i++) {
        const pos = positions[i % positions.length];
        testMap.set(pos.hashString, i);
      }
    });

  suite.runAndPrint({ iterations: 100 });
}

// ============================================================================
// Memory Usage Test
// ============================================================================

function benchmarkMemory() {
  console.log('\n=== Memory Usage Tests ===\n');

  const profiler = new MemoryProfiler();

  profiler.snapshot('start');

  // Create many PathNodes
  const nodes: PathNode[] = [];
  for (let i = 0; i < 100000; i++) {
    nodes.push(new PathNode(i, 64, i, Math.random() * 1000));
  }

  profiler.snapshot('after 100k PathNodes');

  // Create large hash map
  const map = new Map<string, PathNode>();
  for (const node of nodes) {
    map.set(node.hash, node);
  }

  profiler.snapshot('after Map population');

  // Create binary heap
  const heap = new BinaryHeap();
  for (let i = 0; i < 10000; i++) {
    nodes[i].combinedCost = Math.random() * 1000;
    heap.push(nodes[i]);
  }

  profiler.snapshot('after BinaryHeap (10k)');

  profiler.print();

  // Cleanup
  nodes.length = 0;
  map.clear();
}

// ============================================================================
// Main
// ============================================================================

console.log('Baritone-TS Performance Benchmarks');
console.log('===================================\n');

benchmarkBinaryHeap();
benchmarkBlockPos();
benchmarkHashLookup();
benchmarkMemory();

console.log('\nBenchmarks complete!');
