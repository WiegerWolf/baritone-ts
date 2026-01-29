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

  describe('clear', () => {
    it('should clear all elements', () => {
      heap.push(createNode(0, 0, 0, 10));
      heap.push(createNode(1, 0, 0, 20));
      heap.push(createNode(2, 0, 0, 30));

      expect(heap.getSize()).toBe(3);
      heap.clear();
      expect(heap.getSize()).toBe(0);
      expect(heap.isEmpty()).toBe(true);
    });

    it('should reset node heap positions', () => {
      const node = createNode(0, 0, 0, 10);
      heap.push(node);
      expect(node.heapPosition).toBeGreaterThan(0);

      heap.clear();
      expect(node.heapPosition).toBe(-1);
    });
  });

  describe('contains', () => {
    it('should return true for nodes in heap', () => {
      const node = createNode(0, 0, 0, 10);
      heap.push(node);
      expect(heap.contains(node)).toBe(true);
    });

    it('should return false for nodes not in heap', () => {
      const node = createNode(0, 0, 0, 10);
      expect(heap.contains(node)).toBe(false);
    });

    it('should return false after node is popped', () => {
      const node = createNode(0, 0, 0, 10);
      heap.push(node);
      heap.pop();
      expect(heap.contains(node)).toBe(false);
    });
  });

  describe('grow', () => {
    it('should handle inserting more elements than initial capacity', () => {
      // Default capacity is typically small, insert many to trigger grow
      for (let i = 0; i < 100; i++) {
        heap.push(createNode(i, 0, 0, i));
      }
      expect(heap.getSize()).toBe(100);

      // Verify heap property still holds
      let last = -1;
      while (!heap.isEmpty()) {
        const node = heap.pop()!;
        expect(node.combinedCost).toBeGreaterThanOrEqual(last);
        last = node.combinedCost;
      }
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

  describe('edge cases', () => {
    it('should set heapPosition to -1 after pop', () => {
      const node = createNode(0, 0, 0, 10);
      heap.push(node);
      expect(node.heapPosition).toBeGreaterThan(0);

      heap.pop();
      expect(node.heapPosition).toBe(-1);
    });

    it('should ignore update on node not in heap (heapPosition = -1)', () => {
      const node = createNode(0, 0, 0, 50);
      node.heapPosition = -1;
      // Should not throw
      heap.update(node);
      expect(heap.getSize()).toBe(0);
    });

    it('should ignore update on node with heapPosition = 0', () => {
      const node = createNode(0, 0, 0, 50);
      node.heapPosition = 0;
      heap.update(node);
      expect(heap.getSize()).toBe(0);
    });

    it('should ignore update on node with heapPosition exceeding size', () => {
      const node1 = createNode(0, 0, 0, 10);
      heap.push(node1);

      const node2 = createNode(1, 0, 0, 20);
      node2.heapPosition = 100; // Way beyond size
      heap.update(node2);
      expect(heap.getSize()).toBe(1);
    });

    it('should handle pop correctly when heap has exactly two elements', () => {
      const node1 = createNode(0, 0, 0, 20);
      const node2 = createNode(1, 0, 0, 10);
      heap.push(node1);
      heap.push(node2);

      expect(heap.pop()).toBe(node2); // Lower cost first
      expect(heap.pop()).toBe(node1);
      expect(heap.pop()).toBeNull();
    });

    it('should siftDown with only left child (no right child)', () => {
      // Push 3 nodes so size=3, then pop min.
      // After pop, size=2. Root at index 1 has left child at index 2, no right child at index 3.
      const node1 = createNode(0, 0, 0, 10);
      const node2 = createNode(1, 0, 0, 20);
      const node3 = createNode(2, 0, 0, 30);

      heap.push(node1);
      heap.push(node2);
      heap.push(node3);

      heap.pop(); // Removes 10, moves 30 to root, sifts down with left child 20

      // Now 20 should be at root
      expect(heap.peek()!.combinedCost).toBe(20);
      expect(heap.pop()!.combinedCost).toBe(20);
      expect(heap.pop()!.combinedCost).toBe(30);
    });

    it('should handle update that does not change ordering', () => {
      const node1 = createNode(0, 0, 0, 10);
      const node2 = createNode(1, 0, 0, 20);
      const node3 = createNode(2, 0, 0, 30);

      heap.push(node1);
      heap.push(node2);
      heap.push(node3);

      // Update node3 but still higher than others
      node3.combinedCost = 25;
      heap.update(node3);

      expect(heap.pop()!.combinedCost).toBe(10);
      expect(heap.pop()!.combinedCost).toBe(20);
      expect(heap.pop()!.combinedCost).toBe(25);
    });

    it('should handle equal costs maintaining heap property', () => {
      // All same cost
      for (let i = 0; i < 20; i++) {
        heap.push(createNode(i, 0, 0, 42));
      }
      expect(heap.getSize()).toBe(20);

      let count = 0;
      while (!heap.isEmpty()) {
        expect(heap.pop()!.combinedCost).toBe(42);
        count++;
      }
      expect(count).toBe(20);
    });

    it('should handle reverse-sorted insertions', () => {
      // Worst case for siftUp: every insert requires full sift
      for (let i = 100; i >= 0; i--) {
        heap.push(createNode(i, 0, 0, i));
      }

      let last = -1;
      while (!heap.isEmpty()) {
        const node = heap.pop()!;
        expect(node.combinedCost).toBeGreaterThanOrEqual(last);
        last = node.combinedCost;
      }
    });

    it('should handle multiple decrease-key updates correctly', () => {
      const nodes = [];
      for (let i = 0; i < 10; i++) {
        const node = createNode(i, 0, 0, 100 - i);
        nodes.push(node);
        heap.push(node);
      }

      // Decrease the last node to be the minimum
      nodes[9].combinedCost = 1;
      heap.update(nodes[9]);

      // Also decrease another
      nodes[5].combinedCost = 2;
      heap.update(nodes[5]);

      expect(heap.pop()!.combinedCost).toBe(1);
      expect(heap.pop()!.combinedCost).toBe(2);
    });

    it('should not contain nodes after clear', () => {
      const node = createNode(0, 0, 0, 10);
      heap.push(node);
      heap.clear();

      expect(heap.contains(node)).toBe(false);
      expect(heap.isEmpty()).toBe(true);
    });
  });
});

function createNode(x: number, y: number, z: number, cost: number): PathNode {
  const node = new PathNode(x, y, z, cost);
  node.combinedCost = cost;
  return node;
}
