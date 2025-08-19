# Legacy Phlex Component Migration Guide

## Overview

This document provides reference information for migrating legacy Phlex components to Svelte. **DO NOT use these patterns for new code.**

## Phlex Component Pattern (DEPRECATED)

### Basic Component Structure
```ruby
# app/views/components/button_component.rb
module Components
  class ButtonComponent < ApplicationComponent
    def initialize(text:, variant: :primary, size: :medium, **options)
      @text = text
      @variant = variant
      @size = size
      @options = options
    end
    
    def view_template
      button(
        class: button_classes,
        data: data_attributes,
        **@options
      ) { @text }
    end
    
    private
    
    def button_classes
      tokens(
        "button",
        variant_class,
        size_class,
        @options[:class]
      )
    end
  end
end
```

### Equivalent Svelte Component
```svelte
<!-- frontend/src/lib/components/ui/Button.svelte -->
<script lang="ts">
  export let text: string;
  export let variant: 'primary' | 'secondary' | 'danger' = 'primary';
  export let size: 'small' | 'medium' | 'large' = 'medium';
  
  $: classes = `
    px-4 py-2 rounded-md font-medium
    ${variant === 'primary' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}
    ${variant === 'secondary' ? 'bg-gray-200 hover:bg-gray-300 text-gray-900' : ''}
    ${size === 'small' ? 'text-sm px-3 py-1' : ''}
    ${size === 'large' ? 'text-lg px-6 py-3' : ''}
  `.trim();
</script>

<button class={classes} on:click {...$$restProps}>
  {text}
</button>
```

## Migration Checklist

When migrating a Phlex component:

1. **Convert Ruby class to Svelte file**
   - `app/views/components/button_component.rb` → `frontend/src/lib/components/ui/Button.svelte`

2. **Convert instance variables to props**
   - `@text` → `export let text: string`

3. **Convert methods to reactive statements**
   - `def button_classes` → `$: classes = ...`

4. **Convert CSS classes to Tailwind utilities**
   - `.button--primary` → `bg-blue-500 hover:bg-blue-600`

5. **Convert data attributes to Svelte events**
   - `data: { action: "click" }` → `on:click`

6. **Update all references**
   - Remove from Rails views
   - Add to Svelte pages/components

## Common Phlex Patterns

### Conditional Rendering
```ruby
# Phlex (OLD)
def view_template
  if @show_icon
    span(class: "icon") { @icon }
  end
  span { @text }
end

# Svelte (NEW)
{#if showIcon}
  <span class="icon">{icon}</span>
{/if}
<span>{text}</span>
```

### Loops
```ruby
# Phlex (OLD)
def view_template
  ul do
    @items.each do |item|
      li { item.name }
    end
  end
end

# Svelte (NEW)
<ul>
  {#each items as item}
    <li>{item.name}</li>
  {/each}
</ul>
```

### Styling
```ruby
# Phlex (OLD)
def view_template
  div(class: "bg-gray-100 p-4 rounded") do
    # content
  end
end

# Svelte (NEW)
<div class="bg-gray-100 p-4 rounded">
  <!-- content -->
</div>
```

## Reference Links

- [Phlex Documentation](https://phlex.fun) - Original framework docs
- [Svelte Migration Stories](../stories/backlog/soon/svelte-migration-stories.md) - Implementation progress
- [Frontend Architecture](../architecture/frontend-architecture.md) - Current Svelte patterns