#!/usr/bin/env node

/**
 * Debug Migration Tool - Main Entry Point
 * 
 * This is a simple wrapper script that provides easy access to all debug migration tools.
 * It helps developers migrate from the legacy 19-namespace debug system to the new
 * 6-category system with guided workflows and safety checks.
 * 
 * Usage:
 *   node scripts/debug-migrate.js                    # Interactive menu
 *   node scripts/debug-migrate.js analyze            # Quick analysis
 *   node scripts/debug-migrate.js migrate            # Safe migration
 *   node scripts/debug-migrate.js validate           # Validation
 *   node scripts/debug-migrate.js help               # Show help
 */

const { execSync } = require('child_process');
const path = require('path');

class DebugMigrationTool {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
  }

  /**
   * Display interactive menu
   */
  async showInteractiveMenu() {
    console.log('🚀 Debug System Migration Tool');
    console.log('==============================\n');
    
    console.log('This tool helps you migrate from the legacy 19-namespace debug system');
    console.log('to the new 6-category system. Choose an option:\n');
    
    console.log('1. 🔍 Analyze current debug usage');
    console.log('2. 📊 Comprehensive analysis with migration plan');
    console.log('3. 🔄 Migrate debug calls (recommended)');
    console.log('4. ✅ Validate migrated code');
    console.log('5. 📖 View documentation and examples');
    console.log('6. 🛠️  Advanced options');
    console.log('7. ❓ Help and troubleshooting\n');
    
    // In a real interactive tool, you'd use a package like 'inquirer'
    // For now, show the commands they can run
    console.log('💡 Quick commands:');
    console.log('   node scripts/debug-migrate.js analyze     # Option 1');
    console.log('   node scripts/debug-migrate.js comprehensive # Option 2');
    console.log('   node scripts/debug-migrate.js migrate     # Option 3');
    console.log('   node scripts/debug-migrate.js validate    # Option 4');
    console.log('   node scripts/debug-migrate.js examples    # Option 5');
    console.log('   node scripts/debug-migrate.js advanced    # Option 6');
    console.log('   node scripts/debug-migrate.js help        # Option 7\n');
  }

  /**
   * Run basic analysis
   */
  async runAnalysis() {
    console.log('🔍 Running basic debug usage analysis...\n');
    
    try {
      execSync('node scripts/migrate-debug-calls.js analyze', { 
        stdio: 'inherit',
        cwd: this.projectRoot
      });
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run comprehensive analysis
   */
  async runComprehensiveAnalysis() {
    console.log('📊 Running comprehensive migration analysis...\n');
    
    try {
      execSync('node scripts/debug-migration-analyzer.js', { 
        stdio: 'inherit',
        cwd: this.projectRoot
      });
    } catch (error) {
      console.error('❌ Comprehensive analysis failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run guided migration
   */
  async runGuidedMigration() {
    console.log('🔄 Starting guided debug migration...\n');
    
    console.log('⚠️  IMPORTANT: This will modify your source files!');
    console.log('   • Backup files will be created (.migration-backup)');
    console.log('   • You can restore files if needed');
    console.log('   • Test thoroughly after migration\n');
    
    // Step 1: Analysis
    console.log('Step 1: Analyzing current usage...');
    try {
      execSync('node scripts/migrate-debug-calls.js analyze', { 
        stdio: 'inherit',
        cwd: this.projectRoot
      });
    } catch (error) {
      console.error('❌ Pre-migration analysis failed:', error.message);
      return;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📋 Ready to proceed with migration?');
    console.log('   Run: node scripts/migrate-debug-calls.js migrate');
    console.log('   Or migrate specific files first for testing');
    console.log('='.repeat(50) + '\n');
  }

  /**
   * Run validation
   */
  async runValidation() {
    console.log('✅ Running migration validation...\n');
    
    try {
      execSync('node scripts/debug-migration-validator.js', { 
        stdio: 'inherit',
        cwd: this.projectRoot
      });
    } catch (error) {
      console.error('⚠️  Validation completed with issues. See output above.');
      process.exit(1);
    }
  }

  /**
   * Show examples and documentation
   */
  async showExamples() {
    console.log('📖 Debug Migration Examples and Documentation\n');
    
    console.log('📄 Documentation files:');
    console.log('   • scripts/debug-migration-examples.md - Comprehensive guide');
    console.log('   • scripts/eslint-debug-migration-rule.js - ESLint integration\n');
    
    console.log('🎯 Quick Examples:\n');
    
    console.log('Before (Legacy):');
    console.log('  import { debugAPI, debugAuth, debugDatabase } from "$lib/utils/debug";');
    console.log('  debugAPI("Request started", { url });');
    console.log('  debugAuth.warn("Token expiring", { expiresIn });');
    console.log('  debugDatabase("Query executed", { sql, duration });\n');
    
    console.log('After (Category):');
    console.log('  import { debugNetwork, debugData } from "$lib/utils/debug";');
    console.log('  debugNetwork.api("Request started", { url });');
    console.log('  debugNetwork.auth.warn("Token expiring", { expiresIn });');
    console.log('  debugData.database("Query executed", { sql, duration });\n');
    
    console.log('🔧 Environment Configuration:');
    console.log('  DEBUG=bos:*                  # Enable all debugging');
    console.log('  DEBUG=bos:network,bos:data   # Enable specific categories');
    console.log('  DEBUG=bos:network:api        # Enable specific sub-namespaces\n');
  }

  /**
   * Show advanced options
   */
  async showAdvancedOptions() {
    console.log('🛠️  Advanced Migration Options\n');
    
    console.log('Individual Tools:');
    console.log('  node scripts/migrate-debug-calls.js [command]');
    console.log('    Commands: analyze, migrate, validate, report\n');
    
    console.log('  node scripts/debug-migration-analyzer.js');
    console.log('    Comprehensive analysis and migration planning\n');
    
    console.log('  node scripts/debug-migration-validator.js [file]');
    console.log('    Detailed validation of migrated code\n');
    
    console.log('ESLint Integration:');
    console.log('  Add scripts/eslint-debug-migration-rule.js to your ESLint config');
    console.log('  Provides automatic migration suggestions in your IDE\n');
    
    console.log('File-Specific Migration:');
    console.log('  node scripts/migrate-debug-calls.js migrate path/to/file.ts');
    console.log('  node scripts/debug-migration-validator.js path/to/file.ts\n');
    
    console.log('Generated Reports:');
    console.log('  debug-migration-analysis-report.json - Detailed analysis');
    console.log('  debug-migration-priority.csv - File priority ranking\n');
  }

  /**
   * Show help and troubleshooting
   */
  async showHelp() {
    console.log('❓ Help and Troubleshooting\n');
    
    console.log('🚨 Common Issues:\n');
    
    console.log('1. "Import not found" errors:');
    console.log('   • Make sure imports are from "$lib/utils/debug"');
    console.log('   • Check that category names are correct (debugNetwork, debugData, etc.)\n');
    
    console.log('2. "Method not found" errors:');
    console.log('   • Verify method names match the mapping:');
    console.log('     debugAPI → debugNetwork.api()');
    console.log('     debugDatabase → debugData.database()');
    console.log('     debugComponent → debugUI.component()\n');
    
    console.log('3. Debug output not appearing:');
    console.log('   • Check DEBUG environment variable: echo $DEBUG');
    console.log('   • Set DEBUG=bos:* to enable all debugging');
    console.log('   • In browser: localStorage.debug = "bos:*"\n');
    
    console.log('4. Migration fails:');
    console.log('   • Check file permissions');
    console.log('   • Ensure no syntax errors before migration');
    console.log('   • Restore from .migration-backup files if needed\n');
    
    console.log('🔧 Recovery Commands:');
    console.log('  # Restore all backup files');
    console.log('  find . -name "*.migration-backup" -exec bash -c \'mv "$1" "${1%.migration-backup}"\' _ {} \\;');
    console.log('');
    console.log('  # Remove all backup files (when satisfied)');
    console.log('  find . -name "*.migration-backup" -delete\n');
    
    console.log('📞 Getting More Help:');
    console.log('  • Read: scripts/debug-migration-examples.md');
    console.log('  • Run validation: node scripts/debug-migration-validator.js');
    console.log('  • Check the generated analysis reports\n');
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  const tool = new DebugMigrationTool();

  try {
    switch (command) {
      case 'analyze':
        await tool.runAnalysis();
        break;
        
      case 'comprehensive':
        await tool.runComprehensiveAnalysis();
        break;
        
      case 'migrate':
        await tool.runGuidedMigration();
        break;
        
      case 'validate':
        await tool.runValidation();
        break;
        
      case 'examples':
        await tool.showExamples();
        break;
        
      case 'advanced':
        await tool.showAdvancedOptions();
        break;
        
      case 'help':
        await tool.showHelp();
        break;
        
      default:
        await tool.showInteractiveMenu();
        break;
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

module.exports = { DebugMigrationTool };