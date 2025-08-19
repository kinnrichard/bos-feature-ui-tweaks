import { describe, expect, it, vi } from 'vitest';
import { 
  runMutators, 
  runValidators, 
  ValidationError,
  type MutatorFunction,
  type ValidatorFunction
} from '../mutator-hooks';
import type { MutatorContext } from '../../../shared/mutators/base-mutator';

describe('Mutator Hooks System', () => {
  const mockContext: MutatorContext = {
    user: { id: 'user-123' },
    offline: false,
    action: 'create'
  };

  describe('runMutators', () => {
    it('returns data unchanged when no mutators provided', async () => {
      const data = { name: 'Test' };
      const result = await runMutators(data, undefined, mockContext);
      expect(result).toEqual(data);
    });

    it('returns data unchanged when empty mutators array', async () => {
      const data = { name: 'Test' };
      const result = await runMutators(data, [], mockContext);
      expect(result).toEqual(data);
    });

    it('runs single mutator', async () => {
      const data = { name: 'Test' };
      const mutator: MutatorFunction<any> = vi.fn((d) => ({ ...d, normalized: true }));
      
      const result = await runMutators(data, [mutator], mockContext);
      
      expect(mutator).toHaveBeenCalledWith(data, mockContext);
      expect(result).toEqual({ name: 'Test', normalized: true });
    });

    it('chains multiple mutators in order', async () => {
      const data = { value: 1 };
      const mutator1: MutatorFunction<any> = vi.fn((d) => ({ ...d, value: d.value * 2 }));
      const mutator2: MutatorFunction<any> = vi.fn((d) => ({ ...d, value: d.value + 10 }));
      
      const result = await runMutators(data, [mutator1, mutator2], mockContext);
      
      expect(mutator1).toHaveBeenCalledWith({ value: 1 }, mockContext);
      expect(mutator2).toHaveBeenCalledWith({ value: 2 }, mockContext);
      expect(result).toEqual({ value: 12 });
    });

    it('handles async mutators', async () => {
      const data = { name: 'Test' };
      const asyncMutator: MutatorFunction<any> = vi.fn(async (d) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { ...d, async: true };
      });
      
      const result = await runMutators(data, [asyncMutator], mockContext);
      
      expect(result).toEqual({ name: 'Test', async: true });
    });
  });

  describe('runValidators', () => {
    it('returns valid when no validators provided', async () => {
      const data = { name: 'Test' };
      const result = await runValidators(data, undefined, mockContext);
      expect(result).toEqual({ valid: true });
    });

    it('returns valid when empty validators array', async () => {
      const data = { name: 'Test' };
      const result = await runValidators(data, [], mockContext);
      expect(result).toEqual({ valid: true });
    });

    it('runs single validator that passes', async () => {
      const data = { name: 'Test' };
      const validator: ValidatorFunction<any> = vi.fn(() => ({ valid: true }));
      
      const result = await runValidators(data, [validator], mockContext);
      
      expect(validator).toHaveBeenCalledWith(data, mockContext);
      expect(result).toEqual({ valid: true });
    });

    it('runs single validator that fails', async () => {
      const data = { name: '' };
      const validator: ValidatorFunction<any> = vi.fn(() => ({
        valid: false,
        errors: { name: ['is required'] }
      }));
      
      const result = await runValidators(data, [validator], mockContext);
      
      expect(result).toEqual({
        valid: false,
        errors: { name: ['is required'] }
      });
    });

    it('merges errors from multiple validators', async () => {
      const data = { name: '', email: 'invalid' };
      const validator1: ValidatorFunction<any> = vi.fn(() => ({
        valid: false,
        errors: { name: ['is required'] }
      }));
      const validator2: ValidatorFunction<any> = vi.fn(() => ({
        valid: false,
        errors: { 
          name: ['is too short'],
          email: ['is invalid'] 
        }
      }));
      
      const result = await runValidators(data, [validator1, validator2], mockContext);
      
      expect(result).toEqual({
        valid: false,
        errors: {
          name: ['is required', 'is too short'],
          email: ['is invalid']
        }
      });
    });

    it('handles async validators', async () => {
      const data = { name: 'Test' };
      const asyncValidator: ValidatorFunction<any> = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { valid: true };
      });
      
      const result = await runValidators(data, [asyncValidator], mockContext);
      
      expect(result).toEqual({ valid: true });
    });
  });

  describe('ValidationError', () => {
    it('stores errors and provides helper methods', () => {
      const errors = {
        name: ['is required', 'is too short'],
        email: ['is invalid']
      };
      
      const error = new ValidationError('Validation failed', errors);
      
      expect(error.message).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
      expect(error.errors).toEqual(errors);
    });

    it('getFirstError returns first error for field', () => {
      const error = new ValidationError('Validation failed', {
        name: ['is required', 'is too short'],
        email: ['is invalid']
      });
      
      expect(error.getFirstError('name')).toBe('is required');
      expect(error.getFirstError('email')).toBe('is invalid');
      expect(error.getFirstError('missing')).toBeUndefined();
    });

    it('getAllErrors returns flat array of all errors', () => {
      const error = new ValidationError('Validation failed', {
        name: ['is required', 'is too short'],
        email: ['is invalid']
      });
      
      expect(error.getAllErrors()).toEqual([
        'is required',
        'is too short',
        'is invalid'
      ]);
    });
  });
});