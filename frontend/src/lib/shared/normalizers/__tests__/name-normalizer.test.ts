import { describe, expect, it } from 'vitest';
import { normalizeClientName } from '../name-normalizer';

describe('normalizeClientName', () => {
  it('removes accents from names', () => {
    expect(normalizeClientName('Café')).toBe('cafe');
    expect(normalizeClientName('niño')).toBe('nino');
    expect(normalizeClientName('François')).toBe('francois');
  });
  
  it('handles complex Unicode characters', () => {
    expect(normalizeClientName('Zürich')).toBe('zurich');
    expect(normalizeClientName('São Paulo')).toBe('saopaulo');
    expect(normalizeClientName('Köln')).toBe('koln');
  });
  
  it('converts to lowercase', () => {
    expect(normalizeClientName('test')).toBe('test');
    expect(normalizeClientName('MiXeD')).toBe('mixed');
  });
  
  it('removes special characters and spaces', () => {
    expect(normalizeClientName('ABC & Co.')).toBe('abcco');
    expect(normalizeClientName('Test-Name')).toBe('testname');
    expect(normalizeClientName('Name (with) [brackets]')).toBe('namewithbrackets');
    expect(normalizeClientName('Name @ Company')).toBe('namecompany');
  });
  
  it('handles null and undefined values', () => {
    expect(normalizeClientName(null as any)).toBeNull();
    expect(normalizeClientName(undefined as any)).toBeNull();
  });
  
  it('handles empty strings', () => {
    expect(normalizeClientName('')).toBeNull();
  });
  
  it('removes all whitespace', () => {
    expect(normalizeClientName('  spaced   out  ')).toBe('spacedout');
    expect(normalizeClientName('line\nbreak')).toBe('linebreak');
    expect(normalizeClientName('tab\tseparated')).toBe('tabseparated');
  });
  
  it('keeps only alphanumeric characters', () => {
    expect(normalizeClientName('Test123')).toBe('test123');
    expect(normalizeClientName('!@#$%^&*()')).toBeNull();
  });
});

describe('normalizeClientName with object input', () => {
  it('normalizes name field and adds normalized_name', () => {
    const input = { name: 'Café René' };
    const result = normalizeClientName(input);
    
    expect(result).toEqual({
      name: 'Café René',
      normalized_name: 'caferene'
    });
  });
  
  it('preserves other fields', () => {
    const input = { 
      name: 'Test Company',
      id: '123',
      type: 'client'
    };
    const result = normalizeClientName(input);
    
    expect(result).toEqual({
      name: 'Test Company',
      normalized_name: 'testcompany',
      id: '123',
      type: 'client'
    });
  });
  
  it('returns input unchanged if no name field', () => {
    const input = { id: '123', type: 'client' };
    const result = normalizeClientName(input);
    
    expect(result).toEqual(input);
  });
  
  it('handles empty name in object', () => {
    const input = { name: '' };
    const result = normalizeClientName(input);
    
    expect(result).toEqual({
      name: '',
      normalized_name: null
    });
  });
});