# Complete Zero TTL API Reference

Based on my comprehensive analysis of the Zero codebase, here's everything you need to know about TTL handling:

## TTL Error Analysis

**Your `ttl.slice is not a function` error** occurs at packages/zql/src/query/ttl.ts:47 when a non-string value is passed to `parseTTL()`. The code expects TTL strings like `"5m"` but receives a different type.

**Root cause**: TTL must be a proper `TTL` type, not arbitrary values.

## TTL Type Definition

```typescript
type TTL = `${number}${TimeUnit}` | 'forever' | 'none' | number;
type TimeUnit = 's' | 'm' | 'h' | 'd' | 'y';
```

## Valid TTL Values

```javascript
// String formats (recommended)
'1s'      // 1 second
'30s'     // 30 seconds  
'5m'      // 5 minutes
'2h'      // 2 hours
'1d'      // 1 day
'1y'      // 1 year

// Special values
'forever' // Never expire
'none'    // Expire immediately

// Numbers (milliseconds)
1000      // 1 second
60000     // 1 minute
-1        // Forever
0         // None
```

## Reactive Methods

### 1. React Hook
```javascript
import { useQuery } from '@rocicorp/zero/react';

// Basic usage
const [data] = useQuery(z.query.issues.limit(10), {
  ttl: '5m' // Keep cached for 5 minutes
});

// Legacy boolean syntax
const [data] = useQuery(z.query.issues.limit(10), true);
```

### 2. SolidJS Hook
```javascript
import { useQuery } from '@rocicorp/zero/solid';

const [data] = useQuery(
  () => z.query.issues.where('status', 'open'),
  { ttl: '2m' }
);
```

### 3. Query Materialization
```javascript
// Basic materialization
const view = query.materialize('10m');

// Custom factory
const view = query.materialize(createViewFactory(setState), '5s');

// Update TTL dynamically
view.updateTTL('1h');
view.destroy();
```

### 4. Query Preloading
```javascript
// Preload with TTL
const {cleanup, complete} = query.preload({
  ttl: '15m'
});

await complete;
cleanup();
```

## Non-Reactive Methods

### 1. TTL Utilities
```javascript
import { parseTTL, compareTTL, clampTTL } from '@rocicorp/zero/zql';

// Parse TTL to milliseconds
const ms = parseTTL('5m'); // 300000

// Compare TTLs
const comparison = compareTTL('1h', '30m'); // 1

// Clamp TTL to server limits (max 10m)
const clamped = clampTTL('1h'); // 600000 (10m)
```

### 2. Cache Management
```javascript
import { TimedCache } from '@rocicorp/zero/shared';

// Create TTL-based cache
const cache = new TimedCache(300000); // 5 minutes
cache.set('key', value);
const cached = cache.get('key'); // undefined if expired
```

## Common Integration Patterns

### Custom Framework Integration
```javascript
// For custom web frameworks
function createCustomZeroHook(query, options = {}) {
  const ttl = options.ttl || '1s';
  
  // Ensure TTL is valid type
  if (typeof ttl !== 'string' && typeof ttl !== 'number') {
    throw new Error('TTL must be string like "5m" or number in ms');
  }
  
  const view = query.materialize(ttl);
  
  // Your framework's reactivity
  const [data, setData] = yourFramework.createState(view.data);
  
  const cleanup = view.addListener(setData);
  
  return [data, () => {
    cleanup();
    view.destroy();
  }];
}
```

### Server-side TTL Management
```javascript
// Server operations (non-reactive)
class QueryManager {
  updateQuery(hash, ttl) {
    // Clamp TTL for server limits
    const clampedTTL = clampTTL(ttl);
    
    // Store in database (convert ms to seconds)
    this.db.execute(`
      UPDATE queries 
      SET ttl = ${clampedTTL / 1000}
      WHERE hash = ${hash}
    `);
  }
}
```

## Best Practices

1. **Always use string format**: `'5m'` instead of `300000`
2. **Validate TTL values**: Check type before passing to Zero APIs
3. **Consider server limits**: Max TTL is `'10m'` (600,000ms)
4. **Use appropriate defaults**: `'1s'` for queries, `'5s'` for preloading
5. **Handle cleanup**: Always call `cleanup()` or `destroy()` methods

## Fixing Your Integration

```javascript
// ❌ This causes 'ttl.slice is not a function'
const badTTL = undefined;
const view = query.materialize(badTTL);

// ✅ Correct approach
const ttl = options.ttl || '1s'; // Provide valid default
const view = query.materialize(ttl);

// ✅ Validate before use
function safeMaterialize(query, ttl = '1s') {
  if (ttl && typeof ttl !== 'string' && typeof ttl !== 'number') {
    throw new Error(`Invalid TTL: ${ttl}. Use string like '5m' or number in ms`);
  }
  return query.materialize(ttl);
}
```

The key is ensuring TTL parameters are always valid `TTL` type values, not `undefined` or other types that would cause the `slice` error.