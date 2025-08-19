# Debug System - 6-Category System Guide (Epic 016)

## Overview

The debug system has evolved into a powerful 6-category system (Epic 016) that provides organized, efficient debugging while maintaining 100% backward compatibility with the original 19 debug functions. This guide covers the new category-based approach and migration from the legacy system.

## 🎯 Epic 016 Achievements

- ✅ **6-Category Debug System** - Organized debugging with sub-namespace methods
- ✅ **100% Backward Compatibility** - All 19 legacy functions continue to work unchanged
- ✅ **Enhanced Browser Helpers** - Category exploration and migration tools
- ✅ **Performance Optimizations** - Lazy loading and memory efficiency
- ✅ **Security Redaction** - Enhanced automatic sensitive data filtering
- ✅ **TypeScript Support** - Full type safety with improved IntelliSense

## 🚀 Quick Start

### Environment Configuration
```bash
# Enable all debugging (both categories and legacy)
DEBUG=bos:* npm run dev

# Enable specific categories
DEBUG=bos:network,bos:data npm run dev

# Enable specific sub-namespaces
DEBUG=bos:network:api,bos:data:database npm run dev

# Enable all except specific namespaces
DEBUG=bos:*,-bos:cache npm run dev
```

### Browser Console Control
```javascript
// Enable all debugging
bosDebug.enable('bos:*')

// Enable specific categories
bosDebug.enable('bos:network,bos:data')

// Enable specific sub-namespaces
bosDebug.enable('bos:network:api')

// Category-specific helpers (NEW)
bosDebug.categories()              // Explore 6-category system
bosDebug.enableCategory('network') // Enable network category
bosDebug.legacy()                  // Show all 19 legacy functions
bosDebug.migration()               // Migration guide

// Standard helpers
bosDebug.disable()
bosDebug.status()
bosDebug.list()
```

## 📦 6-Category Debug System Architecture

The debug system is now organized into 6 main categories with sub-namespace methods:

### 🌐 debugNetwork - Network & Communication
**Sub-namespaces**: `api`, `auth`, `security`, `integration`, `websocket`
```typescript
import { debugNetwork } from '$lib/utils/debug';

debugNetwork('General network activity', data);
debugNetwork.api('API request', { url, method });
debugNetwork.auth('User authentication', { userId });
debugNetwork.security('Security check', { action });
debugNetwork.integration('Third-party API', { service });
debugNetwork.websocket('WebSocket event', { event, data });
```

### 💾 debugData - Data Management
**Sub-namespaces**: `database`, `cache`, `validation`, `reactive`, `state`
```typescript
import { debugData } from '$lib/utils/debug';

debugData('General data operation', data);
debugData.database('Database query', { sql, duration });
debugData.cache('Cache operation', { key, action });
debugData.validation('Data validation', { field, rule });
debugData.reactive('Reactive update', { store, value });
debugData.state('State change', { previous, current });
```

### 🎨 debugUI - User Interface
**Sub-namespaces**: `component`, `navigation`, `notification`
```typescript
import { debugUI } from '$lib/utils/debug';

debugUI('General UI operation', data);
debugUI.component('Component lifecycle', { name, phase });
debugUI.navigation('Navigation event', { from, to });
debugUI.notification('Notification shown', { type, message });
```

### 🏢 debugBusiness - Business Logic
**Sub-namespaces**: `workflow`, `search`, `upload`, `export`
```typescript
import { debugBusiness } from '$lib/utils/debug';

debugBusiness('General business logic', data);
debugBusiness.workflow('Process step', { step, status });
debugBusiness.search('Search operation', { query, results });
debugBusiness.upload('File upload', { filename, progress });
debugBusiness.export('Data export', { format, records });
```

### 📊 debugMonitor - Monitoring & Performance
**Sub-namespaces**: `performance`, `error`
```typescript
import { debugMonitor } from '$lib/utils/debug';

debugMonitor('General monitoring', data);
debugMonitor.performance('Performance metric', { operation, duration });
debugMonitor.error('Error occurred', { error, context });
```

### ⚙️ debugSystem - System & Framework
**Sub-namespaces**: `framework`, `development`
```typescript
import { debugSystem } from '$lib/utils/debug';

debugSystem('General system operation', data);
debugSystem.framework('Framework debug', { component, action });
debugSystem.development('Development tool', { tool, operation });
```

## 🛡️ Security Features

### Automatic Data Redaction
All debug functions automatically redact sensitive information:

```typescript
import { debugAPI, debugAuth } from '$lib/utils/debug';

// These calls are automatically secured:
debugAPI('User login', { 
  username: 'admin', 
  password: 'secret123',  // Will be redacted as [REDACTED]
  csrf_token: 'abc123'    // Will be redacted as [REDACTED]
});

debugAuth('Auth response', {
  access_token: 'jwt_token',     // Will be redacted as [REDACTED]
  user: { id: 1, name: 'John' }, // User data preserved
  authorization: 'Bearer xyz'    // Will be redacted as [REDACTED]
});
```

### Redacted Fields
The security system automatically redacts:
- Passwords and auth tokens
- CSRF tokens and headers
- Authorization headers
- API keys and secrets
- Credit card numbers
- Email addresses (configurable)
- Any field containing 'password', 'token', 'secret', 'key'

## 🔧 Usage Examples

### Category-Based Debugging (Recommended)
```typescript
import { debugNetwork, debugData, debugUI } from '$lib/utils/debug';

// Network operations
async function fetchUser(id: number) {
  debugNetwork.api('Fetching user', { id, endpoint: '/api/users' });
  
  try {
    const response = await fetch(`/api/users/${id}`);
    const user = await response.json();
    
    debugNetwork.api('User fetched successfully', { 
      user: user,
      responseTime: '150ms',
      status: response.status
    });
    
    return user;
  } catch (error) {
    debugMonitor.error('User fetch failed', { id, error: error.message });
    throw error;
  }
}

// Data management
function updateUserData(userId: string, data: any) {
  debugData.state('User data update started', { userId, changes: Object.keys(data) });
  
  // Update local state
  const previousState = getUserState(userId);
  updateUserState(userId, data);
  
  debugData.state('User data updated', {
    userId,
    previousState,
    newState: getUserState(userId),
    fieldsChanged: Object.keys(data)
  });
}

// UI operations
export class JobComponent {
  private state = $state({
    jobs: [],
    loading: false,
    error: null
  });
  
  onMount() {
    debugUI.component('JobComponent mounted', { 
      componentName: 'JobComponent',
      initialState: this.state,
      timestamp: Date.now()
    });
  }
  
  handleNavigation(route: string) {
    debugUI.navigation('Route change initiated', {
      from: currentRoute,
      to: route,
      trigger: 'user_action'
    });
  }
}
```

### Legacy Function Compatibility (Still Works)
```typescript
// Legacy approach continues to work unchanged
import { debugAPI, debugState, debugComponent } from '$lib/utils/debug';

// These calls work exactly as before
debugAPI('API request', { url, method });
debugState('State changed', { oldState, newState });
debugComponent('Component mounted', { name });
```

### Mixed Usage Pattern (Gradual Migration)
```typescript
// You can mix both approaches during migration
import { debugAPI, debugNetwork, debugData } from '$lib/utils/debug';

// Existing code using legacy functions
debugAPI('Legacy API call', { url });

// New code using category system
debugNetwork.api('New API call', { url, method });
debugData.database('Query executed', { sql, duration });
```

### Performance Monitoring
```typescript
import { debugMonitor } from '$lib/utils/debug';

function measureRenderTime(componentName: string) {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      debugMonitor.performance('Component render completed', {
        component: componentName,
        duration: `${duration.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
        memoryUsage: performance.memory?.usedJSHeapSize || 'unknown'
      });
    }
  };
}

// Usage in component
const timer = measureRenderTime('JobList');
// ... component logic ...
timer.end();
```

### Error Handling
```typescript
import { debugMonitor } from '$lib/utils/debug';

function handleApiError(error: Error, context: string) {
  debugMonitor.error('API error occurred', {
    error: error.message,
    stack: error.stack?.substring(0, 500), // Truncate for readability
    context: context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent.substring(0, 100),
    url: window.location.href
  });
  
  // Error recovery logic
  const recovery = attemptRecovery(error);
  
  debugMonitor.error('Error recovery attempted', {
    originalError: error.message,
    recoveryAction: recovery.action,
    success: recovery.success,
    retryCount: recovery.attempts
  });
}
```

## 🎛️ Development Tools

### Browser Debug Helper
When in development mode, a debug helper is automatically available:

```javascript
// Available in browser console
bosDebug.enable('bos:*')           // Enable all debugging
bosDebug.enable('bos:api')         // Enable API debugging only
bosDebug.enable('bos:api,bos:auth') // Enable multiple namespaces
bosDebug.disable()                 // Disable all debugging
bosDebug.status()                  // Show current settings
bosDebug.list()                    // Show all available namespaces
```

### Debug Status Component
For UI debugging, you can check debug status programmatically:

```typescript
import { getDebugStatus } from '$lib/utils/debug';

const status = getDebugStatus();
console.log('Debug enabled:', status.enabled);
console.log('Active namespaces:', status.namespaces);
console.log('Debug pattern:', status.current);
```

## 📋 Migration Patterns

### Legacy Functions → Category System Migration

#### Before (Legacy - Still Works)
```typescript
// Legacy approach (19 individual functions)
import { debugAPI, debugAuth, debugComponent, debugState } from '$lib/utils/debug';

debugAPI('API request', { url, method });
debugAuth('User authenticated', { userId });
debugComponent('Component mounted', { name });
debugState('State updated', { oldState, newState });
```

#### After (Category System - Recommended)
```typescript
// Category approach (6 organized categories)
import { debugNetwork, debugData, debugUI } from '$lib/utils/debug';

// Network category replaces: debugAPI, debugAuth, debugSecurity, debugIntegration, debugWebSocket
debugNetwork.api('API request', { url, method });
debugNetwork.auth('User authenticated', { userId });

// Data category replaces: debugDatabase, debugCache, debugValidation, debugReactive, debugState
debugData.state('State updated', { oldState, newState });
debugData.cache('Cache operation', { key, action });

// UI category replaces: debugComponent, debugNavigation, debugNotification
debugUI.component('Component mounted', { name });
debugUI.navigation('Route changed', { from, to });
```

#### Mixed Migration Strategy (Gradual Transition)
```typescript
// You can mix both approaches during migration
import { debugAPI, debugNetwork, debugData } from '$lib/utils/debug';

// Keep existing legacy calls during transition
debugAPI('Existing API call', { url }); // Legacy - still works

// Use categories for new code
debugNetwork.api('New API call', { url, method }); // Category - recommended
debugData.database('New query', { sql, duration }); // Category - recommended
```

## 🔍 Advanced Usage

### Category-Based Debugging
```typescript
// Import categories directly
import { debugNetwork, debugData, debugMonitor, debugUI, debugBusiness } from '$lib/utils/debug';

// Use category functions with sub-namespaces
debugNetwork.api('API call', data);
debugData.database('Query executed', query);
debugMonitor.performance('Render time', metrics);
debugUI.component('Component rendered', { name, props });
debugBusiness.workflow('Process step completed', { step, result });
```

### Advanced Debug Patterns
```bash
# Enable all categories
DEBUG=bos:network,bos:data,bos:ui,bos:business,bos:monitor,bos:system npm run dev

# Enable specific category sub-namespaces
DEBUG=bos:network:api,bos:data:database,bos:monitor:performance npm run dev

# Enable entire categories
DEBUG=bos:network,bos:data npm run dev

# Enable all except specific sub-namespaces
DEBUG=bos:*,-bos:data:cache,-bos:ui:notification npm run dev

# Legacy pattern support (still works)
DEBUG=bos:api,bos:auth,bos:component npm run dev
```

### Conditional Debugging
```typescript
import { isDebugEnabled } from '$lib/utils/debug';

// Check if debugging is enabled before expensive operations
if (isDebugEnabled('bos:monitor:performance')) {
  const metrics = calculateExpensiveMetrics();
  debugMonitor.performance('Expensive calculation', metrics);
}

// Check category-level enablement
if (isDebugEnabled('bos:network')) {
  const networkStats = gatherNetworkStatistics();
  debugNetwork('Network statistics', networkStats);
}
```

## 🧪 Testing Integration

### Debug in Tests
```typescript
import { test, expect } from '@playwright/test';
import { debugAPI } from '$lib/utils/debug';

test('API integration test', async ({ page }) => {
  // Enable debugging for this test
  await page.addInitScript(() => {
    localStorage.debug = 'bos:api';
  });
  
  // Debug calls will appear in browser console
  await page.goto('/api-test-page');
  
  // Test assertions...
});
```

### Production Safety
```typescript
// Debug calls are automatically stripped in production builds
debugAPI('Sensitive operation', { apiKey: 'secret' });
// This call has zero runtime cost in production
```

## 📊 Performance Impact

- **Development**: Minimal impact, only when debugging is enabled
- **Production**: Zero impact - all debug calls are stripped during build
- **Security**: Automatic redaction prevents data leaks
- **Bundle Size**: No increase in production bundle size

## 🛠️ Troubleshooting

### Debug Not Working?
1. Check if debugging is enabled: `bosDebug.status()`
2. Verify namespace pattern: `bosDebug.list()`
3. Refresh page after changing settings
4. Check browser console for error messages

### Missing Debug Output?
1. Ensure you're using the correct namespace
2. Check if the debug call is inside a conditional block
3. Verify environment variables in development

### Security Concerns?
1. All sensitive data is automatically redacted
2. Debug output is only visible in development
3. Production builds remove all debug code
4. Review `src/lib/utils/debug/redactor.ts` for redaction rules

## 📚 Reference

### All Available Debug Categories
```typescript
// 6 Main Categories
debugNetwork    // api, auth, security, integration, websocket
debugData       // database, cache, validation, reactive, state
debugUI         // component, navigation, notification
debugBusiness   // workflow, search, upload, export
debugMonitor    // performance, error
debugSystem     // framework, development

// Legacy Functions (backward compatibility)
debugAPI, debugAuth, debugSecurity, debugReactive, debugState, debugComponent, 
debugCache, debugDatabase, debugWebSocket, debugValidation, debugPerformance, 
debugError, debugNavigation, debugNotification, debugWorkflow, debugSearch, 
debugUpload, debugExport, debugIntegration
```

### Import Patterns
```typescript
// Category imports (recommended)
import { debugNetwork, debugData, debugUI } from '$lib/utils/debug';

// Legacy individual imports (still supported)
import { debugAPI, debugAuth } from '$lib/utils/debug';

// Mixed imports (during migration)
import { debugAPI, debugNetwork, debugData } from '$lib/utils/debug';

// All categories
import { categoryDebugFunctions } from '$lib/utils/debug';

// Default export (convenience)
import debug from '$lib/utils/debug'; // Returns debugAPI for backward compatibility
```

---

## 🔗 Related Documentation

### Epic Documentation
- **[Epic-012: Secure Debug Architecture](../../docs/epics/completed/epic-012-secure-debug-architecture.md)** - Initial debug system implementation
- **[Epic-013: Tasklist Refactoring](../../docs/epics/completed/epic-013-tasklist-architectural-refactoring.md)** - Architectural improvements
- **[Epic-014: Debug System Standardization](../../docs/epics/completed/epic-014-debug-system-standardization.md)** - 19-namespace system expansion
- **[Epic-015: Debug System Completion](../../docs/epics/completed/epic-015-debug-system-completion.md)** - Enhanced functionality
- **[Epic-016: 6-Category System](../../docs/epics/completed/epic-016-category-debug-system.md)** - Current 6-category implementation

### Debug System Documentation
- **[Debug Best Practices](./best-practices.md)** - 6-category development patterns
- **[Debug Migration Guide](./migration-guide.md)** - Migration from 19 functions to 6 categories
- **[Debug Quick Reference](./quick-reference.md)** - Quick category and legacy reference

### Architecture & Implementation
- **[Technical Decisions](../../docs/standards/technical-decisions.md)** - Architecture decision records
- **[Style Guide](../../docs/standards/style-guide.md)** - Code style and conventions
- **[Frontend Architecture](../../docs/architecture/frontend-architecture.md)** - Svelte + TypeScript patterns

### Development Workflow
- **[API Integration](../../docs/api/frontend-integration.md)** - Frontend API patterns
- **[Testing Strategy](../../docs/tests/readme-tests.md)** - Testing approach and patterns
- **[Claude Automation](../../docs/guides/claude-automation-setup.md)** - Automated development setup

### See Also
- **[Zero.js Integration](../src/lib/zero/README.md)** - Zero.js reactive system
- **[Frontend Migration Guide](../epic-008-migration-guide.md)** - Svelte 5 migration patterns
- **[Performance Guidelines](../../docs/architecture/performance-guidelines.md)** - Performance optimization

---

**Epic 016 Status**: ✅ Complete
**Debug Categories**: 6 implemented with sub-namespace methods
**Legacy Functions**: 19 functions with 100% backward compatibility
**Console.log Migrations**: 306 completed
**Security**: Enhanced automatic redaction active
**Performance**: Optimized with lazy loading and memory efficiency
**Testing**: Integrated with Playwright and Vitest