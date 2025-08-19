/**
 * Epic-008 Rails Generator Tests
 *
 * Tests for Rails generator output validation and model file structure
 * Validates that generated models conform to the new Epic-008 architecture
 */

import { test, expect } from '@playwright/test';
import { validateMigration } from '../src/lib/models/migration/epic-008-migration';
import * as fs from 'fs/promises';
import * as path from 'path';

test.describe.skip('Epic-008 Rails Generator Validation (ARCHIVED - Architecture Evolved)', () => {
  const projectRoot = '/Users/claude/Projects/bos/frontend';
  // Migration instance for testing - not needed due to test skip

  test.describe('Generated File Structure', () => {
    test('should have correct file structure for Epic-008', async () => {
      const requiredFiles = [
        'src/lib/models/base/types.ts',
        'src/lib/models/base/active-record.ts',
        'src/lib/models/index.ts',
        'src/lib/models/reactive-task.ts',
        'src/lib/zero/task.generated.ts',
      ];

      for (const filePath of requiredFiles) {
        const fullPath = path.join(projectRoot, filePath);

        try {
          await fs.access(fullPath);
          // File exists
          expect(true).toBe(true);
        } catch {
          // File doesn't exist
          expect(true).toBe(false);
          console.error(`Missing required file: ${filePath}`);
        }
      }
    });

    test('should have valid TypeScript syntax in generated files', async () => {
      const generatedFiles = [
        'src/lib/zero/task.generated.ts',
        'src/lib/models/base/active-record.ts',
        'src/lib/models/base/types.ts',
      ];

      for (const filePath of generatedFiles) {
        const fullPath = path.join(projectRoot, filePath);

        try {
          const content = await fs.readFile(fullPath, 'utf-8');

          // Basic TypeScript syntax checks
          expect(content).not.toContain('undefined');
          expect(content).not.toContain('console.log'); // No debug logs in generated files

          // Should have proper exports
          if (filePath.includes('task.generated.ts')) {
            expect(content).toContain('export interface Task');
            expect(content).toContain('export async function createTask');
            expect(content).toContain('export async function updateTask');
            expect(content).toContain('export class TaskInstance');
          }

          // Should have proper imports
          expect(content).toMatch(/import.*from/);
        } catch (error) {
          console.error(`Error validating ${filePath}:`, error);
          expect(true).toBe(false);
        }
      }
    });

    test('should have proper auto-generation headers', async () => {
      const generatedFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(generatedFile, 'utf-8');

        // Should have generation warning
        expect(content).toContain('AUTO-GENERATED');
        expect(content).toContain('DO NOT EDIT');
        expect(content).toContain('rails generate zero:mutations');

        // Should have generation timestamp
        expect(content).toMatch(/Generated at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
      } catch (error) {
        console.error('Error checking generation headers:', error);
        expect(true).toBe(false);
      }
    });
  });

  test.describe('Model Export Structure', () => {
    test('should export correct models from index', async () => {
      const indexFile = path.join(projectRoot, 'src/lib/models/index.ts');

      try {
        const content = await fs.readFile(indexFile, 'utf-8');

        // Should export Task from Zero generated models
        expect(content).toContain('export { Task,');
        expect(content).toContain('type Task as TaskData');
        expect(content).toContain('type CreateTaskData');
        expect(content).toContain('type UpdateTaskData');

        // Should export ReactiveTask
        expect(content).toContain('export { ReactiveTask }');

        // Should provide ActiveModels and ReactiveModels objects
        expect(content).toContain('export const ActiveModels');
        expect(content).toContain('export const ReactiveModels');

        // Should have generation timestamp
        expect(content).toMatch(/Generated: \d{4}-\d{2}-\d{2}/);
      } catch (error) {
        console.error('Error validating index exports:', error);
        expect(true).toBe(false);
      }
    });

    test('should provide correct import aliases', async () => {
      const indexFile = path.join(projectRoot, 'src/lib/models/index.ts');

      try {
        const content = await fs.readFile(indexFile, 'utf-8');

        // Should document import patterns for switching
        expect(content).toContain('Import alias helpers');
        expect(content).toContain('In non-reactive context');
        expect(content).toContain('In Svelte component');
        expect(content).toContain('ReactiveTask as Task');
      } catch (error) {
        console.error('Error validating import aliases:', error);
        expect(true).toBe(false);
      }
    });
  });

  test.describe('Generated CRUD Operations', () => {
    test('should have all required CRUD functions', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Core CRUD operations
        expect(content).toContain('export async function createTask');
        expect(content).toContain('export async function updateTask');
        expect(content).toContain('export async function discardTask');
        expect(content).toContain('export async function undiscardTask');
        expect(content).toContain('export async function upsertTask');

        // Position management (acts_as_list)
        expect(content).toContain('export async function moveBeforeTask');
        expect(content).toContain('export async function moveAfterTask');
        expect(content).toContain('export async function moveToTopTask');
        expect(content).toContain('export async function moveToBottomTask');

        // Instance class
        expect(content).toContain('export class TaskInstance');

        // ActiveRecord-style queries
        expect(content).toContain('export const Task');
      } catch (error) {
        console.error('Error validating CRUD operations:', error);
        expect(true).toBe(false);
      }
    });

    test('should have proper function signatures with validation', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // createTask should validate required fields
        expect(content).toContain('Lock version is required');
        expect(content).toContain('Applies to all targets is required');

        // updateTask should validate ID format
        expect(content).toContain('Task ID must be a valid UUID');
        expect(content).toContain('Update data is required');

        // Should validate UUID format with regex
        expect(content).toContain(
          '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
        );

        // Should generate proper UUIDs
        expect(content).toContain('crypto.randomUUID()');
      } catch (error) {
        console.error('Error validating function signatures:', error);
        expect(true).toBe(false);
      }
    });

    test('should implement discard gem patterns correctly', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // discardTask should set discarded_at
        expect(content).toMatch(/discarded_at:\s*now/);

        // undiscardTask should clear discarded_at
        expect(content).toMatch(/discarded_at:\s*null/);

        // TaskInstance should have discard gem methods
        expect(content).toContain('get isDiscarded()');
        expect(content).toContain('get isKept()');
        expect(content).toContain('async discard()');
        expect(content).toContain('async undiscard()');

        // Query interface should have kept/discarded scopes
        expect(content).toContain('kept()');
        expect(content).toContain('discarded()');
        expect(content).toContain("'discarded_at', 'IS', null");
        expect(content).toContain("'discarded_at', 'IS NOT', null");
      } catch (error) {
        console.error('Error validating discard gem patterns:', error);
        expect(true).toBe(false);
      }
    });
  });

  test.describe('TypeScript Type Generation', () => {
    test('should generate correct TypeScript interfaces', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Main Task interface
        expect(content).toContain('export interface Task {');
        expect(content).toContain('title?: string| null;');
        expect(content).toContain('status?: 0 | 1 | 2 | 3 | 4| null;');
        expect(content).toContain('created_at: number;');
        expect(content).toContain('updated_at: number;');
        expect(content).toContain('id: string;');
        expect(content).toContain('discarded_at?: number| null;');

        // CreateTaskData interface
        expect(content).toContain('export interface CreateTaskData {');
        expect(content).toContain('lock_version: number;');
        expect(content).toContain('applies_to_all_targets: boolean;');

        // UpdateTaskData interface
        expect(content).toContain('export interface UpdateTaskData {');

        // Mutation result interface
        expect(content).toContain('export interface TaskMutationResult {');
        expect(content).toContain('id: string;');
      } catch (error) {
        console.error('Error validating TypeScript interfaces:', error);
        expect(true).toBe(false);
      }
    });

    test('should have proper null/undefined handling', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Optional fields should have | null
        expect(content).toContain('title?: string| null;');
        expect(content).toContain('job_id?: string| null;');
        expect(content).toContain('parent_id?: string| null;');

        // Required fields should not have | null
        expect(content).toContain('id: string;');
        expect(content).toContain('created_at: number;');
        expect(content).toContain('updated_at: number;');
        expect(content).toContain('lock_version: number;');

        // Should check for null/undefined in validation
        expect(content).toContain('=== undefined');
        expect(content).toContain('=== null');
      } catch (error) {
        console.error('Error validating null handling:', error);
        expect(true).toBe(false);
      }
    });
  });

  test.describe('Rails Compatibility', () => {
    test('should implement Rails ActiveRecord patterns', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Should have Rails-style query methods
        expect(content).toContain('find(id: string)');
        expect(content).toContain('all()');
        expect(content).toContain('where(conditions');

        // TaskInstance should have Rails-style methods
        expect(content).toContain('async update(attributes');
        expect(content).toContain('inspect():');

        // Should use Rails naming conventions
        expect(content).toContain('created_at');
        expect(content).toContain('updated_at');
        expect(content).toContain('discarded_at');
      } catch (error) {
        console.error('Error validating Rails compatibility:', error);
        expect(true).toBe(false);
      }
    });

    test('should implement acts_as_list patterns', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Position field should exist
        expect(content).toContain('position?: number| null;');

        // Position management methods
        expect(content).toContain('moveBeforeTask');
        expect(content).toContain('moveAfterTask');
        expect(content).toContain('moveToTopTask');
        expect(content).toContain('moveToBottomTask');

        // TaskInstance position methods
        expect(content).toContain('async moveBefore');
        expect(content).toContain('async moveAfter');
        expect(content).toContain('async moveToTop');
        expect(content).toContain('async moveToBottom');

        // Position calculation logic
        expect(content).toContain('newPosition');
        expect(content).toContain('targetRecord.position');
      } catch (error) {
        console.error('Error validating acts_as_list patterns:', error);
        expect(true).toBe(false);
      }
    });
  });

  test.describe('Zero.js Integration', () => {
    test('should integrate properly with Zero client', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Should import Zero client
        expect(content).toContain("import { getZero } from './zero-client';");

        // Should check Zero client initialization
        expect(content).toContain('const zero = getZero();');
        expect(content).toContain('Zero client not initialized');

        // Should use Zero mutation API
        expect(content).toContain('zero.mutate.tasks.insert');
        expect(content).toContain('zero.mutate.tasks.update');
        expect(content).toContain('zero.mutate.tasks.upsert');

        // Should use Zero query API
        expect(content).toContain('zero.query.tasks');
        expect(content).toContain('.where(');
        expect(content).toContain('.orderBy(');
        expect(content).toContain('.materialize()');
      } catch (error) {
        console.error('Error validating Zero integration:', error);
        expect(true).toBe(false);
      }
    });

    test('should use createReactiveQuery for ActiveRecord interface', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Should have createReactiveQuery function
        expect(content).toContain('function createReactiveQuery');
        expect(content).toContain('queryBuilder.materialize()');
        expect(content).toContain('current = result || defaultValue');

        // Should use in Task query methods
        expect(content).toContain('createReactiveQuery(');

        // Should handle loading/success/error states
        expect(content).toContain("resultType: 'loading'");
        expect(content).toContain("resultType: 'success'");
        expect(content).toContain("resultType: 'error'");

        // Should have retry logic
        expect(content).toContain('retryCount');
        expect(content).toContain('maxRetries');
      } catch (error) {
        console.error('Error validating reactive query integration:', error);
        expect(true).toBe(false);
      }
    });
  });

  test.describe('Migration Compatibility', () => {
    test('should run migration validation successfully', async () => {
      const validation = await validateMigration();

      // Should identify missing ReactiveRecord base class if not implemented
      if (!validation.success) {
        console.warn('Validation errors found:', validation.errors);

        // Check for expected missing files
        const hasExpectedMissingFiles = validation.errors.some(
          (error) =>
            error.includes('reactive-record.ts') ||
            error.includes('task-data.ts') ||
            error.includes('task.ts')
        );

        // Either validation should pass completely, or have expected missing files
        expect(validation.success || hasExpectedMissingFiles).toBe(true);
      } else {
        expect(validation.success).toBe(true);
      }
    });

    test('should support import alias patterns', async () => {
      const reactiveTaskFile = path.join(projectRoot, 'src/lib/models/reactive-task.ts');

      try {
        const content = await fs.readFile(reactiveTaskFile, 'utf-8');

        // Should export ReactiveTask as Task for alias pattern
        expect(content).toContain('export { ReactiveTask as Task }');

        // Should document the alias pattern
        expect(content).toContain('Import alias for easy switching');
        expect(content).toContain('ReactiveTask as Task');

        // Should use generated Task types
        expect(content).toContain('type Task as TaskData');
        expect(content).toContain('type CreateTaskData');
        expect(content).toContain('type UpdateTaskData');
      } catch (error) {
        console.error('Error validating import aliases:', error);
        expect(true).toBe(false);
      }
    });
  });

  test.describe('Error Handling and Validation', () => {
    test('should have comprehensive error messages', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Should have detailed error messages
        expect(content).toContain(
          'Zero client not initialized. Please ensure Zero is properly set up.'
        );
        expect(content).toContain('Task ID is required and must be a string');
        expect(content).toContain('Failed to generate valid UUID');
        expect(content).toContain('Update data is required - at least one field must be provided');

        // Should have operation-specific error messages
        expect(content).toContain('Failed to create task:');
        expect(content).toContain('Failed to update task:');
        expect(content).toContain('Failed to discard task:');
        expect(content).toContain('Failed to move task');
      } catch (error) {
        console.error('Error validating error messages:', error);
        expect(true).toBe(false);
      }
    });

    test('should validate input parameters properly', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Should validate required fields in create
        expect(content).toContain(
          'if (data.lock_version === undefined || data.lock_version === null)'
        );
        expect(content).toContain(
          'if (data.applies_to_all_targets === undefined || data.applies_to_all_targets === null)'
        );

        // Should validate ID format with UUID regex
        expect(content).toContain(
          'if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i))'
        );

        // Should validate data is not empty
        expect(content).toContain('if (!data || Object.keys(data).length === 0)');
      } catch (error) {
        console.error('Error validating input validation:', error);
        expect(true).toBe(false);
      }
    });
  });

  test.describe('Performance Considerations', () => {
    test('should implement efficient query patterns', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Should use materialize() for active queries
        expect(content).toContain('queryBuilder.materialize()');
        expect(content).toContain('view.destroy()');

        // Should have retry logic for reliability
        expect(content).toContain('retryCount < maxRetries');
        expect(content).toContain('setTimeout(() => execute(), 500)');

        // Should handle null results gracefully
        expect(content).toContain('result || defaultValue');
        expect(content).toContain('result === null || result === undefined');
      } catch (error) {
        console.error('Error validating performance patterns:', error);
        expect(true).toBe(false);
      }
    });

    test('should minimize database queries', async () => {
      const taskFile = path.join(projectRoot, 'src/lib/zero/task.generated.ts');

      try {
        const content = await fs.readFile(taskFile, 'utf-8');

        // Should batch timestamp updates
        expect(content).toContain('const now = Date.now();');
        expect(content).toContain('updated_at: now');

        // Should reuse Zero client instance
        expect(content).toContain('const zero = getZero();');

        // Should use efficient query builders
        expect(content).toContain("orderBy('created_at', 'desc')");
      } catch (error) {
        console.error('Error validating query efficiency:', error);
        expect(true).toBe(false);
      }
    });
  });
});
