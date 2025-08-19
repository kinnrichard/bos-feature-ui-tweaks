---
title: "Debug System Quick Reference"
description: "Quick reference guide for the 6-category debug system with legacy compatibility"
last_updated: "2025-07-26"
status: "active"
category: "reference"
tags: ["debug", "quick-reference", "epic-016", "categories", "legacy-compatibility"]
---

# Debug System Quick Reference

## 🚀 Enable Debugging

```bash
# Enable all (6 categories + 19 legacy functions)
DEBUG=bos:* npm run dev

# Enable specific categories
DEBUG=bos:network,bos:data npm run dev

# Enable specific sub-namespaces
DEBUG=bos:network:api,bos:data:database npm run dev
```

### Browser Console
```javascript
// Enable all debugging
bosDebug.enable('bos:*')

// Category-specific helpers (NEW)
bosDebug.categories()              // Explore 6-category system
bosDebug.enableCategory('network') // Enable network category
bosDebug.legacy()                  // Show all 19 legacy functions
```

## 📦 Import Debug Functions

### Category System (Recommended)
```typescript
// Import categories
import { debugNetwork, debugData, debugUI, debugBusiness, debugMonitor, debugSystem } from '$lib/utils/debug';

// Use with sub-namespaces
debugNetwork.api('API request', data);
debugData.database('Query executed', data);
debugUI.component('Component rendered', data);
```

### Legacy Functions (Still Supported)
```typescript
// Individual legacy functions
import { debugAPI, debugAuth, debugComponent } from '$lib/utils/debug';
import { debugPerformance, debugError } from '$lib/utils/debug';
import { debugWorkflow, debugSearch } from '$lib/utils/debug';
```

## 🎯 Usage Patterns

### Category System Usage
```typescript
// Network operations (secure)
debugNetwork.api('User fetched', { userId: 123, responseTime: '45ms' });
debugNetwork.auth('Authentication completed', { userId, sessionId });

// Data management
debugData.state('Job updated', { jobId, oldStatus, newStatus });
debugData.database('Query completed', { duration: '120ms', rows: 50 });

// UI operations
debugUI.component('Component mounted', { name: 'JobList', propsCount: 5 });
debugUI.navigation('Route changed', { from: '/jobs', to: '/tasks' });

// Monitoring
debugMonitor.performance('Operation completed', { duration: '120ms' });
debugMonitor.error('API failed', { error: error.message, endpoint });
```

### Legacy Usage (Still Works)
```typescript
// Legacy functions continue to work unchanged
debugAPI('User fetched', { userId: 123, responseTime: '45ms' });
debugState('Job updated', { jobId, oldStatus, newStatus });
debugPerformance('Query completed', { duration: '120ms', rows: 50 });
debugError('API failed', { error: error.message, endpoint });
```

## 🛡️ Security Features

✅ **Enhanced auto-redaction**: `password`, `token`, `authorization`, `api_key`, `csrf_token`, `secret`
✅ **Production safe**: Zero runtime cost with optimized builds
✅ **Type safe**: Full TypeScript support with improved IntelliSense
✅ **Batch processing**: Optimized security redaction for performance

## 📁 6-Category System

**🌐 debugNetwork**: `api`, `auth`, `security`, `integration`, `websocket`
**💾 debugData**: `database`, `cache`, `validation`, `reactive`, `state`
**🎨 debugUI**: `component`, `navigation`, `notification`
**🏢 debugBusiness**: `workflow`, `search`, `upload`, `export`
**📊 debugMonitor**: `performance`, `error`
**⚙️ debugSystem**: `framework`, `development`

## 🔄 19 Legacy Functions (100% Compatible)

**Core (7)**: `debugAPI`, `debugAuth`, `debugSecurity`, `debugReactive`, `debugState`, `debugComponent`, `debugCache`
**Data (3)**: `debugDatabase`, `debugWebSocket`, `debugValidation`  
**Monitor (2)**: `debugPerformance`, `debugError`
**UI (2)**: `debugNavigation`, `debugNotification`
**Business (5)**: `debugWorkflow`, `debugSearch`, `debugUpload`, `debugExport`, `debugIntegration`

## 🎛️ Browser Commands

### Basic Commands
```javascript
bosDebug.enable('bos:*')       // Enable all debugging
bosDebug.disable()             // Turn off debugging
bosDebug.status()              // Check current settings
bosDebug.list()                // Show all namespaces
```

### Category Commands (NEW)
```javascript
bosDebug.categories()          // Explore 6-category system
bosDebug.enableCategory('network')  // Enable network category
bosDebug.disableCategory('data')    // Disable data category
bosDebug.legacy()              // Show legacy functions
bosDebug.migration()           // Migration guide
bosDebug.validate()            // System health check
```

### Environment Examples
```bash
# Category patterns
DEBUG=bos:network,bos:data npm run dev
DEBUG=bos:network:api,bos:data:database npm run dev

# Legacy patterns (still work)
DEBUG=bos:api,bos:auth npm run dev
DEBUG=bos:*,-bos:cache npm run dev
```

---
📚 **Full docs**: `/docs/debug/javascript-console/epic-014-debug-system-guide.md`
🔄 **Migration guide**: `/docs/debug/javascript-console/migration-guide.md`
⚡ **Best practices**: `/docs/debug/javascript-console/best-practices.md`