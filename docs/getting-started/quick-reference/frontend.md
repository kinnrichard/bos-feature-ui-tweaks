---
title: "Frontend Quick Reference"
description: "Essential frontend development reference for Svelte, TypeScript, and Tailwind"
last_updated: "2025-07-17"
status: "active"
category: "quick-reference"
tags: ["frontend", "svelte", "typescript", "tailwind", "cheat-sheet"]
---

# Frontend Quick Reference

> **Essential frontend development commands and patterns**

## 🚀 Essential Commands

### Development Server
```bash
# Start development server
cd frontend && npm run dev

# Start with specific port
npm run dev -- --port 3000

# Start with host binding
npm run dev -- --host 0.0.0.0
```

### Build and Deploy
```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Lint and format
npm run lint
npm run format
```

### Testing
```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in headed mode
npm run test:headed

# Run specific test file
npm test -- filename.spec.ts

# Debug tests
npm run test:debug
```

---

## 🔧 Svelte Component Patterns

### Basic Component Structure
```svelte
<script lang="ts">
  // Imports
  import { onMount, createEventDispatcher } from 'svelte';
  import type { ComponentType } from './types';
  
  // Props
  export let title: string;
  export let optional: boolean = false;
  
  // Event dispatcher
  const dispatch = createEventDispatcher<{
    click: { id: string };
    change: { value: string };
  }>();
  
  // Local state
  let count = 0;
  
  // Reactive statements
  $: doubled = count * 2;
  $: if (count > 10) {
    console.log('Count is high!');
  }
  
  // Lifecycle
  onMount(() => {
    console.log('Component mounted');
  });
  
  // Functions
  function handleClick() {
    dispatch('click', { id: 'button' });
  }
</script>

<div class="component">
  <h1>{title}</h1>
  <button on:click={handleClick}>
    Count: {count}
  </button>
  {#if optional}
    <p>Optional content</p>
  {/if}
</div>

<style>
  .component {
    /* Component styles */
  }
</style>
```

### Conditional Rendering
```svelte
<!-- If/else -->
{#if user}
  <p>Welcome {user.name}!</p>
{:else}
  <p>Please log in</p>
{/if}

<!-- Multiple conditions -->
{#if loading}
  <LoadingSpinner />
{:else if error}
  <ErrorMessage {error} />
{:else}
  <UserProfile {user} />
{/if}
```

### Lists and Loops
```svelte
<!-- Basic loop -->
{#each items as item}
  <div>{item.name}</div>
{/each}

<!-- With index -->
{#each items as item, index}
  <div>{index}: {item.name}</div>
{/each}

<!-- With key for optimization -->
{#each items as item (item.id)}
  <ItemCard {item} />
{/each}

<!-- Empty state -->
{#each items as item}
  <div>{item.name}</div>
{:else}
  <p>No items found</p>
{/each}
```

### Event Handling
```svelte
<!-- Click events -->
<button on:click={handleClick}>Click me</button>
<button on:click={() => count++}>Increment</button>

<!-- Event modifiers -->
<button on:click|preventDefault={handleClick}>No default</button>
<button on:click|stopPropagation={handleClick}>Stop propagation</button>
<button on:click|once={handleClick}>Once only</button>

<!-- Form events -->
<input on:input={handleInput} bind:value={inputValue} />
<form on:submit|preventDefault={handleSubmit}>
  <!-- form content -->
</form>

<!-- Custom events -->
<CustomComponent on:customEvent={handleCustomEvent} />
```

### Data Binding
```svelte
<!-- Text input -->
<input bind:value={text} />

<!-- Checkbox -->
<input type="checkbox" bind:checked={isChecked} />

<!-- Radio buttons -->
<input type="radio" bind:group={selected} value="option1" />
<input type="radio" bind:group={selected} value="option2" />

<!-- Select -->
<select bind:value={selected}>
  <option value="a">A</option>
  <option value="b">B</option>
</select>

<!-- Component props -->
<CustomComponent bind:value={componentValue} />
```

---

## 🎨 Tailwind CSS Patterns

### Layout
```html
<!-- Flexbox -->
<div class="flex items-center justify-between">
<div class="flex flex-col space-y-4">
<div class="flex flex-wrap gap-4">

<!-- Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
<div class="grid grid-cols-12 gap-4">

<!-- Container -->
<div class="container mx-auto px-4">
<div class="max-w-4xl mx-auto">
```

### Responsive Design
```html
<!-- Responsive utilities -->
<div class="w-full md:w-1/2 lg:w-1/3">
<div class="text-sm md:text-base lg:text-lg">
<div class="hidden md:block">
<div class="block md:hidden">

<!-- Responsive grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Common Button Styles
```html
<!-- Primary button -->
<button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500">
  Primary
</button>

<!-- Secondary button -->
<button class="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200 focus:ring-2 focus:ring-gray-500">
  Secondary
</button>

<!-- Disabled button -->
<button class="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg cursor-not-allowed" disabled>
  Disabled
</button>
```

### Form Styles
```html
<!-- Input field -->
<input class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />

<!-- Input with error -->
<input class="w-full px-3 py-2 border border-red-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-500" />

<!-- Select -->
<select class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
  <option>Option 1</option>
</select>
```

### Card Styles
```html
<!-- Basic card -->
<div class="bg-white rounded-lg shadow-md p-6">
  <h3 class="text-lg font-semibold mb-2">Card Title</h3>
  <p class="text-gray-600">Card content</p>
</div>

<!-- Card with hover effect -->
<div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
  Content
</div>
```

---

## 🔄 State Management

### Svelte Stores
```typescript
// stores/counter.ts
import { writable } from 'svelte/store';

export const count = writable(0);

export const increment = () => {
  count.update(n => n + 1);
};

export const decrement = () => {
  count.update(n => n - 1);
};

export const reset = () => {
  count.set(0);
};
```

### Using Stores in Components
```svelte
<script lang="ts">
  import { count, increment, decrement, reset } from '../stores/counter';
</script>

<div>
  <p>Count: {$count}</p>
  <button on:click={increment}>+</button>
  <button on:click={decrement}>-</button>
  <button on:click={reset}>Reset</button>
</div>
```

### Derived Stores
```typescript
// stores/derived.ts
import { writable, derived } from 'svelte/store';

export const firstName = writable('John');
export const lastName = writable('Doe');

export const fullName = derived(
  [firstName, lastName],
  ([$firstName, $lastName]) => `${$firstName} ${$lastName}`
);
```

---

## 🌐 API Integration

### Fetch Patterns
```typescript
// API client
class ApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`/api/v1${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }
  
  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();
```

### Loading States
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  
  let data = null;
  let loading = true;
  let error = null;
  
  onMount(async () => {
    try {
      data = await apiClient.get('/jobs');
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <LoadingSpinner />
{:else if error}
  <ErrorMessage {error} />
{:else}
  <DataDisplay {data} />
{/if}
```

---

## 🧪 Testing Patterns

### Component Testing
```typescript
// tests/components/Button.spec.ts
import { render, screen } from '@testing-library/svelte';
import Button from '../src/lib/components/Button.svelte';

test('renders button with text', () => {
  render(Button, { props: { text: 'Click me' } });
  
  const button = screen.getByRole('button', { name: 'Click me' });
  expect(button).toBeInTheDocument();
});

test('calls onClick when clicked', async () => {
  const mockClick = vi.fn();
  const { component } = render(Button, { props: { text: 'Click me' } });
  
  component.$on('click', mockClick);
  
  await screen.getByRole('button').click();
  
  expect(mockClick).toHaveBeenCalled();
});
```

### E2E Testing
```typescript
// tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('user can log in', async ({ page }) => {
  await page.goto('/login');
  
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('Welcome')).toBeVisible();
});
```

---

## 🐛 Troubleshooting

### Common Issues

#### Hydration Mismatch
```svelte
<!-- Problem: Server and client render differently -->
<p>Current time: {Date.now()}</p>

<!-- Solution: Use onMount for client-only code -->
<script>
  import { onMount } from 'svelte';
  let currentTime = '';
  
  onMount(() => {
    currentTime = Date.now();
  });
</script>

<p>Current time: {currentTime}</p>
```

#### Reactive Statement Issues
```svelte
<!-- Problem: Reactive statement not updating -->
$: result = expensiveCalculation(value);

<!-- Solution: Ensure dependencies are reactive -->
$: result = expensiveCalculation($store.value);
```

#### Store Subscriptions
```svelte
<!-- Problem: Memory leaks from unsubscribed stores -->
<script>
  import { onDestroy } from 'svelte';
  import { myStore } from './stores';
  
  let value;
  
  const unsubscribe = myStore.subscribe(val => {
    value = val;
  });
  
  onDestroy(() => {
    unsubscribe();
  });
</script>

<!-- Better: Use auto-subscription -->
<script>
  import { myStore } from './stores';
</script>

<p>Value: {$myStore}</p>
```

### Debug Tools

#### Console Logging
```svelte
<script>
  let value = 0;
  
  // Debug reactive statements
  $: console.log('Value changed:', value);
  
  // Debug in template
  $: {
    console.log('Current state:', { value, otherState });
  }
</script>
```

#### Svelte DevTools
```bash
# Install browser extension
# Chrome: Svelte DevTools
# Firefox: Svelte DevTools

# Enable in app
// app.html
<script>
  if (typeof window !== 'undefined') {
    window.__svelte = { version: '4.0.0' };
  }
</script>
```

---

## 💡 Pro Tips

### Performance Optimization
```svelte
<!-- Use key attribute for efficient list updates -->
{#each items as item (item.id)}
  <ItemComponent {item} />
{/each}

<!-- Avoid unnecessary reactivity -->
<script>
  // Problem: Runs on every component update
  $: expensiveCalculation(someValue);
  
  // Solution: Only run when specific values change
  $: if (specificValue) {
    expensiveCalculation(specificValue);
  }
</script>
```

### TypeScript Integration
```typescript
// Define component props interface
interface Props {
  title: string;
  optional?: boolean;
  items: Array<{ id: string; name: string }>;
}

// Use in component
export let title: Props['title'];
export let optional: Props['optional'] = false;
export let items: Props['items'];
```

### Accessibility
```svelte
<!-- Always include ARIA labels -->
<button aria-label="Close dialog" on:click={closeDialog}>×</button>

<!-- Use semantic HTML -->
<main>
  <article>
    <h1>Article Title</h1>
    <p>Article content</p>
  </article>
</main>

<!-- Keyboard navigation -->
<div
  role="button"
  tabindex="0"
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  Custom button
</div>
```

---

## 📚 Key Resources

### Official Documentation
- **[Svelte Documentation](https://svelte.dev/docs)** - Complete Svelte guide
- **[SvelteKit Documentation](https://kit.svelte.dev/docs)** - SvelteKit framework
- **[Tailwind Documentation](https://tailwindcss.com/docs)** - Utility-first CSS

### Tools and Extensions
- **[Svelte for VS Code](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)** - Official VS Code extension
- **[Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)** - Tailwind autocompletion
- **[Playwright](https://playwright.dev/)** - E2E testing framework

### Community Resources
- **[Svelte Society](https://sveltesociety.dev/)** - Community resources
- **[Svelte Discord](https://svelte.dev/chat)** - Community chat
- **[Awesome Svelte](https://github.com/TheComputerM/awesome-svelte)** - Curated resources

---

**Keep this reference handy for quick lookups during development!**

*This reference is updated regularly. Check back for new patterns and best practices.*