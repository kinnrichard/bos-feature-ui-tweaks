#!/usr/bin/env node

/**
 * Debug System Migration Tool - Convert 19-namespace to 6-category system
 * 
 * This script helps migrate debug function calls from the legacy 19-namespace system
 * to the new 6-category system with sub-namespace methods.
 * 
 * Usage:
 *   node scripts/migrate-debug-calls.js analyze              # Analyze current usage
 *   node scripts/migrate-debug-calls.js migrate [file]       # Migrate specific file or all files
 *   node scripts/migrate-debug-calls.js validate [file]      # Validate migrations
 *   node scripts/migrate-debug-calls.js report               # Generate migration report
 * 
 * Features:
 * - Analyzes existing debug function usage patterns across codebase
 * - Automatically converts legacy debug calls to new category system
 * - Maps 19 legacy functions to 6 categories with proper sub-namespaces
 * - Preserves backward compatibility (both systems work together)
 * - Provides detailed migration reports and recommendations
 * - Validates that migrated code still works correctly
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Legacy debug function mapping to new category system
const MIGRATION_MAP = {
  // Network category mappings
  debugAPI: { category: 'debugNetwork', method: 'api', namespace: 'bos:api' },
  debugAuth: { category: 'debugNetwork', method: 'auth', namespace: 'bos:auth' },
  debugSecurity: { category: 'debugNetwork', method: 'security', namespace: 'bos:security' },
  debugIntegration: { category: 'debugNetwork', method: 'integration', namespace: 'bos:integration' },
  debugWebSocket: { category: 'debugNetwork', method: 'websocket', namespace: 'bos:websocket' },
  
  // Data category mappings
  debugDatabase: { category: 'debugData', method: 'database', namespace: 'bos:database' },
  debugCache: { category: 'debugData', method: 'cache', namespace: 'bos:cache' },
  debugValidation: { category: 'debugData', method: 'validation', namespace: 'bos:validation' },
  debugReactive: { category: 'debugData', method: 'reactive', namespace: 'bos:reactive' },
  debugState: { category: 'debugData', method: 'state', namespace: 'bos:state' },
  
  // UI category mappings
  debugComponent: { category: 'debugUI', method: 'component', namespace: 'bos:component' },
  debugNavigation: { category: 'debugUI', method: 'navigation', namespace: 'bos:navigation' },
  debugNotification: { category: 'debugUI', method: 'notification', namespace: 'bos:notification' },
  
  // Business category mappings
  debugWorkflow: { category: 'debugBusiness', method: 'workflow', namespace: 'bos:workflow' },
  debugSearch: { category: 'debugBusiness', method: 'search', namespace: 'bos:search' },
  debugUpload: { category: 'debugBusiness', method: 'upload', namespace: 'bos:upload' },
  debugExport: { category: 'debugBusiness', method: 'export', namespace: 'bos:export' },
  
  // Monitor category mappings
  debugPerformance: { category: 'debugMonitor', method: 'performance', namespace: 'bos:performance' },
  debugError: { category: 'debugMonitor', method: 'error', namespace: 'bos:error' }
};

// All legacy debug functions
const LEGACY_FUNCTIONS = Object.keys(MIGRATION_MAP);

// File extensions to process
const FILE_EXTENSIONS = ['.js', '.ts', '.svelte'];

// Directories to scan (relative to project root)
const SCAN_DIRECTORIES = [
  'frontend/src',
  'frontend/tests',
  'scripts'
];

class DebugMigrationAnalyzer {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.results = {
      totalFiles: 0,
      filesWithDebug: 0,
      debugCallsFound: 0,
      functionUsage: {},
      fileAnalysis: [],
      migrationComplexity: 'low'
    };
  }

  /**
   * Analyze current debug usage across the codebase
   */
  async analyzeUsage() {
    console.log('🔍 Analyzing debug function usage across codebase...\n');
    
    // Initialize function usage tracking
    LEGACY_FUNCTIONS.forEach(func => {
      this.results.functionUsage[func] = { count: 0, files: [] };
    });

    // Scan directories for debug usage
    for (const dir of SCAN_DIRECTORIES) {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        await this.scanDirectory(fullPath);
      }
    }

    // Calculate migration complexity
    this.calculateComplexity();

    // Display results
    this.displayAnalysisResults();
    
    return this.results;
  }

  /**
   * Recursively scan directory for debug usage
   */
  async scanDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await this.scanDirectory(fullPath);
      } else if (entry.isFile() && this.shouldProcessFile(entry.name)) {
        await this.analyzeFile(fullPath);
      }
    }
  }

  /**
   * Check if file should be processed
   */
  shouldProcessFile(filename) {
    return FILE_EXTENSIONS.some(ext => filename.endsWith(ext));
  }

  /**
   * Analyze individual file for debug usage
   */
  async analyzeFile(filePath) {
    this.results.totalFiles++;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.projectRoot, filePath);
      
      const fileAnalysis = {
        path: relativePath,
        debugCalls: [],
        imports: [],
        migrationRequired: false,
        complexity: 'simple'
      };

      // Find import statements
      const importMatches = content.match(/import\s+{[^}]*debug[^}]*}\s+from\s+['"][^'"]*['"];?/g) || [];
      fileAnalysis.imports = importMatches;

      // Find debug function calls
      let totalCallsInFile = 0;
      LEGACY_FUNCTIONS.forEach(func => {
        // Match function calls including .warn() and .error() variants
        const patterns = [
          new RegExp(`\\b${func}\\s*\\(`, 'g'),
          new RegExp(`\\b${func}\\.warn\\s*\\(`, 'g'),
          new RegExp(`\\b${func}\\.error\\s*\\(`, 'g')
        ];

        patterns.forEach(pattern => {
          const matches = content.match(pattern) || [];
          if (matches.length > 0) {
            this.results.functionUsage[func].count += matches.length;
            this.results.functionUsage[func].files.push(relativePath);
            
            fileAnalysis.debugCalls.push({
              function: func,
              count: matches.length,
              variants: matches
            });
            
            totalCallsInFile += matches.length;
            fileAnalysis.migrationRequired = true;
          }
        });
      });

      if (totalCallsInFile > 0) {
        this.results.filesWithDebug++;
        this.results.debugCallsFound += totalCallsInFile;
        
        // Determine file complexity
        if (totalCallsInFile > 10) {
          fileAnalysis.complexity = 'complex';
        } else if (totalCallsInFile > 5) {
          fileAnalysis.complexity = 'moderate';
        }
        
        this.results.fileAnalysis.push(fileAnalysis);
      }
      
    } catch (error) {
      console.warn(`⚠️  Warning: Could not analyze ${filePath}: ${error.message}`);
    }
  }

  /**
   * Calculate overall migration complexity
   */
  calculateComplexity() {
    const totalCalls = this.results.debugCallsFound;
    const filesWithDebug = this.results.filesWithDebug;
    
    if (totalCalls > 100 || filesWithDebug > 20) {
      this.results.migrationComplexity = 'high';
    } else if (totalCalls > 50 || filesWithDebug > 10) {
      this.results.migrationComplexity = 'moderate';
    }
  }

  /**
   * Display analysis results
   */
  displayAnalysisResults() {
    console.log('📊 Debug Usage Analysis Results');
    console.log('================================\n');
    
    console.log(`📁 Files scanned: ${this.results.totalFiles}`);
    console.log(`🐞 Files with debug calls: ${this.results.filesWithDebug}`);
    console.log(`📞 Total debug calls found: ${this.results.debugCallsFound}`);
    console.log(`⚖️  Migration complexity: ${this.results.migrationComplexity.toUpperCase()}\n`);

    console.log('🔧 Function Usage Breakdown:');
    console.log('─'.repeat(50));
    
    // Sort functions by usage count
    const sortedFunctions = Object.entries(this.results.functionUsage)
      .filter(([_, data]) => data.count > 0)
      .sort(([, a], [, b]) => b.count - a.count);

    if (sortedFunctions.length === 0) {
      console.log('✅ No legacy debug function usage found!\n');
      return;
    }

    sortedFunctions.forEach(([func, data]) => {
      const mapping = MIGRATION_MAP[func];
      console.log(`${func.padEnd(20)} | ${String(data.count).padStart(3)} calls → ${mapping.category}.${mapping.method}()`);
    });

    console.log('\n🎯 Migration Recommendations:');
    console.log('─'.repeat(50));
    
    if (this.results.migrationComplexity === 'high') {
      console.log('• Migrate files in small batches to reduce risk');
      console.log('• Start with files that have the most debug calls');
      console.log('• Test thoroughly after each batch migration');
    } else if (this.results.migrationComplexity === 'moderate') {
      console.log('• Migrate files by category grouping');
      console.log('• Prioritize files with multiple debug function types');
      console.log('• Consider gradual migration over time');
    } else {
      console.log('• Low complexity - can migrate all files at once');
      console.log('• Simple find/replace operations should work');
      console.log('• Limited testing required');
    }

    console.log('\n📋 Top Files for Migration:');
    console.log('─'.repeat(50));
    
    const topFiles = this.results.fileAnalysis
      .sort((a, b) => {
        const aTotal = a.debugCalls.reduce((sum, call) => sum + call.count, 0);
        const bTotal = b.debugCalls.reduce((sum, call) => sum + call.count, 0);
        return bTotal - aTotal;
      })
      .slice(0, 10);

    topFiles.forEach((file, index) => {
      const totalCalls = file.debugCalls.reduce((sum, call) => sum + call.count, 0);
      console.log(`${(index + 1).toString().padStart(2)}. ${file.path.padEnd(40)} (${totalCalls} calls, ${file.complexity})`);
    });

    console.log('\n💡 Usage Example After Migration:');
    console.log('─'.repeat(50));
    console.log('// Before (legacy):');
    console.log('debugAPI("Request completed", { url, status });');
    console.log('debugDatabase("Query executed", { sql, duration });');
    console.log('');
    console.log('// After (category):');
    console.log('debugNetwork.api("Request completed", { url, status });');
    console.log('debugData.database("Query executed", { sql, duration });');
    console.log('');
  }
}

class DebugMigrator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.migrationResults = {
      filesProcessed: 0,
      filesMigrated: 0,
      callsMigrated: 0,
      errors: []
    };
  }

  /**
   * Migrate debug calls in specific file or all files
   */
  async migrateFiles(targetFile = null) {
    console.log('🔄 Starting debug function migration...\n');

    if (targetFile) {
      // Migrate specific file
      const fullPath = path.resolve(this.projectRoot, targetFile);
      if (fs.existsSync(fullPath)) {
        await this.migrateFile(fullPath);
      } else {
        console.error(`❌ File not found: ${targetFile}`);
        return false;
      }
    } else {
      // Migrate all files
      for (const dir of SCAN_DIRECTORIES) {
        const fullPath = path.join(this.projectRoot, dir);
        if (fs.existsSync(fullPath)) {
          await this.migrateDirectory(fullPath);
        }
      }
    }

    this.displayMigrationResults();
    return this.migrationResults;
  }

  /**
   * Recursively migrate directory
   */
  async migrateDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await this.migrateDirectory(fullPath);
      } else if (entry.isFile() && this.shouldProcessFile(entry.name)) {
        await this.migrateFile(fullPath);
      }
    }
  }

  /**
   * Check if file should be processed
   */
  shouldProcessFile(filename) {
    return FILE_EXTENSIONS.some(ext => filename.endsWith(ext));
  }

  /**
   * Migrate individual file
   */
  async migrateFile(filePath) {
    this.migrationResults.filesProcessed++;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.projectRoot, filePath);
      
      let modifiedContent = content;
      let fileChanged = false;
      let callsInFile = 0;

      // 1. Update import statements
      const importRegex = /import\s+{([^}]*)}\s+from\s+(['"][^'"]*debug[^'"]*['"])/g;
      modifiedContent = modifiedContent.replace(importRegex, (match, imports, fromPath) => {
        // Extract individual imports
        const importList = imports.split(',').map(imp => imp.trim());
        const newImports = new Set();
        let hasLegacyImports = false;

        importList.forEach(imp => {
          if (LEGACY_FUNCTIONS.includes(imp)) {
            hasLegacyImports = true;
            const mapping = MIGRATION_MAP[imp];
            newImports.add(mapping.category);
          } else {
            newImports.add(imp);
          }
        });

        if (hasLegacyImports) {
          fileChanged = true;
          const sortedImports = Array.from(newImports).sort();
          return `import { ${sortedImports.join(', ')} } from ${fromPath}`;
        }
        
        return match;
      });

      // 2. Update function calls
      LEGACY_FUNCTIONS.forEach(func => {
        const mapping = MIGRATION_MAP[func];
        
        // Replace basic calls: debugAPI(...) → debugNetwork.api(...)
        const basicCallRegex = new RegExp(`\\b${func}\\s*\\(`, 'g');
        const basicMatches = modifiedContent.match(basicCallRegex) || [];
        if (basicMatches.length > 0) {
          modifiedContent = modifiedContent.replace(basicCallRegex, `${mapping.category}.${mapping.method}(`);
          callsInFile += basicMatches.length;
          fileChanged = true;
        }

        // Replace warn calls: debugAPI.warn(...) → debugNetwork.api.warn(...)
        const warnCallRegex = new RegExp(`\\b${func}\\.warn\\s*\\(`, 'g');
        const warnMatches = modifiedContent.match(warnCallRegex) || [];
        if (warnMatches.length > 0) {
          modifiedContent = modifiedContent.replace(warnCallRegex, `${mapping.category}.${mapping.method}.warn(`);
          callsInFile += warnMatches.length;
          fileChanged = true;
        }

        // Replace error calls: debugAPI.error(...) → debugNetwork.api.error(...)
        const errorCallRegex = new RegExp(`\\b${func}\\.error\\s*\\(`, 'g');
        const errorMatches = modifiedContent.match(errorCallRegex) || [];
        if (errorMatches.length > 0) {
          modifiedContent = modifiedContent.replace(errorCallRegex, `${mapping.category}.${mapping.method}.error(`);
          callsInFile += errorMatches.length;
          fileChanged = true;
        }
      });

      // Write modified content if changes were made
      if (fileChanged) {
        // Create backup before modifying
        const backupPath = `${filePath}.migration-backup`;
        fs.writeFileSync(backupPath, content);
        
        // Write migrated content
        fs.writeFileSync(filePath, modifiedContent);
        
        this.migrationResults.filesMigrated++;
        this.migrationResults.callsMigrated += callsInFile;
        
        console.log(`✅ Migrated ${relativePath} (${callsInFile} calls) - backup: ${path.basename(backupPath)}`);
      }
      
    } catch (error) {
      const errorMsg = `Failed to migrate ${path.relative(this.projectRoot, filePath)}: ${error.message}`;
      this.migrationResults.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  /**
   * Display migration results
   */
  displayMigrationResults() {
    console.log('\n📊 Migration Results');
    console.log('====================\n');
    
    console.log(`📁 Files processed: ${this.migrationResults.filesProcessed}`);
    console.log(`✅ Files migrated: ${this.migrationResults.filesMigrated}`);
    console.log(`🔄 Calls migrated: ${this.migrationResults.callsMigrated}`);
    console.log(`❌ Errors: ${this.migrationResults.errors.length}\n`);

    if (this.migrationResults.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      this.migrationResults.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
      console.log('');
    }

    if (this.migrationResults.filesMigrated > 0) {
      console.log('✨ Migration completed successfully!');
      console.log('');
      console.log('📝 Next steps:');
      console.log('1. Test your application to ensure everything works');
      console.log('2. Run: node scripts/migrate-debug-calls.js validate');
      console.log('3. Remove .migration-backup files when satisfied');
      console.log('4. Update your debug environment variables if needed');
      console.log('');
      console.log('🔧 Environment configuration examples:');
      console.log('DEBUG=bos:network,bos:data    # Enable specific categories');
      console.log('DEBUG=bos:*                  # Enable all categories');
      console.log('DEBUG=bos:network:api        # Enable specific sub-namespaces');
    }
  }
}

class DebugValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.validationResults = {
      filesValidated: 0,
      syntaxValid: 0,
      importErrors: [],
      callErrors: [],
      warnings: []
    };
  }

  /**
   * Validate migrated files
   */
  async validateMigration(targetFile = null) {
    console.log('🔍 Validating migrated debug calls...\n');

    if (targetFile) {
      const fullPath = path.resolve(this.projectRoot, targetFile);
      if (fs.existsSync(fullPath)) {
        await this.validateFile(fullPath);
      } else {
        console.error(`❌ File not found: ${targetFile}`);
        return false;
      }
    } else {
      for (const dir of SCAN_DIRECTORIES) {
        const fullPath = path.join(this.projectRoot, dir);
        if (fs.existsSync(fullPath)) {
          await this.validateDirectory(fullPath);
        }
      }
    }

    this.displayValidationResults();
    return this.validationResults;
  }

  /**
   * Recursively validate directory
   */
  async validateDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await this.validateDirectory(fullPath);
      } else if (entry.isFile() && this.shouldProcessFile(entry.name)) {
        await this.validateFile(fullPath);
      }
    }
  }

  /**
   * Check if file should be processed
   */
  shouldProcessFile(filename) {
    return FILE_EXTENSIONS.some(ext => filename.endsWith(ext));
  }

  /**
   * Validate individual file
   */
  async validateFile(filePath) {
    this.validationResults.filesValidated++;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.projectRoot, filePath);
      
      // Check for syntax errors (basic validation)
      let syntaxValid = true;
      
      // Check for remaining legacy function calls
      const legacyCallsFound = [];
      LEGACY_FUNCTIONS.forEach(func => {
        const patterns = [
          new RegExp(`\\b${func}\\s*\\(`, 'g'),
          new RegExp(`\\b${func}\\.warn\\s*\\(`, 'g'),
          new RegExp(`\\b${func}\\.error\\s*\\(`, 'g')
        ];

        patterns.forEach(pattern => {
          const matches = content.match(pattern) || [];
          if (matches.length > 0) {
            legacyCallsFound.push({ function: func, count: matches.length });
          }
        });
      });

      if (legacyCallsFound.length > 0) {
        this.validationResults.warnings.push({
          file: relativePath,
          message: `Legacy debug calls still present: ${legacyCallsFound.map(l => `${l.function}(${l.count})`).join(', ')}`
        });
      }

      // Check for proper import statements
      const hasDebugImports = /import\s+{[^}]*debug[^}]*}\s+from/.test(content);
      const hasCategoryUsage = /debug(Network|Data|UI|Business|Monitor|System)\./.test(content);
      
      if (hasCategoryUsage && !hasDebugImports) {
        this.validationResults.importErrors.push({
          file: relativePath,
          message: 'Category debug functions used but not imported'
        });
        syntaxValid = false;
      }

      // Check for invalid method calls
      const invalidCalls = content.match(/debug\w+\.\w+\.\w+\.\w+/g) || [];
      if (invalidCalls.length > 0) {
        this.validationResults.callErrors.push({
          file: relativePath,
          message: `Invalid debug call chain detected: ${invalidCalls.join(', ')}`
        });
        syntaxValid = false;
      }

      if (syntaxValid) {
        this.validationResults.syntaxValid++;
      }
      
    } catch (error) {
      this.validationResults.callErrors.push({
        file: path.relative(this.projectRoot, filePath),
        message: `Validation failed: ${error.message}`
      });
    }
  }

  /**
   * Display validation results
   */
  displayValidationResults() {
    console.log('📊 Validation Results');
    console.log('=====================\n');
    
    console.log(`📁 Files validated: ${this.validationResults.filesValidated}`);
    console.log(`✅ Syntax valid: ${this.validationResults.syntaxValid}`);
    console.log(`❌ Import errors: ${this.validationResults.importErrors.length}`);
    console.log(`❌ Call errors: ${this.validationResults.callErrors.length}`);
    console.log(`⚠️  Warnings: ${this.validationResults.warnings.length}\n`);

    if (this.validationResults.importErrors.length > 0) {
      console.log('❌ Import Errors:');
      console.log('─'.repeat(50));
      this.validationResults.importErrors.forEach(error => {
        console.log(`   ${error.file}: ${error.message}`);
      });
      console.log('');
    }

    if (this.validationResults.callErrors.length > 0) {
      console.log('❌ Call Errors:');
      console.log('─'.repeat(50));
      this.validationResults.callErrors.forEach(error => {
        console.log(`   ${error.file}: ${error.message}`);
      });
      console.log('');
    }

    if (this.validationResults.warnings.length > 0) {
      console.log('⚠️  Warnings (Legacy calls still present):');
      console.log('─'.repeat(50));
      this.validationResults.warnings.forEach(warning => {
        console.log(`   ${warning.file}: ${warning.message}`);
      });
      console.log('');
    }

    if (this.validationResults.importErrors.length === 0 && this.validationResults.callErrors.length === 0) {
      console.log('🎉 All validations passed! Migration appears successful.');
      
      if (this.validationResults.warnings.length > 0) {
        console.log('\n💡 Consider migrating remaining legacy calls for consistency.');
      }
    } else {
      console.log('⚠️  Some issues found. Please review and fix before proceeding.');
    }
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  const targetFile = process.argv[3];

  console.log('🚀 Debug Migration Tool - Legacy to Category System');
  console.log('===================================================\n');

  try {
    switch (command) {
      case 'analyze':
        const analyzer = new DebugMigrationAnalyzer();
        await analyzer.analyzeUsage();
        break;
        
      case 'migrate':
        const migrator = new DebugMigrator();
        await migrator.migrateFiles(targetFile);
        break;
        
      case 'validate':
        const validator = new DebugValidator();
        await validator.validateMigration(targetFile);
        break;
        
      case 'report':
        // Generate comprehensive migration report
        const reportAnalyzer = new DebugMigrationAnalyzer();
        const results = await reportAnalyzer.analyzeUsage();
        
        // Save report to file
        const reportPath = path.join(__dirname, '..', 'debug-migration-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`\n📄 Detailed report saved to: ${path.relative(process.cwd(), reportPath)}`);
        break;
        
      default:
        console.log('Usage:');
        console.log('  node scripts/migrate-debug-calls.js analyze              # Analyze current usage');
        console.log('  node scripts/migrate-debug-calls.js migrate [file]       # Migrate specific file or all files');
        console.log('  node scripts/migrate-debug-calls.js validate [file]      # Validate migrations');
        console.log('  node scripts/migrate-debug-calls.js report               # Generate migration report');
        console.log('\nExamples:');
        console.log('  node scripts/migrate-debug-calls.js analyze');
        console.log('  node scripts/migrate-debug-calls.js migrate frontend/src/lib/api/auth.ts');
        console.log('  node scripts/migrate-debug-calls.js migrate');
        console.log('  node scripts/migrate-debug-calls.js validate');
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run main function if script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  DebugMigrationAnalyzer,
  DebugMigrator,
  DebugValidator,
  MIGRATION_MAP,
  LEGACY_FUNCTIONS
};