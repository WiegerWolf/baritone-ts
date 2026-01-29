import { describe, it, expect } from 'bun:test';
import { MutableMoveResult } from './types';

describe('MutableMoveResult', () => {
  it('should initialize with defaults', () => {
    const result = new MutableMoveResult();
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBe(0);
    expect(result.cost).toBe(Infinity);
  });

  it('should set values', () => {
    const result = new MutableMoveResult();
    result.set(10, 64, 20, 5.5);
    expect(result.x).toBe(10);
    expect(result.y).toBe(64);
    expect(result.z).toBe(20);
    expect(result.cost).toBe(5.5);
  });

  it('should reset to defaults', () => {
    const result = new MutableMoveResult();
    result.set(10, 64, 20, 5.5);
    result.reset();
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.z).toBe(0);
    expect(result.cost).toBe(Infinity);
  });

  it('should support repeated set/reset cycles (object pooling)', () => {
    const result = new MutableMoveResult();
    for (let i = 0; i < 10; i++) {
      result.set(i, i * 2, i * 3, i * 0.5);
      expect(result.x).toBe(i);
      expect(result.cost).toBe(i * 0.5);
      result.reset();
      expect(result.cost).toBe(Infinity);
    }
  });

  it('should handle negative coordinates', () => {
    const result = new MutableMoveResult();
    result.set(-100, -64, -200, 999);
    expect(result.x).toBe(-100);
    expect(result.y).toBe(-64);
    expect(result.z).toBe(-200);
  });
});
