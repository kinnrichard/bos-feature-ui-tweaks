# Debug System Migration Tools

This directory contains automated tools to help migrate from the legacy 19-namespace debug system to the new 6-category debug system.

## Quick Start

```bash
# Interactive migration tool (recommended)
node scripts/debug-migrate.js

# Quick analysis of current debug usage
node scripts/debug-migrate.js analyze

# Migrate all debug calls
node scripts/migrate-debug-calls.js migrate

# Validate migration results
node scripts/debug-migration-validator.js
```

## 📁 Tool Overview

### 1. `debug-migrate.js` - Main Entry Point
**🚀 Interactive wrapper for all migration tools**

Simple interface that guides you through the entire migration process:
- Analysis of current usage
- Guided migration with safety checks
- Validation of results
- Help and documentation

```bash
node scripts/debug-migrate.js [command]
# Commands: analyze, comprehensive, migrate, validate, examples, advanced, help
```

### 2. `migrate-debug-calls.js` - Core Migration Tool
**🔄 Primary tool for analyzing and migrating debug calls**

Features:
- Analyzes debug function usage across codebase (~50+ calls identified)
- Automatically converts legacy functions to category system
- Maps 19 legacy functions to 6 categories with sub-namespaces
- Creates backup files for safety
- Provides detailed migration reports

```bash
node scripts/migrate-debug-calls.js analyze              # Analyze current usage
node scripts/migrate-debug-calls.js migrate [file]       # Migrate specific file or all files
node scripts/migrate-debug-calls.js validate [file]      # Validate migrations
node scripts/migrate-debug-calls.js report               # Generate migration report
```

### 3. `debug-migration-analyzer.js` - Advanced Analysis
**📊 Comprehensive analysis and migration planning**

Provides detailed insights for strategic migration planning:
- Migration complexity assessment (currently: HIGH complexity)
- File priority ranking (53 files with debug calls)
- Migration timeline estimation (27 days estimated)
- Category breakdown analysis
- Risk assessment and mitigation strategies

```bash
node scripts/debug-migration-analyzer.js
```

**Outputs:**
- `debug-migration-analysis-report.json` - Detailed analysis
- `debug-migration-priority.csv` - File priority ranking

### 4. `debug-migration-validator.js` - Validation Tool
**✅ Comprehensive validation of migrated code**

Validates migration correctness:
- Syntax validation (bracket matching, etc.)
- Import statement correctness
- Function call validation (proper method names)
- Runtime functionality testing
- TypeScript type checking
- Performance regression testing

```bash
node scripts/debug-migration-validator.js [file]
```

### 5. `eslint-debug-migration-rule.js` - ESLint Integration
**🔧 Custom ESLint rule for automated migration suggestions**

Provides IDE integration for migration assistance:
- Detects legacy debug function usage
- Provides migration suggestions
- Offers automatic fixes via ESLint `--fix`
- Supports .warn() and .error() method variants

### 6. `debug-migration-examples.md` - Documentation
**📖 Comprehensive migration guide and examples**

Complete documentation including:
- Before/after code examples
- Step-by-step migration process
- Environment configuration
- Troubleshooting guide
- Best practices

## 🎯 Migration Mapping

The tools automatically handle these conversions:

| Legacy Function | New Category Method | Category |
|-----------------|-------------------|----------|
| `debugAPI` | `debugNetwork.api()` | Network |
| `debugAuth` | `debugNetwork.auth()` | Network |
| `debugSecurity` | `debugNetwork.security()` | Network |
| `debugIntegration` | `debugNetwork.integration()` | Network |
| `debugWebSocket` | `debugNetwork.websocket()` | Network |
| `debugDatabase` | `debugData.database()` | Data |
| `debugCache` | `debugData.cache()` | Data |
| `debugValidation` | `debugData.validation()` | Data |
| `debugReactive` | `debugData.reactive()` | Data |
| `debugState` | `debugData.state()` | Data |
| `debugComponent` | `debugUI.component()` | UI |
| `debugNavigation` | `debugUI.navigation()` | UI |
| `debugNotification` | `debugUI.notification()` | UI |
| `debugWorkflow` | `debugBusiness.workflow()` | Business |
| `debugSearch` | `debugBusiness.search()` | Business |
| `debugUpload` | `debugBusiness.upload()` | Business |
| `debugExport` | `debugBusiness.export()` | Business |
| `debugPerformance` | `debugMonitor.performance()` | Monitor |
| `debugError` | `debugMonitor.error()` | Monitor |

## 📊 Current Project Status

Based on analysis of the BOS project:

- **Files scanned:** 317
- **Files with debug calls:** 53  
- **Total debug calls:** 362
- **Migration complexity:** HIGH
- **Estimated duration:** 27 days (gradual migration recommended)

### Top Categories by Usage:
1. **Network:** 119 calls across 23 files (debugAPI, debugAuth, debugSecurity, etc.)
2. **Data:** 118 calls across 22 files (debugDatabase, debugReactive, debugValidation, etc.)
3. **UI:** 64 calls across 20 files (debugComponent, debugNavigation, etc.)
4. **Business:** 35 calls across 10 files (debugWorkflow, debugSearch, etc.)
5. **Monitor:** 26 calls across 9 files (debugError, debugPerformance)

### Priority Files for Migration:
1. `frontend/tests/e2e/smoke.e2e.spec.ts` (6 calls, low effort)
2. `frontend/tests/e2e/context-aware-search.spec.ts` (6 calls, low effort)
3. `frontend/tests/auth.setup.ts` (13 calls, medium effort)
4. Test files and utilities (recommended to start with)

## 🚀 Recommended Migration Process

### Phase 1: Foundation (1-2 days)
Start with simple files to establish patterns:
```bash
# Analyze first
node scripts/debug-migrate.js analyze

# Migrate test files and utilities first
node scripts/migrate-debug-calls.js migrate frontend/tests/e2e/smoke.e2e.spec.ts
node scripts/debug-migration-validator.js frontend/tests/e2e/smoke.e2e.spec.ts
```

### Phase 2: Core Implementation (3-5 days)
Migrate main application logic:
```bash
# Migrate by category focus (network files first, then data files)
node scripts/migrate-debug-calls.js migrate
```

### Phase 3: Complex Cases (2-3 days)
Handle complex files requiring special attention:
- Files with >10 debug calls
- Files mixing multiple debug types
- Core system files

## 🛡️ Safety Features

### Automatic Backups
All migration tools create backup files:
```bash
# Files are backed up as: original-file.migration-backup
# Restore if needed:
cp file.ts.migration-backup file.ts
```

### Validation at Every Step
```bash
# Always validate after migration
node scripts/debug-migration-validator.js
```

### Gradual Migration Support
Tools support both file-by-file and batch migration:
```bash
# Migrate specific file
node scripts/migrate-debug-calls.js migrate path/to/file.ts

# Migrate all files
node scripts/migrate-debug-calls.js migrate
```

## 🔧 Environment Configuration

After migration, use the enhanced debug system:

```bash
# Enable all debugging
DEBUG=bos:* npm run dev

# Enable specific categories  
DEBUG=bos:network,bos:data npm run dev

# Enable specific sub-namespaces
DEBUG=bos:network:api,bos:data:database npm run dev

# Enable all except specific namespaces
DEBUG=bos:*,-bos:cache npm run dev
```

## ❓ Troubleshooting

### Common Issues

1. **Import errors:** Use `node scripts/debug-migrate.js help`
2. **Method not found:** Check mapping table above
3. **Debug output not appearing:** Verify DEBUG environment variable
4. **Migration fails:** Check file permissions and syntax

### Recovery Commands

```bash
# Restore all backup files
find . -name "*.migration-backup" -exec bash -c 'mv "$1" "${1%.migration-backup}"' _ {} \;

# Remove backup files when satisfied
find . -name "*.migration-backup" -delete
```

## 📈 Benefits of Migration

After migration, you'll have:

- ✅ **Better Organization:** Functions grouped by functional area
- ✅ **Easier Discovery:** Categories help find the right debug function
- ✅ **Enhanced Filtering:** More granular control over debug output
- ✅ **Backward Compatibility:** Both systems work together during transition
- ✅ **Improved Maintainability:** Easier to manage and extend

## 🤝 Team Adoption

1. **Training:** Share `debug-migration-examples.md` with your team
2. **Code Reviews:** Check for proper category usage in PRs
3. **ESLint Integration:** Add the ESLint rule to catch legacy usage
4. **Documentation:** Update project docs with new patterns

---

## Next Steps

1. **Start with analysis:** `node scripts/debug-migrate.js analyze`
2. **Review the strategy:** `node scripts/debug-migrate.js comprehensive`
3. **Begin migration:** `node scripts/debug-migrate.js migrate`
4. **Validate results:** `node scripts/debug-migration-validator.js`
5. **Update team documentation** with new debug patterns

The tools provide automated, safe migration with comprehensive validation to ensure a smooth transition to the enhanced 6-category debug system.