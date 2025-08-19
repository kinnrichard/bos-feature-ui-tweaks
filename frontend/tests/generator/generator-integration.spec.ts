/**
 * Rails Generator Integration Tests
 *
 * These tests verify that the Rails model generator:
 * 1. Produces ESLint-compliant code (no warnings/errors)
 * 2. Is idempotent (doesn't modify files unnecessarily)
 *
 * These tests run the actual Rails generator and validate the output.
 */

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ESLint } from 'eslint';
import { debugSystem } from '../../src/lib/utils/debug';

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const FRONTEND_ROOT = path.resolve(__dirname, '../..');
const MODELS_DIR = path.resolve(__dirname, '../../src/lib/models');

interface FileStats {
  path: string;
  mtime: number;
  ctime: number;
  size: number;
}

/**
 * Run Rails generator and capture generated file list
 */
async function runRailsGenerator(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const process = spawn('rails', ['generate', 'zero:active_models'], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Rails generator failed with code ${code}:\n${stderr}`));
        return;
      }

      // Parse generated files from output
      const generatedFiles: string[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        // Look for generator output patterns like "create frontend/src/lib/models/task.ts"
        const createMatch = line.match(/^\s*(create|identical)\s+(.+\.ts)$/);
        if (createMatch) {
          const relativePath = createMatch[2];
          // Convert to absolute path if it's in the models directory
          if (relativePath.includes('frontend/src/lib/models/')) {
            const fullPath = path.resolve(PROJECT_ROOT, relativePath);
            generatedFiles.push(fullPath);
          }
        }
      }

      resolve(generatedFiles);
    });
  });
}

/**
 * Get file statistics for idempotency testing
 */
async function getFileStats(filePaths: string[]): Promise<FileStats[]> {
  const stats: FileStats[] = [];

  for (const filePath of filePaths) {
    try {
      const stat = await fs.stat(filePath);
      stats.push({
        path: filePath,
        mtime: stat.mtime.getTime(),
        ctime: stat.ctime.getTime(),
        size: stat.size,
      });
    } catch (error) {
      // File might not exist yet, skip
      console.warn(`Could not stat file ${filePath}:`, error);
    }
  }

  return stats;
}

/**
 * Run ESLint on generated files
 */
async function lintGeneratedFiles(filePaths: string[]): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({
    cwd: FRONTEND_ROOT,
    // Use the same config as the project
    overrideConfigFile: path.resolve(FRONTEND_ROOT, 'eslint.config.js'),
  });

  const results: ESLint.LintResult[] = [];

  for (const filePath of filePaths) {
    try {
      // Only lint files that exist and are in the models directory
      if (
        await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false)
      ) {
        const result = await eslint.lintFiles([filePath]);
        results.push(...result);
      }
    } catch (error) {
      console.warn(`Could not lint file ${filePath}:`, error);
    }
  }

  return results;
}

/**
 * Run Prettier check on generated files
 */
async function checkPrettierFormatting(
  filePaths: string[]
): Promise<Array<{ file: string; needsFormatting: boolean }>> {
  const results: Array<{ file: string; needsFormatting: boolean }> = [];

  for (const filePath of filePaths) {
    try {
      // Only check files that exist
      if (
        await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false)
      ) {
        // Use Prettier CLI to check formatting
        const result = await new Promise<boolean>((resolve) => {
          const process = spawn('npx', ['prettier', '--check', filePath], {
            cwd: FRONTEND_ROOT,
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          process.on('close', (code) => {
            // Prettier --check exits with code 1 if files need formatting, 0 if they're already formatted
            resolve(code !== 0);
          });
        });

        results.push({
          file: filePath,
          needsFormatting: result,
        });
      }
    } catch (error) {
      console.warn(`Could not check Prettier formatting for file ${filePath}:`, error);
    }
  }

  return results;
}


/**
 * Get all model files that could be generated
 */
async function getAllModelFiles(): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(MODELS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        // Skip test files and the index file (which we removed)
        if (
          !entry.name.includes('.test.') &&
          !entry.name.includes('.spec.') &&
          entry.name !== 'index.ts'
        ) {
          files.push(path.resolve(MODELS_DIR, entry.name));
        }
      } else if (entry.isDirectory() && entry.name === 'types') {
        // Include type definition files
        const typesDir = path.resolve(MODELS_DIR, 'types');
        const typeEntries = await fs.readdir(typesDir);
        for (const typeFile of typeEntries) {
          if (typeFile.endsWith('.ts')) {
            files.push(path.resolve(typesDir, typeFile));
          }
        }
      }
    }
  } catch (error) {
    console.warn('Could not read models directory:', error);
  }

  return files;
}

describe('Rails Generator Integration Tests', () => {
  let generatedFiles: string[] = [];

  describe('Code Quality Compliance', () => {
    it('should generate ESLint and Prettier compliant code with no warnings or errors', async () => {
      debugSystem.development('Running Rails generator for ESLint validation test', {
        type: 'generator_test',
        operation: 'rails_generate_and_validate',
      });

      // First, run the Rails generator to create fresh files
      const freshlyGeneratedFiles = await runRailsGenerator();

      debugSystem.development('Rails generator completed, validating ESLint compliance', {
        type: 'generator_test',
        operation: 'eslint_validation',
        fileCount: freshlyGeneratedFiles.length,
        generatedFiles: freshlyGeneratedFiles.map((f) => f.split('/').pop()),
      });

      // Get all model files (including freshly generated ones)
      generatedFiles = await getAllModelFiles();

      const lintResults = await lintGeneratedFiles(generatedFiles);
      const prettierResults = await checkPrettierFormatting(generatedFiles);

      // Collect all problems
      const allProblems: Array<{
        file: string;
        line: number;
        column: number;
        message: string;
        severity: string;
      }> = [];

      // Add ESLint problems
      for (const result of lintResults) {
        for (const message of result.messages) {
          allProblems.push({
            file: result.filePath,
            line: message.line || 0,
            column: message.column || 0,
            message: message.message,
            severity: message.severity === 1 ? 'warning' : 'error',
          });
        }
      }

      // Add Prettier problems
      for (const result of prettierResults) {
        if (result.needsFormatting) {
          allProblems.push({
            file: result.file,
            line: 0,
            column: 0,
            message: 'File does not match Prettier formatting rules',
            severity: 'error',
          });
        }
      }

      // Report problems if any exist
      if (allProblems.length > 0) {
        console.error('❌ Code quality problems found in generated files:');
        for (const problem of allProblems) {
          const relativePath = path.relative(FRONTEND_ROOT, problem.file);
          console.error(
            `  ${relativePath}:${problem.line}:${problem.column} ${problem.severity} ${problem.message}`
          );
        }

        expect(allProblems).toHaveLength(0);
      } else {
        debugSystem.development('ESLint validation passed', {
          type: 'generator_test',
          operation: 'eslint_validation',
          result: 'success',
        });
      }
    }, 90000); // 90 second timeout to account for Rails generator + ESLint validation
  });

  describe('Generator Idempotency', () => {
    it('should not modify files when run multiple times (idempotent behavior)', async () => {
      debugSystem.development('Testing generator idempotency', {
        type: 'generator_test',
        operation: 'idempotency_validation',
      });

      // Ensure we have files to test (in case this test runs independently)
      if (generatedFiles.length === 0) {
        debugSystem.development('No generated files found, getting current model files', {
          type: 'generator_test',
          operation: 'fallback_file_discovery',
        });
        generatedFiles = await getAllModelFiles();
      }

      // The generator should now produce Prettier-compliant code directly
      // No need for special regeneration since auto-formatting is no longer applied

      // Get initial file stats
      const initialStats = await getFileStats(generatedFiles);

      // Wait a small amount to ensure timestamps would be different if files were modified
      await new Promise((resolve) => setTimeout(resolve, 1100)); // 1.1 seconds

      // Run generator again
      await runRailsGenerator();

      // Get new file stats
      const finalStats = await getFileStats(generatedFiles);

      // Compare stats
      const modifiedFiles: string[] = [];

      for (const initialStat of initialStats) {
        const finalStat = finalStats.find((f) => f.path === initialStat.path);

        if (!finalStat) {
          modifiedFiles.push(`${initialStat.path} (deleted)`);
          continue;
        }

        // Check if modification time changed
        if (Math.abs(finalStat.mtime - initialStat.mtime) > 1000) {
          // 1 second tolerance
          modifiedFiles.push(
            `${initialStat.path} (mtime: ${new Date(initialStat.mtime).toISOString()} → ${new Date(finalStat.mtime).toISOString()})`
          );
        }

        // Check if size changed
        if (finalStat.size !== initialStat.size) {
          modifiedFiles.push(
            `${initialStat.path} (size: ${initialStat.size} → ${finalStat.size} bytes)`
          );
        }
      }

      // Check for new files
      for (const finalStat of finalStats) {
        const initialStat = initialStats.find((f) => f.path === finalStat.path);
        if (!initialStat) {
          modifiedFiles.push(`${finalStat.path} (newly created)`);
        }
      }

      // Report results
      if (modifiedFiles.length > 0) {
        console.error('❌ Generator modified files on second run (not idempotent):');
        for (const file of modifiedFiles) {
          const relativePath = path.relative(PROJECT_ROOT, file);
          console.error(`  ${relativePath}`);
        }

        expect(modifiedFiles).toHaveLength(0);
      } else {
        debugSystem.development('Generator idempotency validation passed', {
          type: 'generator_test',
          operation: 'idempotency_validation',
          result: 'success',
        });
      }
    }, 60000);
  });
});
