import { describe, expect, it } from 'vitest';
import { normalizeString } from '../name-normalizer';

// These test cases should match the Ruby test cases exactly
const PARITY_TEST_CASES = [
  // Input -> Expected output
  ['Café', 'cafe'],
  ['niño', 'nino'],
  ['François', 'francois'],
  ['Zürich', 'zurich'],
  ['São Paulo', 'saopaulo'],
  ['Köln', 'koln'],
  ['test', 'test'],
  ['MiXeD', 'mixed'],
  ['ABC & Co.', 'abcco'],
  ['Test-Name', 'testname'],
  ['Name (with) [brackets]', 'namewithbrackets'],
  ['Name @ Company', 'namecompany'],
  ['  spaced   out  ', 'spacedout'],
  ['line\nbreak', 'linebreak'],
  ['tab\tseparated', 'tabseparated'],
  ['Test123', 'test123'],
  ['', null],
  ['!@#$%^&*()', null],
  ['   ', null],
  [null, null],
] as const;

describe('Ruby/TypeScript Parity Tests', () => {
  it('produces identical results to Ruby implementation', () => {
    PARITY_TEST_CASES.forEach(([input, expected]) => {
      const result = normalizeString(input as string);
      expect(result).toBe(expected);
    });
  });
  
  it('matches Ruby implementation documentation examples', () => {
    // Examples from the Ruby README
    expect(normalizeString('Café René')).toBe('caferene');
    expect(normalizeString('naïve')).toBe('naive');
    expect(normalizeString('résumé')).toBe('resume');
    expect(normalizeString('piñata')).toBe('pinata');
    expect(normalizeString('über')).toBe('uber');
  });
});