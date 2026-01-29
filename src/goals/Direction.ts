/**
 * Direction enum for GoalBlockSide
 */
export enum Direction {
  NORTH = 'north',
  SOUTH = 'south',
  EAST = 'east',
  WEST = 'west',
  UP = 'up',
  DOWN = 'down',
}

/**
 * Get direction vector for a Direction
 */
export function getDirectionVector(dir: Direction): { x: number; y: number; z: number } {
  switch (dir) {
    case Direction.NORTH: return { x: 0, y: 0, z: -1 };
    case Direction.SOUTH: return { x: 0, y: 0, z: 1 };
    case Direction.EAST:  return { x: 1, y: 0, z: 0 };
    case Direction.WEST:  return { x: -1, y: 0, z: 0 };
    case Direction.UP:    return { x: 0, y: 1, z: 0 };
    case Direction.DOWN:  return { x: 0, y: -1, z: 0 };
  }
}
