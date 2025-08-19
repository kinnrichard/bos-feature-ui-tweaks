# Debug System Migration Guide

This guide provides comprehensive examples and usage instructions for migrating from the legacy 19-namespace debug system to the new 6-category system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Migration Tools](#migration-tools)
3. [Before & After Examples](#before--after-examples)
4. [Step-by-Step Migration Process](#step-by-step-migration-process)
5. [Validation and Testing](#validation-and-testing)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Quick Start

### 1. Analyze Your Current Usage

```bash
# Get an overview of debug function usage in your codebase
node scripts/migrate-debug-calls.js analyze

# Get comprehensive analysis with priorities and recommendations
node scripts/debug-migration-analyzer.js
```

### 2. Migrate Your Code

```bash
# Migrate all files
node scripts/migrate-debug-calls.js migrate

# Migrate specific file
node scripts/migrate-debug-calls.js migrate frontend/src/lib/api/auth.ts
```

### 3. Validate the Migration

```bash
# Validate all migrated files
node scripts/debug-migration-validator.js

# Validate specific file
node scripts/debug-migration-validator.js frontend/src/lib/api/auth.ts
```

## Migration Tools

### 1. Migration Analyzer (`migrate-debug-calls.js`)

Primary tool for analyzing and migrating debug function calls.

```bash
# Available commands
node scripts/migrate-debug-calls.js analyze    # Analyze current usage
node scripts/migrate-debug-calls.js migrate   # Migrate all files
node scripts/migrate-debug-calls.js validate  # Basic validation
node scripts/migrate-debug-calls.js report    # Generate detailed report
```

### 2. Comprehensive Analyzer (`debug-migration-analyzer.js`)

Advanced analysis tool that provides migration strategy and priorities.

```bash
node scripts/debug-migration-analyzer.js
```

**Features:**
- Complexity assessment
- Priority ranking of files
- Migration timeline estimation
- Category breakdown analysis
- Strategic recommendations

### 3. Validation Tool (`debug-migration-validator.js`)

Comprehensive validation of migrated code.

```bash
node scripts/debug-migration-validator.js [optional-file]
```

**Validation checks:**
- Syntax validation
- Import statement correctness
- Function call validation
- Runtime functionality testing
- TypeScript type checking
- Performance regression testing

### 4. ESLint Rule (`eslint-debug-migration-rule.js`)

Custom ESLint rule for automated migration suggestions.

```javascript
// Add to eslint.config.js
module.exports = {
  rules: {
    'custom/debug-migration-helper': ['warn', {
      mode: 'warn',
      autoFix: true
    }]
  }
};
```

## Before & After Examples

### Basic Function Calls

**Before (Legacy System):**
```javascript
import { debugAPI, debugAuth, debugDatabase } from '$lib/utils/debug';

debugAPI('Request started', { url: '/api/users', method: 'GET' });
debugAuth('User authenticated', { userId: 123 });
debugDatabase('Query executed', { sql: 'SELECT * FROM users', duration: 45 });
```

**After (Category System):**
```javascript
import { debugNetwork, debugData } from '$lib/utils/debug';

debugNetwork.api('Request started', { url: '/api/users', method: 'GET' });
debugNetwork.auth('User authenticated', { userId: 123 });
debugData.database('Query executed', { sql: 'SELECT * FROM users', duration: 45 });
```

### Warning and Error Levels

**Before:**
```javascript
import { debugAPI, debugDatabase } from '$lib/utils/debug';

debugAPI.warn('Request slow', { url: '/api/users', duration: 2000 });
debugAPI.error('Request failed', { url: '/api/users', error: 'Timeout' });
debugDatabase.warn('Query slow', { sql: 'SELECT *', duration: 1500 });
```

**After:**
```javascript
import { debugNetwork, debugData } from '$lib/utils/debug';

debugNetwork.api.warn('Request slow', { url: '/api/users', duration: 2000 });
debugNetwork.api.error('Request failed', { url: '/api/users', error: 'Timeout' });
debugData.database.warn('Query slow', { sql: 'SELECT *', duration: 1500 });
```

### Complete Migration Mapping

| Legacy Function | New Category Method | Usage Example |
|-----------------|-------------------|---------------|
| `debugAPI` | `debugNetwork.api()` | `debugNetwork.api('API call', data)` |
| `debugAuth` | `debugNetwork.auth()` | `debugNetwork.auth('Auth event', data)` |
| `debugSecurity` | `debugNetwork.security()` | `debugNetwork.security('Security check', data)` |
| `debugIntegration` | `debugNetwork.integration()` | `debugNetwork.integration('Third-party API', data)` |
| `debugWebSocket` | `debugNetwork.websocket()` | `debugNetwork.websocket('WebSocket event', data)` |
| `debugDatabase` | `debugData.database()` | `debugData.database('DB query', data)` |
| `debugCache` | `debugData.cache()` | `debugData.cache('Cache operation', data)` |
| `debugValidation` | `debugData.validation()` | `debugData.validation('Data validation', data)` |
| `debugReactive` | `debugData.reactive()` | `debugData.reactive('Reactive update', data)` |
| `debugState` | `debugData.state()` | `debugData.state('State change', data)` |
| `debugComponent` | `debugUI.component()` | `debugUI.component('Component event', data)` |
| `debugNavigation` | `debugUI.navigation()` | `debugUI.navigation('Navigation', data)` |
| `debugNotification` | `debugUI.notification()` | `debugUI.notification('Notification', data)` |
| `debugWorkflow` | `debugBusiness.workflow()` | `debugBusiness.workflow('Process step', data)` |
| `debugSearch` | `debugBusiness.search()` | `debugBusiness.search('Search operation', data)` |
| `debugUpload` | `debugBusiness.upload()` | `debugBusiness.upload('File upload', data)` |
| `debugExport` | `debugBusiness.export()` | `debugBusiness.export('Data export', data)` |
| `debugPerformance` | `debugMonitor.performance()` | `debugMonitor.performance('Perf metric', data)` |
| `debugError` | `debugMonitor.error()` | `debugMonitor.error('Error occurred', data)` |

## Step-by-Step Migration Process

### Phase 1: Analysis and Planning

1. **Run comprehensive analysis:**
   ```bash
   node scripts/debug-migration-analyzer.js
   ```

2. **Review the generated reports:**
   - `debug-migration-analysis-report.json` - Detailed analysis
   - `debug-migration-priority.csv` - File priority ranking

3. **Plan your migration phases based on recommendations**

### Phase 2: Migration Execution

1. **Start with high-priority files:**
   ```bash
   # Migrate the top priority file
   node scripts/migrate-debug-calls.js migrate frontend/src/lib/utils/auth.ts
   ```

2. **Test immediately after each file:**
   ```bash
   # Validate the migrated file
   node scripts/debug-migration-validator.js frontend/src/lib/utils/auth.ts
   
   # Test your application
   npm run dev
   ```

3. **Continue with batch migrations:**
   ```bash
   # For low-complexity projects, migrate all at once
   node scripts/migrate-debug-calls.js migrate
   ```

### Phase 3: Validation and Testing

1. **Run full validation:**
   ```bash
   node scripts/debug-migration-validator.js
   ```

2. **Test your application thoroughly:**
   ```bash
   npm run test
   npm run dev
   ```

3. **Clean up backup files:**
   ```bash
   # Remove backup files when satisfied
   find . -name "*.migration-backup" -delete
   ```

## Validation and Testing

### Automated Validation

The migration validator performs several checks:

```bash
node scripts/debug-migration-validator.js
```

**Validation includes:**
- ✅ Syntax validation (bracket matching, etc.)
- ✅ Import statement correctness
- ✅ Function call validation (proper method names)
- ✅ Runtime functionality testing
- ✅ TypeScript type checking
- ✅ Performance regression testing

### Manual Testing Checklist

After migration, verify:

- [ ] Application starts without errors
- [ ] Debug output appears in console (with `DEBUG=bos:*`)
- [ ] Category-specific filtering works (`DEBUG=bos:network`)
- [ ] Sub-namespace filtering works (`DEBUG=bos:network:api`)
- [ ] Warning and error levels work properly
- [ ] No performance regression in debug operations

### Environment Configuration Testing

Test different debug configurations:

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

## Troubleshooting

### Common Issues and Solutions

#### 1. Import Errors

**Problem:** `Import 'debugNetwork' not found`

**Solution:**
```javascript
// Make sure you're importing from the correct path
import { debugNetwork } from '$lib/utils/debug';
// NOT from '$lib/utils/debug/namespaces'
```

#### 2. Method Not Found Errors

**Problem:** `debugNetwork.invalidMethod is not a function`

**Solution:** Check the valid methods for each category:
- Network: `api`, `auth`, `security`, `integration`, `websocket`
- Data: `database`, `cache`, `validation`, `reactive`, `state`
- UI: `component`, `navigation`, `notification`
- Business: `workflow`, `search`, `upload`, `export`
- Monitor: `performance`, `error`
- System: `framework`, `development`

#### 3. Mixed Legacy and Category Usage

**Problem:** Some files still use legacy functions

**Solution:**
```bash
# Check for remaining legacy usage
node scripts/migrate-debug-calls.js analyze

# Migrate specific files that still have legacy calls
node scripts/migrate-debug-calls.js migrate path/to/file.ts
```

#### 4. Runtime Errors After Migration

**Problem:** Application crashes or behaves unexpectedly

**Solution:**
1. Check validation results:
   ```bash
   node scripts/debug-migration-validator.js
   ```

2. Restore from backup files if needed:
   ```bash
   # Restore specific file
   cp file.ts.migration-backup file.ts
   ```

3. Re-run migration with validation:
   ```bash
   node scripts/migrate-debug-calls.js migrate file.ts
   node scripts/debug-migration-validator.js file.ts
   ```

### Debug Environment Issues

#### Problem: Debug output not appearing

**Solution:**
1. Check environment variable:
   ```bash
   echo $DEBUG
   ```

2. Set debug environment:
   ```bash
   # In terminal
   export DEBUG=bos:*
   
   # In package.json script
   "dev": "DEBUG=bos:* vite dev"
   
   # In browser console
   localStorage.debug = 'bos:*'
   ```

#### Problem: Category filtering not working

**Solution:**
1. Verify category namespace:
   ```bash
   # Correct
   DEBUG=bos:network
   
   # Incorrect
   DEBUG=network
   ```

2. Check for typos in category names:
   - `bos:network` (not `bos:networking`)
   - `bos:data` (not `bos:database`)
   - `bos:ui` (not `bos:UI`)

## Best Practices

### Migration Strategy

1. **Start Small:** Begin with simple files and utilities
2. **Test Frequently:** Validate after each batch of migrations
3. **Keep Backups:** Don't delete `.migration-backup` files until fully tested
4. **Document Changes:** Update team documentation with new patterns

### Code Organization

1. **Group Imports:** Import related categories together
   ```javascript
   // Good
   import { debugNetwork, debugData } from '$lib/utils/debug';
   
   // Avoid mixing old and new
   import { debugAPI, debugNetwork } from '$lib/utils/debug';
   ```

2. **Use Descriptive Messages:** Take advantage of the organized structure
   ```javascript
   // Good
   debugNetwork.api('User registration API call', { 
     endpoint: '/api/register',
     method: 'POST',
     userId: user.id 
   });
   
   // Less helpful
   debugNetwork.api('API call', data);
   ```

3. **Leverage Category Organization:** Use categories to organize your debugging
   ```javascript
   // Network operations
   debugNetwork.api('Starting authentication');
   debugNetwork.auth('Token validated');
   
   // Data operations  
   debugData.database('User query executed');
   debugData.cache('User data cached');
   ```

### Environment Configuration

1. **Development:** Enable all debugging
   ```bash
   DEBUG=bos:* npm run dev
   ```

2. **Production:** Disable debug or use specific categories
   ```bash
   # Production - errors only
   DEBUG=bos:monitor:error npm run build
   
   # Or disable entirely
   npm run build
   ```

3. **Testing:** Use category-specific debugging
   ```bash
   # Test API functionality
   DEBUG=bos:network npm run test
   
   # Test data operations
   DEBUG=bos:data npm run test
   ```

### Team Adoption

1. **Training:** Share this guide with your team
2. **Code Reviews:** Check for proper category usage in PRs
3. **Linting:** Add the ESLint rule to catch legacy usage
4. **Documentation:** Update project docs with new patterns

---

## Summary

The migration from the legacy 19-namespace system to the 6-category system provides:

- ✅ **Better Organization:** Logical grouping by functional area
- ✅ **Easier Discovery:** Categories help developers find the right debug function
- ✅ **Backward Compatibility:** Both systems work together during transition
- ✅ **Enhanced Filtering:** More granular control over debug output
- ✅ **Improved Maintainability:** Easier to manage and extend

The migration tools provide automated analysis, migration, and validation to ensure a smooth transition with minimal risk.

For questions or issues, refer to the troubleshooting section or run the validation tools to identify specific problems.