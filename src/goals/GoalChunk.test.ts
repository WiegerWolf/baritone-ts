import { describe, it, expect } from 'bun:test';
import { GoalChunk } from './index';

describe('GoalChunk', () => {
  it('should match positions within chunk', () => {
    const goal = new GoalChunk(5, 10); // Chunk at 80-95, 160-175
    expect(goal.isEnd(85, 64, 165)).toBe(true);
    expect(goal.isEnd(80, 64, 160)).toBe(true);
    expect(goal.isEnd(95, 64, 175)).toBe(true);
  });

  it('should not match positions outside chunk', () => {
    const goal = new GoalChunk(5, 10);
    expect(goal.isEnd(79, 64, 165)).toBe(false);
    expect(goal.isEnd(96, 64, 165)).toBe(false);
  });

  it('should create from world coords', () => {
    const goal = GoalChunk.fromWorldCoords(85, 165);
    expect(goal.chunkX).toBe(5);
    expect(goal.chunkZ).toBe(10);
  });

  it('should expose chunk bounds', () => {
    const goal = new GoalChunk(5, 10);
    expect(goal.startX).toBe(80);
    expect(goal.endX).toBe(95);
    expect(goal.startZ).toBe(160);
    expect(goal.endZ).toBe(175);
  });

  it('should return positive heuristic outside chunk', () => {
    const goal = new GoalChunk(5, 10);
    expect(goal.heuristic(0, 64, 0)).toBeGreaterThan(0);
  });
});

describe('GoalChunk edge cases', () => {
  it('should handle negative chunk coordinates', () => {
    const goal = new GoalChunk(-1, -1);
    expect(goal.startX).toBe(-16);
    expect(goal.endX).toBe(-1);
    expect(goal.startZ).toBe(-16);
    expect(goal.endZ).toBe(-1);
    expect(goal.isEnd(-10, 64, -10)).toBe(true);
    expect(goal.isEnd(0, 64, 0)).toBe(false);
  });

  it('should create from negative world coords', () => {
    const goal = GoalChunk.fromWorldCoords(-10, -20);
    expect(goal.chunkX).toBe(-1);
    expect(goal.chunkZ).toBe(-2);
  });

  it('should ignore Y in isEnd', () => {
    const goal = new GoalChunk(0, 0);
    expect(goal.isEnd(0, -1000, 0)).toBe(true);
    expect(goal.isEnd(0, 1000, 0)).toBe(true);
  });
});
