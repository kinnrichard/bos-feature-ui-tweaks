# Development Tools

## CSRF Debug Panel

A visual debugging tool for CSRF token management during development.

### Usage

Add to your main layout component during development:

```svelte
<script>
  import CsrfDebugPanel from '$lib/components/dev/CsrfDebugPanel.svelte';
</script>

<!-- Your app content -->

<!-- Only shows in development mode -->
<CsrfDebugPanel />
```

### Features

- **Real-time token status** - Shows token state with color coding
- **Proactive monitoring** - Updates every second to show token lifecycle
- **Manual controls** - Force refresh or clear tokens for testing
- **Debug tips** - Built-in guidance for troubleshooting

### Status Colors

- 🔴 **Red**: No token (check authentication)
- 🟠 **Orange**: Stale token (will refresh automatically)  
- 🟡 **Yellow**: Refresh needed soon
- 🟢 **Green**: Fresh token, all good!

### Console Debugging

In browser console, run:
```javascript
csrfDebug() // Shows detailed token state
```

### Testing CSRF Scenarios

Use the debug panel to test:

1. **Token expiry**: Wait 4+ minutes and watch auto-refresh
2. **Token clearing**: Click "Clear Token" and make a request
3. **Race conditions**: Open multiple tabs and make simultaneous requests
4. **Error recovery**: Force refresh after clearing token

This eliminates the need to constantly debug CSRF issues during development!