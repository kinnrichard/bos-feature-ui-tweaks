# Debug System Quick Start

## Convert console.log to Secure Debug Functions

### Replace console statements:
```javascript
// OLD (insecure, not filterable)
console.log('API request:', { url, password: 'secret' });
console.warn('Slow query:', { sql, duration });
console.error('Login failed:', error);

// NEW (secure, filterable by category)
import { debugNetwork, debugData } from '$lib/utils/debug';
debugNetwork.api('API request:', { url, password: 'secret' }); // auto-redacted
debugData.database.warn('Slow query:', { sql, duration });
debugNetwork.auth.error('Login failed:', error);
```

### Pick the right category:
- `debugNetwork` - API, auth, security, websockets
- `debugData` - database, cache, validation, state  
- `debugUI` - components, navigation, notifications
- `debugBusiness` - workflows, search, uploads
- `debugMonitor` - performance, errors