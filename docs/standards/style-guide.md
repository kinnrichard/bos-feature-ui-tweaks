# bŏs Style Guide
*Based on Apple Human Interface Guidelines for macOS*

## Core Principles

### Clarity
- Prioritize legibility and comprehension
- Use SF Pro for all text
- Maintain consistent information hierarchy

### Deference
- Content comes first, UI recedes
- Minimize chrome and ornamentation
- Use subtle animations and transitions

### Depth
- Use translucency and vibrancy for layering
- Shadows indicate hierarchy and interactivity
- Maintain visual consistency with macOS

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif;
```

### Type Scale
```css
/* Display */
.text-display { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }

/* Title 1 */
.text-title1 { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }

/* Title 2 */
.text-title2 { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }

/* Title 3 */
.text-title3 { font-size: 15px; font-weight: 600; }

/* Body */
.text-body { font-size: 13px; font-weight: 400; line-height: 1.5; }

/* Caption */
.text-caption { font-size: 11px; font-weight: 400; }
```

## Colors

### System Colors (Light Mode)
```css
/* Backgrounds */
--color-bg-primary: #ffffff;
--color-bg-secondary: #f5f5f7;
--color-bg-tertiary: #e8e8ed;

/* Text */
--color-text-primary: #1d1d1f;
--color-text-secondary: #86868b;
--color-text-tertiary: #c7c7cc;

/* Interactive */
--color-accent: #007AFF;       /* Blue */
--color-success: #34C759;      /* Green */
--color-warning: #FF9500;      /* Orange */
--color-error: #FF3B30;        /* Red */

/* Borders */
--color-border: rgba(0, 0, 0, 0.1);
--color-border-focused: var(--color-accent);
```

### Semantic Colors
```css
/* Status Indicators */
--color-status-scheduled: #8E8E93;
--color-status-active: #007AFF;
--color-status-completed: #34C759;
--color-status-error: #FF3B30;
```

## Spacing

Based on 4px grid:
```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 20px;
--spacing-2xl: 24px;
--spacing-3xl: 32px;
```

## Components

### Buttons

#### Primary Button
```svelte
<button class="btn-primary">
  Save Changes
</button>

<style>
.btn-primary {
  background: var(--color-accent);
  color: white;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: default;
  user-select: none;
}

.btn-primary:hover {
  background: #0051D5;
}

.btn-primary:active {
  background: #0041A8;
}
</style>
```

#### Secondary Button
```svelte
<button class="btn-secondary">
  Cancel
</button>

<style>
.btn-secondary {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text-primary);
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--color-border);
}
</style>
```

### Cards

```svelte
<div class="card">
  <h3 class="card-title">Job Title</h3>
  <p class="card-body">Job description...</p>
</div>

<style>
.card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--spacing-lg);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.15s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
```

### Form Elements

#### Text Input
```svelte
<input type="text" class="input" placeholder="Enter job title...">

<style>
.input {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 13px;
  width: 100%;
  transition: border-color 0.15s ease;
}

.input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}
</style>
```

### Popovers & Menus

```svelte
<div class="popover">
  <div class="popover-content">
    <!-- Content -->
  </div>
</div>

<style>
.popover {
  position: absolute;
  z-index: 1000;
}

.popover-content {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  padding: var(--spacing-sm);
  min-width: 200px;
}
</style>
```

## Animation

### Timing Functions
```css
--ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);
--spring: cubic-bezier(0.5, 1.3, 0.7, 1);
```

### Durations
```css
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 350ms;
```

### Common Animations
```css
/* Fade */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Scale */
@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.95);
  }
  to { 
    opacity: 1;
    transform: scale(1);
  }
}

/* Slide */
@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(10px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Icons

Use SF Symbols where possible:
- Consistent weight and size
- Support for all rendering modes
- Perfect alignment with text

Fallback to custom SVG icons that match SF Symbol metrics:
```svelte
<svg class="icon" width="16" height="16" viewBox="0 0 16 16">
  <!-- Icon path -->
</svg>

<style>
.icon {
  fill: currentColor;
  vertical-align: text-bottom;
}
</style>
```

## Layout Patterns

### Sidebar + Content
```svelte
<div class="layout">
  <aside class="sidebar">
    <!-- Navigation -->
  </aside>
  <main class="content">
    <!-- Main content -->
  </main>
</div>

<style>
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  height: 100vh;
}

.sidebar {
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  padding: var(--spacing-lg);
}

.content {
  background: var(--color-bg-primary);
  padding: var(--spacing-2xl);
  overflow-y: auto;
}
</style>
```

## Accessibility

- Maintain 4.5:1 contrast ratio for normal text
- Provide keyboard navigation for all interactions
- Use semantic HTML elements
- Include ARIA labels for complex components
- Support VoiceOver navigation

## Platform Integration

- Support keyboard shortcuts in a way that feels worthy of a native app
- Use native-feeling drag and drop
- Build with a target of eventually making a progressive web app with offline support