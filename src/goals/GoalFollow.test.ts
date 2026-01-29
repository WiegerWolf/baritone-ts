import { describe, it, expect } from 'bun:test';
import { GoalFollow } from './index';
import { Vec3 } from 'vec3';

describe('GoalFollow', () => {
  it('should match positions near entity', () => {
    const entity = { position: new Vec3(100, 64, 100) };
    const goal = new GoalFollow(entity, 3);
    expect(goal.isEnd(100, 64, 100)).toBe(true);
    expect(goal.isEnd(102, 64, 100)).toBe(true);
  });

  it('should not match positions far from entity', () => {
    const entity = { position: new Vec3(100, 64, 100) };
    const goal = new GoalFollow(entity, 3);
    expect(goal.isEnd(110, 64, 100)).toBe(false);
  });

  it('should update with entity movement', () => {
    const entity = { position: new Vec3(100, 64, 100) };
    const goal = new GoalFollow(entity, 3);
    expect(goal.isEnd(100, 64, 100)).toBe(true);

    entity.position = new Vec3(200, 64, 200);
    expect(goal.isEnd(200, 64, 200)).toBe(true);
    expect(goal.isEnd(100, 64, 100)).toBe(false);
  });

  it('should detect when entity has changed position', () => {
    const entity = { position: new Vec3(100, 64, 100) };
    const goal = new GoalFollow(entity, 3);
    expect(goal.hasChanged()).toBe(false);

    entity.position = new Vec3(200, 64, 200);
    expect(goal.hasChanged()).toBe(true);
  });

  it('should report validity', () => {
    const entity = { position: new Vec3(100, 64, 100) };
    const goal = new GoalFollow(entity, 3);
    expect(goal.isValid()).toBe(true);

    // Entity with null position after construction
    const entity2: any = { position: new Vec3(0, 0, 0) };
    const goal2 = new GoalFollow(entity2, 3);
    entity2.position = null;
    expect(goal2.isValid()).toBe(false);
  });

  it('should return 0 heuristic when within range', () => {
    const entity = { position: new Vec3(100, 64, 100) };
    const goal = new GoalFollow(entity, 5);
    expect(goal.heuristic(102, 64, 100)).toBe(0);
  });

  it('should return positive heuristic when out of range', () => {
    const entity = { position: new Vec3(100, 64, 100) };
    const goal = new GoalFollow(entity, 3);
    expect(goal.heuristic(200, 64, 200)).toBeGreaterThan(0);
  });
});

describe('GoalFollow edge cases', () => {
  it('should handle entity with position at origin', () => {
    const entity = { position: new Vec3(0, 0, 0) };
    const goal = new GoalFollow(entity, 3);
    expect(goal.isEnd(0, 0, 0)).toBe(true);
    expect(goal.heuristic(0, 0, 0)).toBe(0);
  });

  it('should handle entity position becoming null', () => {
    const entity: any = { position: new Vec3(100, 64, 100) };
    const goal = new GoalFollow(entity, 3);
    entity.position = null;
    // isValid should return false
    expect(goal.isValid()).toBe(false);
    // hasChanged should return false (can't read position)
    expect(goal.hasChanged()).toBe(false);
  });
});
