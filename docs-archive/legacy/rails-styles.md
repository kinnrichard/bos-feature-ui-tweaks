# Legacy Rails Styles Migration Guide

## Overview

This document provides reference information for migrating legacy Rails SCSS styles to Svelte + Tailwind. **DO NOT use these patterns for new code.**

## Legacy Design System (DEPRECATED)

### Color Palette (CSS Variables)
```scss
// app/assets/stylesheets/settings/_colors.scss
:root {
  // Background colors
  --bg-black: #000000;          // Main app background
  --bg-primary: #1C1C1E;        // Primary containers
  --bg-secondary: #1C1C1D;      // Secondary containers  
  --bg-tertiary: #3A3A3C;       // Hover states
  
  // Text colors
  --text-primary: #F2F2F7;      // Main text
  --text-secondary: #C7C7CC;    // Secondary text
  --text-tertiary: #8E8E93;     // Muted text
  
  // Accent colors
  --accent-blue: #00A3FF;       // Primary actions
  --accent-red: #FF453A;        // Danger/destructive
  --accent-green: #32D74B;      // Success states
}
```

### Equivalent Tailwind Configuration
```javascript
// frontend/tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        dark: {
          100: '#1C1C1E',  // Primary background
          200: '#1C1C1D',  // Secondary background
          300: '#3A3A3C',  // Tertiary/hover
        },
        text: {
          primary: '#F2F2F7',
          secondary: '#C7C7CC',
          tertiary: '#8E8E93',
        },
        blue: {
          500: '#00A3FF',  // Primary accent
          600: '#0089E0',  // Hover state
        },
        red: {
          500: '#FF453A',  // Danger
        },
        green: {
          500: '#32D74B',  // Success
        }
      }
    }
  }
};
```

## Migration Patterns

### Component Styles
```scss
// OLD: app/assets/stylesheets/components/_button.scss
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  font-size: 14px;
  border-radius: 6px;
  transition: all 0.15s ease;
  
  &--primary {
    background-color: var(--accent-blue);
    color: white;
    
    &:hover {
      background-color: var(--accent-blue-hover);
    }
  }
  
  &--secondary {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
  }
}

// NEW: Svelte component with Tailwind
<button class="
  inline-flex items-center justify-center
  px-4 py-2 text-sm rounded-md
  transition-colors duration-150
  {variant === 'primary' 
    ? 'bg-blue-500 hover:bg-blue-600 text-white' 
    : 'bg-dark-200 text-text-primary border border-dark-300'}
">
  {text}
</button>
```

### Layout Patterns
```scss
// OLD: SCSS with custom spacing
.container {
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
  gap: var(--space-xs);
}

// NEW: Tailwind utilities
<div class="p-4 mb-6 space-y-3">
  <!-- content -->
</div>
```

### Card Components
```scss
// OLD: SCSS card component
.job-card-inline {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 12px 16px;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: var(--bg-tertiary);
    border-color: var(--accent-blue);
  }
}

// NEW: Svelte component with Tailwind
<div class="
  bg-dark-200 border border-dark-300 rounded-lg
  p-4 transition-all duration-200
  hover:bg-dark-300 hover:border-blue-500
">
  <!-- content -->
</div>
```

## Migration Checklist

When migrating SCSS styles:

1. **Convert CSS variables to Tailwind theme**
   - `--bg-primary` → `bg-dark-100`
   - `--text-primary` → `text-text-primary`

2. **Convert BEM classes to utility classes**
   - `.button--primary` → `bg-blue-500 text-white`
   - `.card--highlighted` → `border-blue-500`

3. **Convert spacing variables to Tailwind spacing**
   - `var(--space-sm)` → `p-4`
   - `var(--space-md)` → `mb-6`

4. **Convert mixins to utility combinations**
   - `@include focus-ring` → `focus:outline-none focus:ring-2 focus:ring-blue-500`

5. **Remove SCSS files**
   - Delete from `app/assets/stylesheets/`
   - Update `application.scss` imports

## Common SCSS Patterns

### Responsive Design
```scss
// OLD: SCSS media queries
.component {
  padding: 1rem;
  
  @media (min-width: 768px) {
    padding: 2rem;
  }
}

// NEW: Tailwind responsive utilities
<div class="p-4 md:p-8">
```

### Hover States
```scss
// OLD: SCSS hover
.button {
  background-color: var(--accent-blue);
  
  &:hover {
    background-color: var(--accent-blue-hover);
  }
}

// NEW: Tailwind hover utilities
<button class="bg-blue-500 hover:bg-blue-600">
```

### Focus States
```scss
// OLD: SCSS focus mixin
@mixin focus-ring {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(0, 163, 255, 0.3);
}

// NEW: Tailwind focus utilities
<input class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
```

## Design Token Mapping

| Legacy Variable | Tailwind Class | Usage |
|-----------------|----------------|-------|
| `--bg-primary` | `bg-dark-100` | Primary background |
| `--bg-secondary` | `bg-dark-200` | Secondary background |
| `--bg-tertiary` | `bg-dark-300` | Hover states |
| `--text-primary` | `text-text-primary` | Main text |
| `--text-secondary` | `text-text-secondary` | Secondary text |
| `--accent-blue` | `bg-blue-500` | Primary actions |
| `--accent-red` | `bg-red-500` | Danger states |
| `--space-sm` | `p-4` | Standard padding |
| `--space-md` | `p-6` | Medium padding |

## Reference Links

- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Current framework docs
- [Frontend Architecture](../architecture/frontend-architecture.md) - Current Svelte patterns
- [Coding Standards](../architecture/coding-standards.md) - Updated style guidelines