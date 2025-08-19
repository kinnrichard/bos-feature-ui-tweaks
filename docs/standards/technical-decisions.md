# Technical Decisions

## Frontend Framework: Svelte

### Why Svelte Over React/Vue

**Conciseness**: Svelte components are significantly more concise than React equivalents:
```svelte
<!-- Svelte -->
<script>
  let count = 0;
</script>

<button on:click={() => count++}>
  Clicked {count} times
</button>
```

vs React's verbose equivalent:
```jsx
// React
import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  );
}
```

**DRY Principles**: 
- No virtual DOM overhead
- Built-in reactivity without hooks or refs
- Two-way binding with minimal syntax
- Scoped styles by default
- No prop drilling - built-in context API

**Modern Architecture**:
- Compile-time optimizations
- Near-zero runtime overhead
- Native web platform alignment
- Built-in stores for state management
- First-class TypeScript support

## Browser Support

**Target**: Safari on latest macOS only
- Simplifies development significantly
- Enables use of latest web APIs without polyfills
- Perfect CSS Grid/Flexbox support
- Native ES modules
- No IE11/legacy browser support
- Happy to use features that only modern browers support
- Will eventually support Chrome and Edge, but it's not a target while in beta

## Authentication Strategy

**HttpOnly Cookies with JWT**:
- Prevents XSS attacks (tokens not accessible via JS)
- Automatic inclusion in requests
- Secure flag for HTTPS only
- SameSite=Strict for CSRF protection
- Refresh token rotation for enhanced security

## Offline Sync Architecture

**Field-Level Operational Transform**:
- Track individual field changes, not entire documents
- Three-way merge with common ancestor
- Conflict resolution based on field type
- Full audit trail for debugging
- Server-side conflict logging for future improvements

## State Management

**Svelte + Zero.js via custom ReactiveRecord layer

## Testing Strategy

**Vitest + Playwright**:
- Vitest for unit/component tests (faster than Jest)
- Playwright for E2E tests
- Contract testing for API boundaries
- Visual regression with Playwright
- 80% coverage target

## Performance Targets

- Initial load: < 3s on 3G
- Interaction response: < 100ms
- Lighthouse score: > 90 all categories
- Bundle size: No artificial limits, rely on code splitting

## Development Principles

1. **Apple-First Design**: Largely follow macOS HIG 
2. **Offline-First**: Every feature must work offline
3. **Type Safety**: TypeScript everywhere
4. **Component-Driven**: Small, focused components
5. **Performance-First**: Optimize for speed and responsiveness