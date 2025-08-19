# Legacy Stimulus Controller Migration Guide

## Overview

This document provides reference information for migrating legacy Stimulus controllers to Svelte. **DO NOT use these patterns for new code.**

## Stimulus Controller Pattern (DEPRECATED)

### Basic Controller Structure
```javascript
// app/javascript/controllers/client_filter_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "results", "count"]
  static values = { 
    url: String,
    minChars: { type: Number, default: 3 }
  }
  
  connect() {
    this.performFilter = debounce(this.performFilter.bind(this), 300)
  }
  
  filter() {
    const query = this.inputTarget.value
    
    if (query.length < this.minCharsValue) {
      this.clearResults()
      return
    }
    
    this.performFilter(query)
  }
  
  async performFilter(query) {
    try {
      const response = await fetch(`${this.urlValue}?query=${query}`)
      const html = await response.text()
      this.resultsTarget.innerHTML = html
      this.updateCount()
    } catch (error) {
      console.error("Filter error:", error)
      this.showError()
    }
  }
}
```

### Equivalent Svelte Component
```svelte
<!-- frontend/src/lib/components/ClientFilter.svelte -->
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { debounce } from '$lib/utils/debounce';
  
  export let url: string;
  export let minChars: number = 3;
  
  let query = '';
  let debouncedQuery = '';
  
  // Debounce the query
  const updateDebouncedQuery = debounce((value: string) => {
    debouncedQuery = value;
  }, 300);
  
  $: if (query.length >= minChars) {
    updateDebouncedQuery(query);
  } else {
    debouncedQuery = '';
  }
  
  // Reactive query
  $: searchQuery = createQuery({
    queryKey: ['clients', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < minChars) {
        return [];
      }
      const response = await fetch(`${url}?query=${debouncedQuery}`);
      if (!response.ok) throw new Error('Filter failed');
      return response.json();
    },
    enabled: !!debouncedQuery
  });
</script>

<div class="client-filter">
  <input 
    type="text" 
    bind:value={query}
    placeholder="Search clients..."
    class="form-input"
  />
  
  <div class="results">
    {#if $searchQuery.isLoading}
      <div class="loading">Searching...</div>
    {:else if $searchQuery.error}
      <div class="error">Failed to load results. Please try again.</div>
    {:else if $searchQuery.data}
      {#each $searchQuery.data as client}
        <div class="client-item">{client.name}</div>
      {/each}
      <div class="count">{$searchQuery.data.length} results</div>
    {/if}
  </div>
</div>
```

## Migration Checklist

When migrating a Stimulus controller:

1. **Convert controller class to Svelte component**
   - `app/javascript/controllers/client_filter_controller.js` → `frontend/src/lib/components/ClientFilter.svelte`

2. **Convert targets to reactive variables**
   - `static targets = ["input"]` → `let query = ''`

3. **Convert values to props**
   - `static values = { url: String }` → `export let url: string`

4. **Convert methods to reactive statements**
   - `performFilter()` → `$: searchQuery = createQuery(...)`

5. **Convert DOM manipulation to Svelte reactivity**
   - `this.resultsTarget.innerHTML = html` → `{#each results as item}`

6. **Convert event listeners to Svelte events**
   - `data-action="input->client-filter#filter"` → `on:input`

7. **Update all HTML references**
   - Remove `data-controller` attributes
   - Add Svelte component usage

## Common Stimulus Patterns

### Target Access
```javascript
// Stimulus (OLD)
this.inputTarget.value
this.resultsTarget.innerHTML = html

// Svelte (NEW)
let inputValue = '';
let results = [];
```

### Value Parameters
```javascript
// Stimulus (OLD)
static values = { url: String, minChars: Number }
this.urlValue
this.minCharsValue

// Svelte (NEW)
export let url: string;
export let minChars: number = 3;
```

### Event Handling
```html
<!-- Stimulus (OLD) -->
<input data-action="input->client-filter#filter">

<!-- Svelte (NEW) -->
<input on:input={handleFilter}>
```

### Lifecycle Methods
```javascript
// Stimulus (OLD)
connect() {
  // Setup
}
disconnect() {
  // Cleanup
}

// Svelte (NEW)
import { onMount } from 'svelte';

onMount(() => {
  // Setup
  return () => {
    // Cleanup
  };
});
```

### Data Fetching
```javascript
// Stimulus (OLD)
async performFilter(query) {
  const response = await fetch(`${this.urlValue}?query=${query}`);
  const html = await response.text();
  this.resultsTarget.innerHTML = html;
}

// Svelte (NEW)
$: searchQuery = createQuery({
  queryKey: ['search', query],
  queryFn: () => api.search(query),
  enabled: !!query
});
```

## Reference Links

- [Stimulus Handbook](https://stimulus.hotwired.dev/handbook/introduction) - Original framework docs
- [Svelte Migration Stories](../stories/backlog/soon/svelte-migration-stories.md) - Implementation progress
- [Frontend Architecture](../architecture/frontend-architecture.md) - Current Svelte patterns