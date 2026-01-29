import { BinaryHeap } from './BinaryHeap';
import { PathNode } from '../types';

describe('BinaryHeap', () => {
  let heap: BinaryHeap;

  beforeEach(() => {
    heap = new BinaryHeap();
  });

  describe('basic operations', () => {
    it('should start empty', () => {
      expect(heap.getSize()).toBe(0);
      expect(heap.isEmpty()).toBe(true);
    });

    it('should push and pop single element', () => {
      const node = new PathNode(0, 0, 0, 10);
      node.combinedCost = 10;
      heap.push(node);

      expect(heap.getSize()).toBe(1);
      expect(heap.isEmpty()).toBe(false);

      const popped = heap.pop();
      expect(popped).toBe(node);
      expect(heap.isEmpty()).toBe(true);
    });

    it('should return null when popping empty heap', () => {
      expect(heap.pop()).toBeNull();
    });
  });

  describe('heap property', () => {
    it('should pop elements in order of combinedCost', () => {
      const nodes = [
        createNode(0, 0, 0, 50),
        createNode(1, 0, 0, 10),
        createNode(2, 0, 0, 30),
        createNode(3, 0, 0, 20),
        createNode(4, 0, 0, 40)
      ];

      nodes.forEach(n => heap.push(n));

      expect(heap.getSize()).toBe(5);

      // Should pop in order: 10, 20, 30, 40, 50
      expect(heap.pop()?.combinedCost).toBe(10);
      expect(heap.pop()?.combinedCost).toBe(20);
      expect(heap.pop()?.combinedCost).toBe(30);
      expect(heap.pop()?.combinedCost).toBe(40);
      expect(heap.pop()?.combinedCost).toBe(50);
    });

    it('should handle duplicate costs', () => {
      const nodes = [
        createNode(0, 0, 0, 10),
        createNode(1, 0, 0, 10),
        createNode(2, 0, 0, 10)
      ];

      nodes.forEach(n => heap.push(n));

      expect(heap.getSize()).toBe(3);
      expect(heap.pop()?.combinedCost).toBe(10);
      expect(heap.pop()?.combinedCost).toBe(10);
      expect(heap.pop()?.combinedCost).toBe(10);
    });
  });

  describe('decrease key', () => {
    it('should update node position when cost decreases', () => {
      const node1 = createNode(0, 0, 0, 50);
      const node2 = createNode(1, 0, 0, 30);
      const node3 = createNode(2, 0, 0, 40);

      heap.push(node1);
      heap.push(node2);
      heap.push(node3);

      // Decrease node1's cost to be the minimum
      node1.combinedCost = 5;
      heap.update(node1);

      // node1 should now be first
      expect(heap.pop()).toBe(node1);
    });
  });

  describe('peek', () => {
    it('should return minimum without removing', () => {
      const node1 = createNode(0, 0, 0, 20);
      const node2 = createNode(1, 0, 0, 10);

      heap.push(node1);
      heap.push(node2);

      expect(heap.peek()).toBe(node2);
      expect(heap.getSize()).toBe(2); // Size unchanged
      expect(heap.peek()).toBe(node2); // Same result
    });

    it('should return null for empty heap', () => {
      expect(heap.peek()).toBeNull();
    });
  });

  describe('large heap', () => {
    it('should handle many elements', () => {
      const count = 1000;
      const nodes: PathNode[] = [];

      // Insert in random order
      for (let i = 0; i < count; i++) {
        const cost = Math.random() * 1000;
        const node = createNode(i, 0, 0, cost);
        nodes.push(node);
        heap.push(node);
      }

      expect(heap.getSize()).toBe(count);

      // Pop all and verify order
      let lastCost = -Infinity;
      while (!heap.isEmpty()) {
        const node = heap.pop()!;
        expect(node.combinedCost).toBeGreaterThanOrEqual(lastCost);
        lastCost = node.combinedCost;
      }
    });
  });
});

function createNode(x: number, y: number, z: number, cost: number): PathNode {
  const node = new PathNode(x, y, z, cost);
  node.combinedCost = cost;
  return node;
}
