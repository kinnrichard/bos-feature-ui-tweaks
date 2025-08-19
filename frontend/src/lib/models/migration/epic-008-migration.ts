/**
 * Epic-008 Migration Utilities
 *
 * Provides utilities and analysis tools to help with the big bang migration
 * from the old model system to Epic-008 ReactiveRecord architecture.
 *
 * This includes:
 * - Current usage analysis
 * - Import pattern detection
 * - Migration scripts and helpers
 * - Compatibility checks
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { debugDatabase } from '../../utils/debug';

/**
 * File usage analysis result
 */
export interface FileAnalysis {
  filePath: string;
  oldImports: string[];
  newImports: string[];
  requiredChanges: string[];
  riskLevel: 'low' | 'medium' | 'high';
  isReactiveContext: boolean;
}

/**
 * Migration analysis summary
 */
export interface MigrationAnalysis {
  totalFiles: number;
  filesToMigrate: number;
  riskAssessment: {
    low: number;
    medium: number;
    high: number;
  };
  oldPatterns: {
    pattern: string;
    count: number;
    files: string[];
  }[];
  recommendedOrder: string[];
}

/**
 * Epic-008 Migration Utility Class
 */
export class Epic008Migration {
  private projectRoot: string;
  private sourceDir: string;

  constructor(projectRoot = '/Users/claude/Projects/bos/frontend') {
    this.projectRoot = projectRoot;
    this.sourceDir = join(projectRoot, 'src');
  }

  /**
   * Analyze current Task model usage across the codebase
   */
  async analyzeCurrentUsage(): Promise<MigrationAnalysis> {
    const analysis: MigrationAnalysis = {
      totalFiles: 0,
      filesToMigrate: 0,
      riskAssessment: { low: 0, medium: 0, high: 0 },
      oldPatterns: [],
      recommendedOrder: [],
    };

    try {
      const files = await this.findRelevantFiles();
      analysis.totalFiles = files.length;

      const fileAnalyses: FileAnalysis[] = [];

      for (const filePath of files) {
        const fileAnalysis = await this.analyzeFile(filePath);
        if (fileAnalysis.requiredChanges.length > 0) {
          fileAnalyses.push(fileAnalysis);
          analysis.filesToMigrate++;
          analysis.riskAssessment[fileAnalysis.riskLevel]++;
        }
      }

      // Collect pattern statistics
      const patternCounts = new Map<string, { count: number; files: string[] }>();

      fileAnalyses.forEach((fa) => {
        fa.oldImports.forEach((imp) => {
          const existing = patternCounts.get(imp) || { count: 0, files: [] };
          existing.count++;
          existing.files.push(fa.filePath);
          patternCounts.set(imp, existing);
        });
      });

      analysis.oldPatterns = Array.from(patternCounts.entries()).map(([pattern, data]) => ({
        pattern,
        count: data.count,
        files: data.files,
      }));

      // Generate recommended migration order (low risk first)
      analysis.recommendedOrder = fileAnalyses
        .sort((a, b) => {
          const riskOrder = { low: 1, medium: 2, high: 3 };
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        })
        .map((fa) => fa.filePath);

      return analysis;
    } catch (error) {
      debugDatabase.error('Migration analysis failed', { error });
      throw error;
    }
  }

  /**
   * Find all files that might need migration
   */
  private async findRelevantFiles(): Promise<string[]> {
    const files: string[] = [];

    const searchDirs = [
      join(this.sourceDir, 'lib'),
      join(this.sourceDir, 'components'),
      join(this.sourceDir, 'routes'),
      join(this.sourceDir, 'stores'),
    ];

    for (const dir of searchDirs) {
      try {
        await this.findFilesRecursive(dir, files, ['.ts', '.js', '.svelte']);
      } catch (error) {
        // Directory might not exist, continue
        debugDatabase.warn('Directory not found during migration scan', { dir, error });
      }
    }

    return files;
  }

  /**
   * Recursively find files with specific extensions
   */
  private async findFilesRecursive(
    dir: string,
    files: string[],
    extensions: string[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.findFilesRecursive(fullPath, files, extensions);
        } else if (entry.isFile()) {
          const ext = entry.name.substring(entry.name.lastIndexOf('.'));
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      debugDatabase.warn('Could not read directory during migration scan', { dir, error });
    }
  }

  /**
   * Analyze a single file for migration requirements
   */
  private async analyzeFile(filePath: string): Promise<FileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    const isReactiveContext =
      filePath.endsWith('.svelte') || content.includes('$state') || content.includes('$derived');

    const analysis: FileAnalysis = {
      filePath,
      oldImports: [],
      newImports: [],
      requiredChanges: [],
      riskLevel: 'low',
      isReactiveContext,
    };

    // Detect old import patterns
    const oldImportPatterns = [
      /import.*from.*['"`].*\/models\/generated\/task['"`]/g,
      /import.*Task.*from.*['"`].*task\.generated['"`]/g,
      /import.*TaskType.*from.*['"`].*generated\/task['"`]/g,
      /import.*ModelFactory.*from.*['"`].*model-factory['"`]/g,
      /import.*RecordInstance.*from.*['"`].*record-instance['"`]/g,
    ];

    oldImportPatterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) {
        analysis.oldImports.push(...matches);
      }
    });

    // Detect old usage patterns that need updating
    const oldUsagePatterns = [
      {
        pattern: /Task\.find\([^)]+\)(?!\s*\.then)(?!\s*await)/g,
        issue: 'find() calls need await',
      },
      { pattern: /TaskType\b/g, issue: 'TaskType should be TaskData' },
      { pattern: /ModelFactory\.create/g, issue: 'ModelFactory usage needs replacement' },
      { pattern: /RecordInstance/g, issue: 'RecordInstance pattern deprecated' },
      { pattern: /\.createActiveModel/g, issue: 'createActiveModel deprecated' },
      { pattern: /\.createReactiveModel/g, issue: 'createReactiveModel deprecated' },
    ];

    oldUsagePatterns.forEach(({ pattern, issue }) => {
      const matches = content.match(pattern);
      if (matches) {
        analysis.requiredChanges.push(`${issue} (${matches.length} occurrences)`);
      }
    });

    // Generate new import suggestions
    if (analysis.oldImports.length > 0) {
      if (isReactiveContext) {
        analysis.newImports.push("import { ReactiveTask as Task } from '$models';");
      } else {
        analysis.newImports.push("import { Task } from '$models';");
      }
    }

    // Assess risk level
    if (analysis.requiredChanges.length > 10) {
      analysis.riskLevel = 'high';
    } else if (analysis.requiredChanges.length > 3) {
      analysis.riskLevel = 'medium';
    }

    // High risk for complex patterns
    if (content.includes('ModelFactory') || content.includes('RecordInstance')) {
      analysis.riskLevel = 'high';
    }

    return analysis;
  }

  /**
   * Generate migration script for a specific file
   */
  async generateMigrationScript(filePath: string): Promise<string> {
    const analysis = await this.analyzeFile(filePath);

    const script = `
// Epic-008 Migration Script for: ${filePath}
// Generated on: ${new Date().toISOString()}
// Risk Level: ${analysis.riskLevel}
// Reactive Context: ${analysis.isReactiveContext}

/*
REQUIRED CHANGES:
${analysis.requiredChanges.map((change) => `- ${change}`).join('\n')}

OLD IMPORTS TO REPLACE:
${analysis.oldImports.map((imp) => `- ${imp}`).join('\n')}

NEW IMPORTS TO ADD:
${analysis.newImports.map((imp) => `+ ${imp}`).join('\n')}

MIGRATION STEPS:
1. Replace old imports with new imports
2. Add 'await' to Task.find() calls that don't have it
3. Replace TaskType with TaskData
4. Update error handling to use RecordNotFoundError
5. Test reactive functionality if in Svelte component

EXAMPLE TRANSFORMATIONS:
${this.generateExampleTransformations(analysis)}
*/
    `.trim();

    return script;
  }

  /**
   * Generate example transformations for the migration
   */
  private generateExampleTransformations(analysis: FileAnalysis): string {
    const examples: string[] = [];

    if (analysis.oldImports.some((imp) => imp.includes('generated/task'))) {
      examples.push(`
// BEFORE:
import { Task, TaskType } from '$lib/models/generated/task';
const task = Task.find(id);

// AFTER:
import { ${analysis.isReactiveContext ? 'ReactiveTask as Task' : 'Task'}, TaskData } from '$models';
const task = ${analysis.isReactiveContext ? 'Task.find(id)' : 'await Task.find(id)'};
      `);
    }

    if (analysis.requiredChanges.some((change) => change.includes('ModelFactory'))) {
      examples.push(`
// BEFORE:
import { ModelFactory } from '$lib/record-factory/model-factory';
const Task = ModelFactory.createActiveModel(taskConfig);

// AFTER:
import { Task } from '$models';
// ModelFactory is no longer needed
      `);
    }

    return examples.join('\n');
  }

  /**
   * Create a comprehensive migration report
   */
  async createMigrationReport(): Promise<string> {
    const analysis = await this.analyzeCurrentUsage();

    const report = `
# Epic-008 Migration Report
Generated on: ${new Date().toISOString()}

## Summary
- **Total files analyzed**: ${analysis.totalFiles}
- **Files requiring migration**: ${analysis.filesToMigrate}
- **Migration coverage**: ${((analysis.filesToMigrate / analysis.totalFiles) * 100).toFixed(1)}%

## Risk Assessment
- **Low risk**: ${analysis.riskAssessment.low} files
- **Medium risk**: ${analysis.riskAssessment.medium} files  
- **High risk**: ${analysis.riskAssessment.high} files

## Most Common Old Patterns
${analysis.oldPatterns
  .sort((a, b) => b.count - a.count)
  .slice(0, 10)
  .map((p) => `- \`${p.pattern}\` (${p.count} files)`)
  .join('\n')}

## Recommended Migration Order
${analysis.recommendedOrder
  .slice(0, 20)
  .map((file, i) => `${i + 1}. ${file}`)
  .join('\n')}

## Migration Strategy

### Phase 1: Foundation (Low Risk)
Migrate utility files and simple Task usage first.

### Phase 2: Components (Medium Risk) 
Migrate Svelte components to use ReactiveTask.

### Phase 3: Complex Logic (High Risk)
Migrate files with ModelFactory and complex patterns.

## Key Changes Required

1. **Import Updates**
   - Replace \`$lib/models/generated/task\` with \`$models\`
   - Use \`ReactiveTask as Task\` in Svelte components

2. **API Changes**
   - Add \`await\` to Task.find() calls
   - Replace \`TaskType\` with \`TaskData\`
   - Update error handling for \`RecordNotFoundError\`

3. **Reactive Updates**
   - Use \`.data\`, \`.isLoading\`, \`.error\` properties in Svelte
   - Replace direct Promise usage with ReactiveQuery

## Testing Strategy

1. Run TypeScript compilation after each phase
2. Test core CRUD operations: find, create, update, discard
3. Verify reactive updates in Svelte components
4. Check Zero.js integration and database queries
5. Validate discard gem functionality

## Rollback Plan

If issues arise, the migration can be rolled back by:
1. Reverting import changes
2. Restoring old model files
3. Re-running existing tests

The old system will remain functional until explicit removal.
    `.trim();

    return report;
  }

  /**
   * Validate that the new system is working correctly
   */
  async validateMigration(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check that foundation classes exist and are importable
      const foundationFiles = [
        'src/lib/models/base/types.ts',
        'src/lib/models/base/active-record.ts',
        'src/lib/models/base/reactive-record.ts',
      ];

      for (const file of foundationFiles) {
        const path = join(this.projectRoot, file);
        try {
          await fs.access(path);
        } catch {
          errors.push(`Foundation file missing: ${file}`);
        }
      }

      // Check that new Task models exist
      const taskFiles = [
        'src/lib/models/types/task-data.ts',
        'src/lib/models/task.ts',
        'src/lib/models/reactive-task.ts',
        'src/lib/models/index.ts',
      ];

      for (const file of taskFiles) {
        const path = join(this.projectRoot, file);
        try {
          await fs.access(path);
        } catch {
          errors.push(`Task model file missing: ${file}`);
        }
      }

      // Check TypeScript imports (basic syntax check)
      try {
        const indexContent = await fs.readFile(
          join(this.projectRoot, 'src/lib/models/index.ts'),
          'utf-8'
        );
        if (!indexContent.includes('export { Task }')) {
          errors.push('Task export missing from index.ts');
        }
        if (!indexContent.includes('export { ReactiveTask }')) {
          errors.push('ReactiveTask export missing from index.ts');
        }
      } catch (error) {
        errors.push(`Failed to validate index.ts: ${error}`);
      }
    } catch (error) {
      errors.push(`Validation failed: ${error}`);
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }
}

/**
 * Convenience function to run migration analysis
 */
export async function analyzeMigration(): Promise<MigrationAnalysis> {
  const migration = new Epic008Migration();
  return migration.analyzeCurrentUsage();
}

/**
 * Convenience function to create migration report
 */
export async function createMigrationReport(): Promise<string> {
  const migration = new Epic008Migration();
  return migration.createMigrationReport();
}

/**
 * Convenience function to validate migration
 */
export async function validateMigration(): Promise<{ success: boolean; errors: string[] }> {
  const migration = new Epic008Migration();
  return migration.validateMigration();
}
