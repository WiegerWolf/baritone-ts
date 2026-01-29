import { describe, it, expect } from 'bun:test';
import { GoalRunAwayFromEntities } from './index';
import { Vec3 } from 'vec3';

describe('GoalRunAwayFromEntities', () => {
  it('should match when far from all entities', () => {
    const entities = [
      { position: new Vec3(100, 64, 100), isValid: true },
    ] as any[];
    const goal = new GoalRunAwayFromEntities(() => entities, 16);
    expect(goal.isEnd(200, 64, 200)).toBe(true);
  });

  it('should not match when near entity', () => {
    const entities = [
      { position: new Vec3(100, 64, 100), isValid: true },
    ] as any[];
    const goal = new GoalRunAwayFromEntities(() => entities, 16);
    expect(goal.isEnd(105, 64, 100)).toBe(false);
  });

  it('should support xzOnly mode', () => {
    const entities = [
      { position: new Vec3(100, 64, 100), isValid: true },
    ] as any[];
    const goal = new GoalRunAwayFromEntities(() => entities, 16, true);
    // Y difference shouldn't matter in xzOnly mode
    expect(goal.isEnd(105, 200, 100)).toBe(false);
  });

  it('should skip invalid entities', () => {
    const entities = [
      { position: new Vec3(105, 64, 100), isValid: false },
    ] as any[];
    const goal = new GoalRunAwayFromEntities(() => entities, 16);
    expect(goal.isEnd(105, 64, 100)).toBe(true);
  });

  it('should return heuristic based on entity proximity', () => {
    const entities = [
      { position: new Vec3(100, 64, 100), isValid: true },
    ] as any[];
    const goal = new GoalRunAwayFromEntities(() => entities, 16);
    const hNear = goal.heuristic(101, 64, 100);
    const hFar = goal.heuristic(200, 64, 200);
    expect(hNear).toBeGreaterThan(hFar);
  });

  it('should handle entity at exact same position (cost=0 edge case)', () => {
    const entities = [
      { position: new Vec3(100, 64, 100), isValid: true },
    ] as any[];
    const goal = new GoalRunAwayFromEntities(() => entities, 16);
    // Standing on entity: getCostOfEntity returns 0, heuristic adds 1000
    const h = goal.heuristic(100, 64, 100);
    expect(h).toBeGreaterThan(0);
  });

  it('should limit to 10 entities for heuristic calculation', () => {
    const entities = Array.from({ length: 20 }, (_, i) => ({
      position: new Vec3(100 + i, 64, 100),
      isValid: true,
    })) as any[];
    const goal = new GoalRunAwayFromEntities(() => entities, 16);
    // Should not throw, even with 20 entities
    const h = goal.heuristic(200, 64, 200);
    expect(typeof h).toBe('number');
    expect(Number.isFinite(h)).toBe(true);
  });

  it('should skip null entities', () => {
    const entities = [
      null,
      { position: new Vec3(200, 64, 200), isValid: true },
    ] as any[];
    const goal = new GoalRunAwayFromEntities(() => entities, 16);
    // null entities skipped, only valid entity is far away
    expect(goal.isEnd(50, 64, 50)).toBe(true);
  });

  it('should handle empty entity list', () => {
    const goal = new GoalRunAwayFromEntities(() => [] as any[], 16);
    // No entities = safe everywhere
    expect(goal.isEnd(0, 0, 0)).toBe(true);
    expect(goal.heuristic(0, 0, 0)).toBe(0);
  });
});
