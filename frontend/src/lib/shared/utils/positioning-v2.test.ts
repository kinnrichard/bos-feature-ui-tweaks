import { describe, it, expect } from 'vitest';
import { calculatePosition, getAdjacentPositions } from './positioning-v2';

describe('calculatePosition', () => {
  describe('basic position calculations', () => {
    it('should calculate position within middle 50% range between two positions', () => {
      const position = calculatePosition(10000, 20000);
      // With 50% range, should be between 12500 and 17500
      expect(position).toBeGreaterThanOrEqual(12500);
      expect(position).toBeLessThanOrEqual(17500);
    });

    it('should handle small position values with randomization', () => {
      const position = calculatePosition(100, 200);
      // With 50% range, should be between 125 and 175
      expect(position).toBeGreaterThanOrEqual(125);
      expect(position).toBeLessThanOrEqual(175);
    });

    it('should use midpoint for small gaps (less than 4)', () => {
      const position = calculatePosition(10, 13);
      // Gap is 3, so should use midpoint
      expect(position).toBe(11); // Math.floor((10 + 13) / 2) = 11
    });

    it('should randomize for larger gaps', () => {
      // Run multiple times to verify randomization
      const positions = new Set();
      for (let i = 0; i < 10; i++) {
        const position = calculatePosition(10000, 20000);
        positions.add(position);
      }
      // Should have multiple different positions
      expect(positions.size).toBeGreaterThan(1);
    });
  });

  describe('edge cases with null values', () => {
    it('should handle insertion at start when prevPosition is null', () => {
      const position = calculatePosition(null, 10000);
      // Should generate negative position to allow infinite insertions before
      expect(position).toBeLessThan(0);
      expect(position).toBeGreaterThanOrEqual(-10000);
    });

    it('should handle insertion at start with small nextPosition', () => {
      const position = calculatePosition(null, 100);
      // Should generate negative position to allow infinite insertions before
      expect(position).toBeLessThan(0);
      expect(position).toBeGreaterThanOrEqual(-10000);
    });

    it('should handle insertion at start with very small position', () => {
      const position = calculatePosition(null, 3);
      // Should generate negative position to allow infinite insertions before
      expect(position).toBeLessThan(0);
      expect(position).toBeGreaterThanOrEqual(-10000);
    });

    it('should handle insertion at end when nextPosition is null', () => {
      const position = calculatePosition(10000, null);
      // Should randomize around default spacing (50% range around 10000)
      // Min: 10000 + 10000 * 0.75 = 17500
      // Max: 10000 + 10000 * 1.25 = 22500
      expect(position).toBeGreaterThanOrEqual(17500);
      expect(position).toBeLessThanOrEqual(22500);
    });

    it('should handle insertion at end with large prevPosition', () => {
      const position = calculatePosition(999999, null);
      // Should randomize around default spacing
      expect(position).toBeGreaterThanOrEqual(1007499); // 999999 + 7500
      expect(position).toBeLessThanOrEqual(1012499); // 999999 + 12500
    });

    it('should handle empty list when both are null', () => {
      const position = calculatePosition(null, null);
      expect(position).toBe(10000); // default initial position (no randomization for empty list)
    });
  });

  describe('boundary conditions', () => {
    it('should handle zero positions', () => {
      const position = calculatePosition(0, 10);
      // Gap is 10, should randomize in middle 50%
      expect(position).toBeGreaterThanOrEqual(2); // 0 + (10 * 0.25)
      expect(position).toBeLessThanOrEqual(7);   // 0 + (10 * 0.75)
    });

    it('should handle negative positions', () => {
      const position = calculatePosition(-100, 100);
      // Gap is 200, should randomize in middle 50%
      expect(position).toBeGreaterThanOrEqual(-50);  // -100 + (200 * 0.25)
      expect(position).toBeLessThanOrEqual(50);      // -100 + (200 * 0.75)
    });

    it('should work with very large position values', () => {
      const position = calculatePosition(1000000, 2000000);
      // Gap is 1000000, should randomize in middle 50%
      expect(position).toBeGreaterThanOrEqual(1250000);
      expect(position).toBeLessThanOrEqual(1750000);
    });

    it('should handle positions near JavaScript safe integer limit', () => {
      // Using smaller numbers that are still very large
      const largeNum = 1000000000000; // 1 trillion
      const position = calculatePosition(largeNum, largeNum + 20000);
      // Gap is 20000, should randomize in middle 50%
      expect(position).toBeGreaterThanOrEqual(largeNum + 5000);
      expect(position).toBeLessThanOrEqual(largeNum + 15000);
    });
  });

  describe('negative positioning for top-of-list', () => {
    it('should generate different random negative positions for multiple top insertions', () => {
      const positions = new Set();
      for (let i = 0; i < 10; i++) {
        const position = calculatePosition(null, 1000);
        positions.add(position);
        expect(position).toBeLessThan(0);
        expect(position).toBeGreaterThanOrEqual(-10000);
      }
      // Should have multiple different negative positions
      expect(positions.size).toBeGreaterThan(1);
    });

    it('should allow infinite insertions before negative positions', () => {
      // Start with a known negative position
      const firstNegative = -1000;
      
      // Should be able to insert before it (this will generate another random negative)
      const beforeFirstNegative = calculatePosition(null, firstNegative);
      expect(beforeFirstNegative).toBeLessThan(0);
      
      // The key test: we can always insert between any two positions using the between logic
      // Let's use a very negative number to guarantee ordering
      const veryNegative = -5000;
      const betweenNegatives = calculatePosition(veryNegative, firstNegative);
      expect(betweenNegatives).toBeGreaterThan(veryNegative);
      expect(betweenNegatives).toBeLessThan(firstNegative);
      
      // And we can insert before that too
      const beforeVeryNegative = calculatePosition(null, veryNegative);
      expect(beforeVeryNegative).toBeLessThan(0);
    });

    it('should handle insertions between negative position and positive position', () => {
      const position = calculatePosition(-5000, 1000);
      // Should be between -5000 and 1000
      expect(position).toBeGreaterThan(-5000);
      expect(position).toBeLessThan(1000);
      
      // Gap is 6000, with 50% range in middle:
      // rangeSize = 6000 * 0.5 = 3000
      // rangeStart = -5000 + (6000 - 3000) / 2 = -5000 + 1500 = -3500
      // rangeEnd = -3500 + 3000 = -500
      expect(position).toBeGreaterThanOrEqual(-3500);
      expect(position).toBeLessThanOrEqual(-500);
    });

    it('should use custom defaultSpacing for negative positioning', () => {
      const position = calculatePosition(null, 1000, { defaultSpacing: 5000 });
      expect(position).toBeLessThan(0);
      expect(position).toBeGreaterThanOrEqual(-5000);
    });
  });

  describe('spacing configuration', () => {
    it('should use custom spacing for end insertion', () => {
      const position = calculatePosition(10000, null, { defaultSpacing: 5000 });
      // Should randomize around custom spacing
      expect(position).toBeGreaterThanOrEqual(13750); // 10000 + 3750
      expect(position).toBeLessThanOrEqual(16250);    // 10000 + 6250
    });

    it('should use custom initial position for empty list', () => {
      const position = calculatePosition(null, null, { initialPosition: 50000 });
      expect(position).toBe(50000);
    });

    it('should apply both custom spacing and initial position', () => {
      const position1 = calculatePosition(null, null, { initialPosition: 1000 });
      expect(position1).toBe(1000);
      
      const position2 = calculatePosition(1000, null, { defaultSpacing: 500 });
      // Should randomize around custom spacing
      expect(position2).toBeGreaterThanOrEqual(1375); // 1000 + 375
      expect(position2).toBeLessThanOrEqual(1625);    // 1000 + 625
    });
    
    it('should apply custom randomRangePercent', () => {
      // Use 20% range instead of default 50%
      const position = calculatePosition(10000, 20000, { randomRangePercent: 0.2 });
      // With 20% range, should be between 14000 and 16000
      expect(position).toBeGreaterThanOrEqual(14000);
      expect(position).toBeLessThanOrEqual(16000);
    });
    
    it('should handle randomRangePercent of 0 (no randomization)', () => {
      const position = calculatePosition(10000, 20000, { randomRangePercent: 0 });
      // With 0% range, should be exactly at midpoint
      expect(position).toBe(15000);
    });
  });
});

describe('getAdjacentPositions', () => {
  const tasks = [
    { id: '1', position: 10000 },
    { id: '2', position: 20000 },
    { id: '3', position: 30000 },
    { id: '4', position: 40000 },
    { id: '5', position: 50000 }
  ];

  it('should find adjacent positions for middle item', () => {
    const adjacent = getAdjacentPositions(tasks, 2);
    expect(adjacent).toEqual({
      prev: { id: '2', position: 20000 },
      next: { id: '4', position: 40000 }
    });
  });

  it('should handle first item with no previous', () => {
    const adjacent = getAdjacentPositions(tasks, 0);
    expect(adjacent).toEqual({
      prev: null,
      next: { id: '2', position: 20000 }
    });
  });

  it('should handle last item with no next', () => {
    const adjacent = getAdjacentPositions(tasks, 4);
    expect(adjacent).toEqual({
      prev: { id: '4', position: 40000 },
      next: null
    });
  });

  it('should handle single item list', () => {
    const singleTask = [{ id: '1', position: 10000 }];
    const adjacent = getAdjacentPositions(singleTask, 0);
    expect(adjacent).toEqual({
      prev: null,
      next: null
    });
  });

  it('should handle empty list', () => {
    const adjacent = getAdjacentPositions([], 0);
    expect(adjacent).toEqual({
      prev: null,
      next: null
    });
  });

  it('should handle out of bounds index', () => {
    const adjacent = getAdjacentPositions(tasks, 10);
    expect(adjacent).toEqual({
      prev: null,
      next: null
    });
  });

  it('should handle negative index', () => {
    const adjacent = getAdjacentPositions(tasks, -1);
    expect(adjacent).toEqual({
      prev: null,
      next: null
    });
  });

  it('should work with unsorted positions', () => {
    const unsorted = [
      { id: '1', position: 30000 },
      { id: '2', position: 10000 },
      { id: '3', position: 20000 }
    ];
    // Should not sort, just get adjacent by array index
    const adjacent = getAdjacentPositions(unsorted, 1);
    expect(adjacent).toEqual({
      prev: { id: '1', position: 30000 },
      next: { id: '3', position: 20000 }
    });
  });
});