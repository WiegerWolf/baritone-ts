import { PathNode } from '../types';

/**
 * Binary heap optimized for A* pathfinding
 *
 * Key optimizations over TreeSet:
 * - O(log n) with minimal memory overhead
 * - Excellent cache locality (sequential array access)
 * - No wrapper objects created during operations
 * - O(1) access to heap position via node.heapPosition
 */
export class BinaryHeap {
  private array: PathNode[];
  private size: number;

  private static readonly INITIAL_CAPACITY = 1024; // ~2 chunks worth of nodes

  constructor() {
    this.array = new Array(BinaryHeap.INITIAL_CAPACITY);
    this.size = 0;
  }

  /**
   * Check if heap is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Get number of elements in heap
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Add a node to the heap
   */
  push(node: PathNode): void {
    if (this.size >= this.array.length) {
      this.grow();
    }

    this.size++;
    const index = this.size;
    this.array[index] = node;
    node.heapPosition = index;
    this.siftUp(index);
  }

  /**
   * Remove and return the minimum node
   */
  pop(): PathNode | null {
    if (this.size === 0) return null;

    const min = this.array[1];
    this.array[1] = this.array[this.size];
    this.array[1].heapPosition = 1;
    this.size--;

    if (this.size > 0) {
      this.siftDown(1);
    }

    min.heapPosition = -1;
    return min;
  }

  /**
   * Peek at the minimum node without removing
   */
  peek(): PathNode | null {
    return this.size > 0 ? this.array[1] : null;
  }

  /**
   * Update a node's position after its cost decreased
   * This is the "decrease-key" operation
   */
  update(node: PathNode): void {
    if (node.heapPosition <= 0 || node.heapPosition > this.size) {
      return; // Node not in heap
    }
    this.siftUp(node.heapPosition);
  }

  /**
   * Clear the heap
   */
  clear(): void {
    for (let i = 1; i <= this.size; i++) {
      this.array[i].heapPosition = -1;
    }
    this.size = 0;
  }

  /**
   * Check if a node is in the heap
   */
  contains(node: PathNode): boolean {
    return node.heapPosition > 0 && node.heapPosition <= this.size;
  }

  /**
   * Sift a node up to restore heap property
   */
  private siftUp(index: number): void {
    const node = this.array[index];
    const cost = node.combinedCost;

    while (index > 1) {
      // Use bit shift for fast division by 2
      const parentIndex = index >>> 1;
      const parent = this.array[parentIndex];

      if (cost >= parent.combinedCost) {
        break;
      }

      // Move parent down
      this.array[index] = parent;
      parent.heapPosition = index;
      index = parentIndex;
    }

    this.array[index] = node;
    node.heapPosition = index;
  }

  /**
   * Sift a node down to restore heap property
   */
  private siftDown(index: number): void {
    const node = this.array[index];
    const cost = node.combinedCost;

    while (true) {
      // Use bit shift for fast multiplication by 2
      let leftIndex = index << 1;
      if (leftIndex > this.size) break;

      let rightIndex = leftIndex + 1;
      let minIndex = leftIndex;
      let minCost = this.array[leftIndex].combinedCost;

      // Check right child
      if (rightIndex <= this.size) {
        const rightCost = this.array[rightIndex].combinedCost;
        if (rightCost < minCost) {
          minIndex = rightIndex;
          minCost = rightCost;
        }
      }

      // If node is smaller than both children, we're done
      if (cost <= minCost) break;

      // Move smaller child up
      const child = this.array[minIndex];
      this.array[index] = child;
      child.heapPosition = index;
      index = minIndex;
    }

    this.array[index] = node;
    node.heapPosition = index;
  }

  /**
   * Grow the internal array
   */
  private grow(): void {
    const newCapacity = this.array.length * 2;
    const newArray = new Array(newCapacity);
    for (let i = 0; i <= this.size; i++) {
      newArray[i] = this.array[i];
    }
    this.array = newArray;
  }
}
