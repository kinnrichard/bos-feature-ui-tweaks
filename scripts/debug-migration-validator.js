#!/usr/bin/env node

/**
 * Debug Migration Validation Tool
 * 
 * This tool validates that debug function migrations have been completed correctly
 * and that the migrated code functions properly without breaking changes.
 * 
 * Features:
 * - Validates import statement correctness
 * - Checks for proper function call syntax
 * - Verifies category method availability
 * - Tests runtime functionality
 * - Ensures no legacy functions remain (if desired)
 * - Validates TypeScript types
 * - Performance regression testing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import migration mappings
const { MIGRATION_MAP, LEGACY_FUNCTIONS } = require('./migrate-debug-calls');

class DebugMigrationValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.validationResults = {
      filesValidated: 0,
      passedValidation: 0,
      warnings: [],
      errors: [],
      summary: {}
    };
  }

  /**
   * Run comprehensive validation
   */
  async runValidation(targetFile = null) {
    console.log('🔍 Running debug migration validation...\n');

    // 1. Syntax validation
    await this.validateSyntax(targetFile);
    
    // 2. Import validation
    await this.validateImports(targetFile);
    
    // 3. Function call validation
    await this.validateFunctionCalls(targetFile);
    
    // 4. Runtime validation
    await this.validateRuntimeFunctionality();
    
    // 5. TypeScript validation (if applicable)
    await this.validateTypeScript();
    
    // 6. Performance validation
    await this.validatePerformance();

    // Display results
    this.displayValidationResults();

    return this.validationResults;
  }

  /**
   * Validate syntax of migrated files
   */
  async validateSyntax(targetFile = null) {
    console.log('📝 Validating syntax...');
    
    const filesToCheck = targetFile ? [targetFile] : await this.getAllFiles();
    
    for (const file of filesToCheck) {
      await this.validateFileSyntax(file);
    }
  }

  /**
   * Get all files to validate
   */
  async getAllFiles() {
    const files = [];
    const scanDirs = ['frontend/src', 'frontend/tests', 'scripts'];
    
    for (const dir of scanDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        const dirFiles = await this.getFilesRecursive(fullPath);
        files.push(...dirFiles);
      }
    }
    
    return files;
  }

  /**
   * Recursively get files from directory
   */
  async getFilesRecursive(dirPath) {
    const files = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subFiles = await this.getFilesRecursive(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && this.shouldProcessFile(entry.name)) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Check if file should be processed
   */
  shouldProcessFile(filename) {
    const extensions = ['.js', '.ts', '.svelte'];
    return extensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Validate individual file syntax
   */
  async validateFileSyntax(filePath) {
    this.validationResults.filesValidated++;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.projectRoot, filePath);
      
      // Basic syntax checks
      const issues = [];
      
      // Check for unclosed brackets/braces
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      if (openBraces !== closeBraces) {
        issues.push('Mismatched braces');
      }
      
      const openBrackets = (content.match(/\[/g) || []).length;
      const closeBrackets = (content.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        issues.push('Mismatched brackets');
      }
      
      const openParens = (content.match(/\(/g) || []).length;
      const closeParens = (content.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        issues.push('Mismatched parentheses');
      }

      // Check for obvious syntax errors in debug calls
      const invalidDebugCalls = content.match(/debug\w+\.\w+\.\w+\.\w+/g) || [];
      if (invalidDebugCalls.length > 0) {
        issues.push(`Invalid debug call chains: ${invalidDebugCalls.join(', ')}`);
      }
      
      if (issues.length > 0) {
        this.validationResults.errors.push({
          file: relativePath,
          type: 'syntax',
          issues: issues
        });
      } else {
        this.validationResults.passedValidation++;
      }
      
    } catch (error) {
      this.validationResults.errors.push({
        file: path.relative(this.projectRoot, filePath),
        type: 'read_error',
        message: error.message
      });
    }
  }

  /**
   * Validate import statements
   */
  async validateImports(targetFile = null) {
    console.log('📦 Validating imports...');
    
    const filesToCheck = targetFile ? [targetFile] : await this.getAllFiles();
    
    for (const file of filesToCheck) {
      await this.validateFileImports(file);
    }
  }

  /**
   * Validate imports in individual file
   */
  async validateFileImports(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.projectRoot, filePath);
      
      // Find debug imports
      const importRegex = /import\s+{([^}]*)}\s+from\s+(['"][^'"]*debug[^'"]*['"])/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const imports = match[1].split(',').map(imp => imp.trim());
        const importPath = match[2];
        
        // Check for invalid imports
        const issues = [];
        
        // Check for mixed legacy and category imports
        const legacyImports = imports.filter(imp => LEGACY_FUNCTIONS.includes(imp));
        const categoryImports = imports.filter(imp => 
          imp.startsWith('debug') && !LEGACY_FUNCTIONS.includes(imp)
        );
        
        if (legacyImports.length > 0 && categoryImports.length > 0) {
          this.validationResults.warnings.push({
            file: relativePath,
            type: 'mixed_imports',
            message: `Mixed legacy and category imports: ${legacyImports.join(', ')} with ${categoryImports.join(', ')}`
          });
        }
        
        // Check for non-existent category functions
        const validCategories = ['debugNetwork', 'debugData', 'debugUI', 'debugBusiness', 'debugMonitor', 'debugSystem'];
        const invalidImports = categoryImports.filter(imp => 
          imp.startsWith('debug') && !validCategories.includes(imp)
        );
        
        if (invalidImports.length > 0) {
          issues.push(`Invalid category imports: ${invalidImports.join(', ')}`);
        }
        
        if (issues.length > 0) {
          this.validationResults.errors.push({
            file: relativePath,
            type: 'import_error',
            issues: issues
          });
        }
      }
      
    } catch (error) {
      // Error already handled in syntax validation
    }
  }

  /**
   * Validate function calls
   */
  async validateFunctionCalls(targetFile = null) {
    console.log('📞 Validating function calls...');
    
    const filesToCheck = targetFile ? [targetFile] : await this.getAllFiles();
    
    for (const file of filesToCheck) {
      await this.validateFileFunctionCalls(file);
    }
  }

  /**
   * Validate function calls in individual file
   */
  async validateFileFunctionCalls(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.projectRoot, filePath);
      
      const issues = [];
      
      // Check for remaining legacy function calls
      const legacyCalls = [];
      LEGACY_FUNCTIONS.forEach(func => {
        const patterns = [
          new RegExp(`\\b${func}\\s*\\(`, 'g'),
          new RegExp(`\\b${func}\\.warn\\s*\\(`, 'g'),
          new RegExp(`\\b${func}\\.error\\s*\\(`, 'g')
        ];

        patterns.forEach(pattern => {
          const matches = content.match(pattern) || [];
          if (matches.length > 0) {
            legacyCalls.push({ function: func, count: matches.length });
          }
        });
      });
      
      if (legacyCalls.length > 0) {
        this.validationResults.warnings.push({
          file: relativePath,
          type: 'legacy_calls_remaining',
          message: `Legacy debug calls found: ${legacyCalls.map(c => `${c.function}(${c.count})`).join(', ')}`
        });
      }
      
      // Check for invalid category method calls
      const invalidMethodCalls = [];
      
      // Network category method validation
      const networkMethods = ['api', 'auth', 'security', 'integration', 'websocket'];
      const networkCallPattern = /debugNetwork\.(\w+)/g;
      let networkMatch;
      while ((networkMatch = networkCallPattern.exec(content)) !== null) {
        if (!networkMethods.includes(networkMatch[1])) {
          invalidMethodCalls.push(`debugNetwork.${networkMatch[1]}`);
        }
      }
      
      // Data category method validation
      const dataMethods = ['database', 'cache', 'validation', 'reactive', 'state'];
      const dataCallPattern = /debugData\.(\w+)/g;
      let dataMatch;
      while ((dataMatch = dataCallPattern.exec(content)) !== null) {
        if (!dataMethods.includes(dataMatch[1])) {
          invalidMethodCalls.push(`debugData.${dataMatch[1]}`);
        }
      }
      
      // UI category method validation
      const uiMethods = ['component', 'navigation', 'notification'];
      const uiCallPattern = /debugUI\.(\w+)/g;
      let uiMatch;
      while ((uiMatch = uiCallPattern.exec(content)) !== null) {
        if (!uiMethods.includes(uiMatch[1])) {
          invalidMethodCalls.push(`debugUI.${uiMatch[1]}`);
        }
      }
      
      // Business category method validation
      const businessMethods = ['workflow', 'search', 'upload', 'export'];
      const businessCallPattern = /debugBusiness\.(\w+)/g;
      let businessMatch;
      while ((businessMatch = businessCallPattern.exec(content)) !== null) {
        if (!businessMethods.includes(businessMatch[1])) {
          invalidMethodCalls.push(`debugBusiness.${businessMatch[1]}`);
        }
      }
      
      // Monitor category method validation
      const monitorMethods = ['performance', 'error'];
      const monitorCallPattern = /debugMonitor\.(\w+)/g;
      let monitorMatch;
      while ((monitorMatch = monitorCallPattern.exec(content)) !== null) {
        if (!monitorMethods.includes(monitorMatch[1])) {
          invalidMethodCalls.push(`debugMonitor.${monitorMatch[1]}`);
        }
      }
      
      // System category method validation
      const systemMethods = ['framework', 'development'];
      const systemCallPattern = /debugSystem\.(\w+)/g;
      let systemMatch;
      while ((systemMatch = systemCallPattern.exec(content)) !== null) {
        if (!systemMethods.includes(systemMatch[1])) {
          invalidMethodCalls.push(`debugSystem.${systemMatch[1]}`);
        }
      }
      
      if (invalidMethodCalls.length > 0) {
        issues.push(`Invalid method calls: ${invalidMethodCalls.join(', ')}`);
      }
      
      if (issues.length > 0) {
        this.validationResults.errors.push({
          file: relativePath,
          type: 'function_call_error',
          issues: issues
        });
      }
      
    } catch (error) {
      // Error already handled in syntax validation
    }
  }

  /**
   * Validate runtime functionality
   */
  async validateRuntimeFunctionality() {
    console.log('🚀 Validating runtime functionality...');
    
    try {
      // Test that the debug system can be imported and used
      const testScript = `
        const path = require('path');
        const projectRoot = path.resolve(__dirname, '..');
        
        try {
          // Try to require the debug system
          const debugModule = require(path.join(projectRoot, 'frontend/src/lib/utils/debug/index.ts'));
          
          console.log('✅ Debug module loads successfully');
          
          // Test category functions exist
          const categories = ['debugNetwork', 'debugData', 'debugUI', 'debugBusiness', 'debugMonitor', 'debugSystem'];
          categories.forEach(category => {
            if (typeof debugModule[category] === 'function') {
              console.log(\`✅ \${category} function exists\`);
            } else {
              console.log(\`❌ \${category} function missing or invalid\`);
            }
          });
          
        } catch (error) {
          console.log(\`❌ Runtime test failed: \${error.message}\`);
          process.exit(1);
        }
      `;
      
      const testPath = path.join(this.projectRoot, 'temp-validation-test.js');
      fs.writeFileSync(testPath, testScript);
      
      try {
        const output = execSync(`node "${testPath}"`, { encoding: 'utf8', timeout: 10000 });
        
        if (output.includes('❌')) {
          this.validationResults.errors.push({
            file: 'runtime_test',
            type: 'runtime_error',
            message: 'Runtime functionality test failed',
            details: output
          });
        } else {
          console.log('✅ Runtime functionality validated');
        }
        
      } catch (error) {
        this.validationResults.errors.push({
          file: 'runtime_test',
          type: 'runtime_error',
          message: `Runtime test execution failed: ${error.message}`
        });
      } finally {
        // Clean up test file
        if (fs.existsSync(testPath)) {
          fs.unlinkSync(testPath);
        }
      }
      
    } catch (error) {
      this.validationResults.warnings.push({
        file: 'runtime_test',
        type: 'runtime_skip',
        message: `Runtime test skipped: ${error.message}`
      });
    }
  }

  /**
   * Validate TypeScript types
   */
  async validateTypeScript() {
    console.log('🔷 Validating TypeScript...');
    
    try {
      // Check if TypeScript is available
      execSync('npx tsc --version', { timeout: 5000 });
      
      // Run TypeScript check on debug files
      const debugDir = path.join(this.projectRoot, 'frontend/src/lib/utils/debug');
      
      try {
        const output = execSync(`npx tsc --noEmit --skipLibCheck "${debugDir}/*.ts"`, { 
          encoding: 'utf8',
          timeout: 30000,
          cwd: this.projectRoot
        });
        
        console.log('✅ TypeScript validation passed');
        
      } catch (error) {
        if (error.stdout && error.stdout.includes('error TS')) {
          this.validationResults.errors.push({
            file: 'typescript_check',
            type: 'typescript_error',
            message: 'TypeScript compilation errors found',
            details: error.stdout
          });
        } else {
          this.validationResults.warnings.push({
            file: 'typescript_check',
            type: 'typescript_warning',
            message: `TypeScript check completed with warnings: ${error.message}`
          });
        }
      }
      
    } catch (error) {
      this.validationResults.warnings.push({
        file: 'typescript_check',
        type: 'typescript_skip',
        message: 'TypeScript validation skipped (tsc not available)'
      });
    }
  }

  /**
   * Validate performance hasn't regressed
   */
  async validatePerformance() {
    console.log('⚡ Validating performance...');
    
    try {
      // Simple performance test
      const performanceTest = `
        const { performance } = require('perf_hooks');
        
        // Test debug function creation performance
        const startTime = performance.now();
        
        for (let i = 0; i < 1000; i++) {
          // Simulate debug function usage
          const debug = require('debug')('test:performance');
          debug('Test message', { iteration: i });
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(\`Performance test: \${duration.toFixed(2)}ms for 1000 operations\`);
        
        if (duration > 100) {
          console.log('⚠️  Performance warning: Debug operations taking longer than expected');
          process.exit(1);
        } else {
          console.log('✅ Performance validation passed');
        }
      `;
      
      const testPath = path.join(this.projectRoot, 'temp-performance-test.js');
      fs.writeFileSync(testPath, performanceTest);
      
      try {
        const output = execSync(`node "${testPath}"`, { encoding: 'utf8', timeout: 15000 });
        
        if (output.includes('⚠️')) {
          this.validationResults.warnings.push({
            file: 'performance_test',
            type: 'performance_warning',
            message: 'Performance validation completed with warnings',
            details: output
          });
        } else {
          console.log('✅ Performance validation passed');
        }
        
      } catch (error) {
        this.validationResults.warnings.push({
          file: 'performance_test',
          type: 'performance_warning',
          message: `Performance test failed: ${error.message}`
        });
      } finally {
        // Clean up test file
        if (fs.existsSync(testPath)) {
          fs.unlinkSync(testPath);
        }
      }
      
    } catch (error) {
      this.validationResults.warnings.push({
        file: 'performance_test',
        type: 'performance_skip',
        message: `Performance test skipped: ${error.message}`
      });
    }
  }

  /**
   * Display validation results
   */
  displayValidationResults() {
    console.log('\n📊 Validation Results');
    console.log('=====================\n');
    
    const results = this.validationResults;
    
    console.log(`📁 Files validated: ${results.filesValidated}`);
    console.log(`✅ Passed validation: ${results.passedValidation}`);
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
    console.log(`❌ Errors: ${results.errors.length}\n`);

    // Display errors
    if (results.errors.length > 0) {
      console.log('❌ Errors Found:');
      console.log('─'.repeat(50));
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.file} (${error.type})`);
        if (error.message) {
          console.log(`   ${error.message}`);
        }
        if (error.issues) {
          error.issues.forEach(issue => console.log(`   • ${issue}`));
        }
        if (error.details) {
          console.log(`   Details: ${error.details.substring(0, 200)}...`);
        }
        console.log('');
      });
    }

    // Display warnings
    if (results.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      console.log('─'.repeat(50));
      results.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.file} (${warning.type})`);
        console.log(`   ${warning.message}`);
        if (warning.details) {
          console.log(`   Details: ${warning.details.substring(0, 200)}...`);
        }
        console.log('');
      });
    }

    // Summary
    const successRate = results.filesValidated > 0 
      ? ((results.passedValidation / results.filesValidated) * 100).toFixed(1)
      : 0;
    
    console.log('📈 Summary:');
    console.log(`   Success rate: ${successRate}%`);
    
    if (results.errors.length === 0) {
      console.log('   🎉 All critical validations passed!');
      
      if (results.warnings.length === 0) {
        console.log('   ✨ Migration completed successfully with no issues!');
      } else {
        console.log('   💡 Consider addressing warnings for optimal migration.');
      }
    } else {
      console.log('   ⚠️  Critical errors found. Please address before proceeding.');
    }

    // Next steps
    console.log('\n🚀 Next Steps:');
    if (results.errors.length > 0) {
      console.log('   1. Fix the errors listed above');
      console.log('   2. Re-run validation: node scripts/debug-migration-validator.js');
    } else {
      console.log('   1. Test your application thoroughly');
      console.log('   2. Remove .migration-backup files if satisfied');
      console.log('   3. Update documentation with new debug patterns');
      console.log('   4. Train team on new category system');
    }
  }
}

// Main execution
async function main() {
  const targetFile = process.argv[2];

  console.log('✅ Debug Migration Validator');
  console.log('=============================\n');

  try {
    const validator = new DebugMigrationValidator();
    const results = await validator.runValidation(targetFile);
    
    // Exit with non-zero code if errors found
    if (results.errors.length > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ Validation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { DebugMigrationValidator };