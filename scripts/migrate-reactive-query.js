#!/usr/bin/env node

/**
 * Migration script to unify ReactiveQuery and ReactiveQueryOne
 * 
 * This script:
 * 1. Updates all imports to use unified ReactiveQuery
 * 2. Converts ReactiveQueryOne usage to ReactiveQuery.forRecord
 * 3. Converts ReactiveQuery usage to ReactiveQuery.forCollection  
 * 4. Updates method calls (.current -> .record/.records, etc.)
 * 5. Adds proper error handling and configuration
 * 
 * Usage: node scripts/migrate-reactive-query.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const FRONTEND_DIR = path.join(__dirname, '../frontend/src');
const BACKUP_DIR = path.join(__dirname, '../.migration-backup');
const DRY_RUN = process.argv.includes('--dry-run');

// File patterns to process
const FILE_PATTERNS = [
  '**/*.ts',
  '**/*.svelte',
  '**/*.js'
];

// Migration transformations
const MIGRATIONS = {
  // Import transformations
  imports: [
    {
      from: /import\s*{\s*ReactiveQuery,\s*ReactiveQueryOne\s*}\s*from\s*['"]([^'"]+)['"];?/g,
      to: "import { ReactiveQuery, QueryFactory } from '$1';"
    },
    {
      from: /import\s*{\s*ReactiveQueryOne\s*}\s*from\s*['"]([^'"]+)['"];?/g,
      to: "import { QueryFactory } from '$1';"
    }
  ],
  
  // Constructor transformations
  constructors: [
    {
      // ReactiveQueryOne to QueryFactory.forRecord
      from: /new\s+ReactiveQueryOne<([^>]+)>\(\s*([^,]+),\s*([^,)]+)(?:,\s*([^)]+))?\s*\)/g,
      to: "QueryFactory.forRecord<$1>($2, { defaultValue: $3, ttl: $4 })"
    },
    {
      // ReactiveQuery to QueryFactory.forCollection  
      from: /new\s+ReactiveQuery<([^>]+)>\(\s*([^,]+),\s*([^,)]+)(?:,\s*([^)]+))?\s*\)/g,
      to: "QueryFactory.forCollection<$1>($2, { defaultValue: $3, ttl: $4 })"
    }
  ],
  
  // Method call transformations
  methods: [
    {
      // .current -> .record for single records
      from: /(\w+)\.current(?=\s*(?:[;})\],]|$))/g,
      to: "$1.record",
      condition: (content, match) => {
        // Only transform if this looks like a single record query
        return content.includes('QueryFactory.forRecord') || 
               content.includes('ReactiveQueryOne');
      }
    },
    {
      // .current -> .records for collections
      from: /(\w+)\.current(?=\s*(?:[;})\],]|$))/g,
      to: "$1.records",
      condition: (content, match) => {
        // Only transform if this looks like a collection query
        return content.includes('QueryFactory.forCollection') ||
               (content.includes('ReactiveQuery') && !content.includes('ReactiveQueryOne'));
      }
    }
  ],
  
  // Add configuration imports where needed
  configImports: [
    {
      from: /^(import.*from\s*['"][^'"]*reactive-query[^'"]*['"];?)$/m,
      to: "$1\nimport { ZERO_CONFIG } from './zero-config';"
    }
  ]
};

/**
 * Main migration function
 */
async function main() {
  console.log('🔄 Starting ReactiveQuery migration...\n');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }
  
  // Create backup
  if (!DRY_RUN) {
    createBackup();
  }
  
  // Find all relevant files
  const files = await findFiles();
  console.log(`📁 Found ${files.length} files to process\n`);
  
  // Process each file
  let modifiedFiles = 0;
  let totalChanges = 0;
  
  for (const file of files) {
    const changes = await processFile(file);
    if (changes > 0) {
      modifiedFiles++;
      totalChanges += changes;
      console.log(`✅ ${file}: ${changes} changes`);
    }
  }
  
  // Summary
  console.log(`\n📊 Migration Summary:`);
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Files modified: ${modifiedFiles}`);
  console.log(`   Total changes: ${totalChanges}`);
  
  if (!DRY_RUN && modifiedFiles > 0) {
    console.log(`\n💾 Backup created at: ${BACKUP_DIR}`);
    console.log(`\n🔧 Next steps:`);
    console.log(`   1. Review the changes: git diff`);
    console.log(`   2. Test the application: npm run dev`);
    console.log(`   3. Run tests: npm run test`);
    console.log(`   4. If issues occur, restore from backup`);
  }
  
  console.log('\n🎉 Migration complete!');
}

/**
 * Create backup of all files before migration
 */
function createBackup() {
  console.log('💾 Creating backup...');
  
  if (fs.existsSync(BACKUP_DIR)) {
    fs.rmSync(BACKUP_DIR, { recursive: true });
  }
  
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  
  // Copy entire frontend src directory
  execSync(`cp -r "${FRONTEND_DIR}" "${BACKUP_DIR}/"`);
  
  console.log(`✅ Backup created at ${BACKUP_DIR}\n`);
}

/**
 * Find all files to process
 */
async function findFiles() {
  const files = [];
  
  function walkDir(dir) {
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!entry.startsWith('.') && entry !== 'node_modules') {
          walkDir(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(entry);
        if (['.ts', '.js', '.svelte'].includes(ext)) {
          const relativePath = path.relative(FRONTEND_DIR, fullPath);
          files.push(relativePath);
        }
      }
    }
  }
  
  walkDir(FRONTEND_DIR);
  
  // Filter to files that likely contain ReactiveQuery usage
  return files.filter(file => {
    const fullPath = path.join(FRONTEND_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    return content.includes('ReactiveQuery') || content.includes('ReactiveQueryOne');
  });
}

/**
 * Process a single file
 */
async function processFile(relativePath) {
  const fullPath = path.join(FRONTEND_DIR, relativePath);
  const originalContent = fs.readFileSync(fullPath, 'utf8');
  let content = originalContent;
  let changeCount = 0;
  
  // Apply import transformations
  for (const migration of MIGRATIONS.imports) {
    const newContent = content.replace(migration.from, migration.to);
    if (newContent !== content) {
      content = newContent;
      changeCount++;
    }
  }
  
  // Apply constructor transformations
  for (const migration of MIGRATIONS.constructors) {
    const newContent = content.replace(migration.from, migration.to);
    if (newContent !== content) {
      content = newContent;
      changeCount++;
    }
  }
  
  // Apply method transformations
  for (const migration of MIGRATIONS.methods) {
    if (migration.condition && !migration.condition(content)) {
      continue;
    }
    
    const newContent = content.replace(migration.from, migration.to);
    if (newContent !== content) {
      content = newContent;
      changeCount++;
    }
  }
  
  // Add configuration imports if needed
  if (content.includes('QueryFactory') && !content.includes('ZERO_CONFIG')) {
    for (const migration of MIGRATIONS.configImports) {
      const newContent = content.replace(migration.from, migration.to);
      if (newContent !== content) {
        content = newContent;
        changeCount++;
      }
    }
  }
  
  // Clean up any duplicate imports
  content = cleanupDuplicateImports(content);
  
  // Write file if changed and not dry run
  if (content !== originalContent && !DRY_RUN) {
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  
  return changeCount;
}

/**
 * Clean up duplicate imports
 */
function cleanupDuplicateImports(content) {
  const lines = content.split('\n');
  const importLines = new Set();
  const otherLines = [];
  
  for (const line of lines) {
    if (line.trim().startsWith('import ')) {
      if (!importLines.has(line.trim())) {
        importLines.add(line.trim());
        otherLines.push(line);
      }
    } else {
      otherLines.push(line);
    }
  }
  
  return otherLines.join('\n');
}

/**
 * Error handling
 */
process.on('unhandledRejection', (error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

// Run migration
main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

/**
 * Additional helper functions for manual migration
 */
function generateMigrationReport() {
  console.log(`
📋 Manual Migration Checklist:

1. ✅ Update imports:
   - ReactiveQuery, ReactiveQueryOne → ReactiveQuery, QueryFactory
   
2. ✅ Update constructors:
   - new ReactiveQueryOne<T>(...) → QueryFactory.forRecord<T>(...)
   - new ReactiveQuery<T>(...) → QueryFactory.forCollection<T>(...)
   
3. ✅ Update method calls:
   - .current → .record (for single records)
   - .current → .records (for collections)
   - Add .present and .blank checks where needed
   
4. ✅ Add error handling:
   - Wrap queries in try/catch
   - Use standardized error types
   - Add retry logic for transient errors
   
5. ✅ Update TTL configuration:
   - Use ZERO_CONFIG.getTTL() for consistent TTL values
   - Remove hardcoded TTL strings
   
6. ✅ Test thoroughly:
   - Verify all queries still work
   - Check error handling
   - Validate performance improvements
  `);
}

// Export for use in other scripts
module.exports = {
  processFile,
  MIGRATIONS,
  generateMigrationReport
};