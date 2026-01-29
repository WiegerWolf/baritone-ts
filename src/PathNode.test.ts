import { describe, it, expect } from 'bun:test';
import { PathNode, BlockPos } from './types';

describe('PathNode', () => {
  describe('constructor', () => {
    it('should create node with position and heuristic', () => {
      const node = new PathNode(10, 64, 20, 100);
      expect(node.x).toBe(10);
      expect(node.y).toBe(64);
      expect(node.z).toBe(20);
      expect(node.estimatedCostToGoal).toBe(100);
    });

    it('should initialize cost to infinity', () => {
      const node = new PathNode(10, 64, 20, 100);
      expect(node.cost).toBe(Infinity);
    });

    it('should initialize previous to null', () => {
      const node = new PathNode(10, 64, 20, 100);
      expect(node.previous).toBeNull();
    });
  });

  describe('hash', () => {
    it('should match BlockPos hash format', () => {
      const node = new PathNode(10, 64, 20, 0);
      // Should use string hash format
      expect(node.hash).toBe(`${10},${64},${20}`);
    });
  });

  describe('previous chain', () => {
    it('should allow building previous chain', () => {
      const node1 = new PathNode(0, 64, 0, 100);
      const node2 = new PathNode(1, 64, 0, 90);
      const node3 = new PathNode(2, 64, 0, 80);

      node2.previous = node1;
      node3.previous = node2;

      expect(node3.previous).toBe(node2);
      expect(node3.previous!.previous).toBe(node1);
      expect(node3.previous!.previous!.previous).toBeNull();
    });
  });

  describe('heap position', () => {
    it('should track heap position', () => {
      const node = new PathNode(10, 64, 20, 100);
      node.heapPosition = 5;
      expect(node.heapPosition).toBe(5);
    });
  });
});

describe('PathNode edge cases', () => {
  it('should initialize combinedCost to Infinity', () => {
    const node = new PathNode(0, 0, 0, 50);
    expect(node.combinedCost).toBe(Infinity);
  });

  it('should initialize heapPosition to -1', () => {
    const node = new PathNode(0, 0, 0, 50);
    expect(node.heapPosition).toBe(-1);
  });

  it('should initialize toBreak and toPlace as empty arrays', () => {
    const node = new PathNode(0, 0, 0, 50);
    expect(node.toBreak).toEqual([]);
    expect(node.toPlace).toEqual([]);
  });

  it('should generate hash matching coordinate string format', () => {
    const node = new PathNode(-5, 300, 42, 0);
    expect(node.hash).toBe('-5,300,42');
  });

  it('should create BlockPos via getPos', () => {
    const node = new PathNode(10, 64, 20, 0);
    const pos = node.getPos();
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(64);
    expect(pos.z).toBe(20);
    expect(pos).toBeInstanceOf(BlockPos);
  });
});
