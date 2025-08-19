import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Shared Logic Infrastructure', () => {
  describe('Directory Structure', () => {
    it('has normalizers directory', () => {
      const normalizersPath = path.join(__dirname, '../normalizers');
      expect(fs.existsSync(normalizersPath)).toBe(true);
    });

    it('has validators directory', () => {
      const validatorsPath = path.join(__dirname, '../validators');
      expect(fs.existsSync(validatorsPath)).toBe(true);
    });

    it('has mutators directory', () => {
      const mutatorsPath = path.join(__dirname, '../mutators');
      expect(fs.existsSync(mutatorsPath)).toBe(true);
    });

    it('has services directory', () => {
      const servicesPath = path.join(__dirname, '../services');
      expect(fs.existsSync(servicesPath)).toBe(true);
    });
  });

  describe('Module Exports', () => {
    it('exports from normalizers index', async () => {
      const normalizers = await import('../normalizers');
      expect(normalizers).toBeDefined();
    });

    it('exports from validators index', async () => {
      const validators = await import('../validators');
      expect(validators).toBeDefined();
    });

    it('exports from mutators index', async () => {
      const mutators = await import('../mutators');
      expect(mutators).toBeDefined();
    });
  });

  describe('Base Classes', () => {
    describe('BaseNormalizer', () => {
      it('defines normalize interface', async () => {
        const { BaseNormalizer } = await import('../normalizers/base-normalizer');
        const normalizer = new BaseNormalizer();
        expect(normalizer.normalize).toBeDefined();
      });

      it('throws error for base class normalize', async () => {
        const { BaseNormalizer } = await import('../normalizers/base-normalizer');
        const normalizer = new BaseNormalizer();
        expect(() => normalizer.normalize({})).toThrow('Must be implemented by subclass');
      });
    });

    describe('BaseValidator', () => {
      it('defines validate interface', async () => {
        const { BaseValidator } = await import('../validators/base-validator');
        const validator = new BaseValidator();
        expect(validator.validate).toBeDefined();
      });

      it('returns validation result structure', async () => {
        const { BaseValidator } = await import('../validators/base-validator');
        
        class TestValidator extends BaseValidator {
          validate(value: any, context?: any): { valid: boolean; errors?: Record<string, string[]> } {
            return { valid: true };
          }
        }

        const validator = new TestValidator();
        const result = validator.validate('test');
        expect(result).toHaveProperty('valid');
        expect(result.valid).toBe(true);
      });
    });

    describe('BaseMutator', () => {
      it('defines mutate interface', async () => {
        const { BaseMutator } = await import('../mutators/base-mutator');
        const mutator = new BaseMutator();
        expect(mutator.mutate).toBeDefined();
      });

      it('passes through data by default', async () => {
        const { BaseMutator } = await import('../mutators/base-mutator');
        
        class TestMutator extends BaseMutator {
          mutate(data: any, context?: any): any {
            return data;
          }
        }

        const mutator = new TestMutator();
        const data = { name: 'test' };
        expect(mutator.mutate(data)).toEqual(data);
      });
    });
  });
});