# Chromeless UI Pattern - Developer Guide

## Overview

The **Chromeless UI Pattern** is a design system approach implemented in the BOS frontend that creates clean, borderless input components with subtle focus states. This pattern was first established in the `EditableTitle` component and has been extended to the `ChromelessInput` component for broader use.

## Design Philosophy

### Core Principles
- **Minimalist Aesthetic**: Remove visual chrome (borders, backgrounds) by default
- **Subtle Interaction**: Focus states provide clear feedback without being jarring
- **Layout Stability**: Prevent layout shifts when focus states change
- **Accessibility First**: Maintain full accessibility compliance while achieving clean design

### Visual Characteristics
- **Default State**: Transparent background, no borders, inherit text styling
- **Focus State**: Subtle background color change with inset shadow (focus ring)
- **Responsive Design**: Adapts gracefully across all screen sizes
- **High Contrast Support**: Provides fallback outlines for accessibility

## Implementation

### ChromelessInput Component

**Location**: `/frontend/src/lib/components/ui/ChromelessInput.svelte`

#### Key Features
- **Comprehensive Props**: Supports all standard HTML input attributes
- **Event Handling**: Full event callback support (input, change, focus, blur, keyboard)
- **Programmatic Control**: Public methods for focus(), blur(), select()
- **Auto-focus Support**: Optional auto-focus with proper timing
- **Accessibility**: Complete ARIA support, high contrast mode, reduced motion

#### Usage Example

```svelte
<script>
  import ChromelessInput from '$lib/components/ui/ChromelessInput.svelte';
  
  let value = '';
</script>

<!-- Basic usage -->
<ChromelessInput
  bind:value
  placeholder="Enter your name"
  autoFocus
/>

<!-- Advanced usage with custom styling -->
<ChromelessInput
  bind:value
  placeholder="Job title"
  customClass="title-input"
  type="text"
  required
  ariaLabel="Job title input"
  oninput={handleInput}
  onfocus={handleFocus}
/>
```

#### Custom Styling

```css
/* Example custom styling for different field types */
:global(.name-input) {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  padding: 8px 16px;
  margin: -8px -16px;
}

:global(.title-input) {
  font-size: 18px;
  font-weight: 400;
  text-align: center;
  color: var(--text-secondary);
  padding: 6px 16px;
  margin: -6px -16px;
}
```

## Technical Implementation Details

### Focus Ring Pattern

The chromeless pattern uses the `focus-ring-tight` mixin to create a subtle inset shadow:

```scss
.chromeless-input {
  /* Prevent layout shift when focus ring appears */
  padding: 3px 8px;
  margin: -3px -8px;
  border-radius: 4px;
  
  /* Smooth transitions */
  transition: background-color var(--duration-fast, 150ms) var(--easing-smooth, ease);
}

.chromeless-input:focus {
  background-color: rgba(0, 0, 0, 0.9);
  /* focus-ring-tight mixin applies inset shadow */
}
```

### Layout Shift Prevention

**Problem**: Focus rings and background changes can cause layout shifts
**Solution**: Pre-apply padding and use negative margins to compensate

```css
/* The padding/margin pattern prevents layout shift */
padding: 3px 8px;    /* Space for focus ring */
margin: -3px -8px;   /* Compensate to maintain original size */
```

### Accessibility Considerations

1. **High Contrast Mode**: Provides fallback outline for users with high contrast preferences
2. **Reduced Motion**: Respects user's motion preferences by disabling transitions
3. **Screen Readers**: Full ARIA support with labels and descriptions
4. **Keyboard Navigation**: Proper focus management and programmatic control

```css
/* High contrast mode support */
@media (prefers-contrast: high) {
  .chromeless-input:focus {
    outline: 2px solid var(--accent-blue);
    outline-offset: 1px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .chromeless-input {
    transition: none;
  }
}
```

## Design System Integration

### Color Variables

The pattern uses CSS custom properties for consistent theming:

```css
--text-primary: Main text color
--text-secondary: Secondary text color  
--text-tertiary: Placeholder text color
--accent-blue: Focus outline color (high contrast)
--duration-fast: Animation duration (150ms)
--easing-smooth: Animation easing function
```

### Focus Ring Mixin

**Location**: `/frontend/src/lib/styles/focus-ring.scss`

The `focus-ring-tight` mixin provides the inset shadow effect:

```scss
@mixin focus-ring-tight {
  box-shadow: inset 0 0 0 2px rgba(var(--accent-blue-rgb), 0.3);
}
```

## Use Cases

### When to Use Chromeless Pattern

✅ **Good Use Cases**:
- Form fields in clean, minimal interfaces
- Inline editing components (like EditableTitle)
- Dashboard inputs where visual noise should be minimized
- Mobile-first responsive forms

✅ **Design Goals Achieved**:
- Reduce visual clutter
- Create modern, clean aesthetics  
- Maintain accessibility standards
- Provide subtle but clear interaction feedback

### When NOT to Use

❌ **Avoid When**:
- Complex forms with many validation states
- Interfaces where field boundaries need to be very clear
- Forms with complex labeling requirements
- Context where users might not understand where to click

## Component Architecture

### Props Interface

```typescript
interface Props {
  // Basic input attributes
  value?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'url' | 'tel' | 'search';
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  
  // HTML attributes
  id?: string;
  name?: string;
  autocomplete?: string;
  maxlength?: number;
  pattern?: string;
  title?: string;
  
  // Accessibility
  ariaLabel?: string;
  ariaDescribedby?: string;
  
  // Customization
  customClass?: string;
  autoFocus?: boolean;
  selectOnFocus?: boolean;
  
  // Event callbacks
  oninput?: (event: Event) => void;
  onchange?: (event: Event) => void;
  onfocus?: (event: FocusEvent) => void;
  onblur?: (event: FocusEvent) => void;
  onkeydown?: (event: KeyboardEvent) => void;
  onkeyup?: (event: KeyboardEvent) => void;
  onkeypress?: (event: KeyboardEvent) => void;
}
```

### State Management

The component uses Svelte 5 reactive patterns:

```typescript
let inputElement = $state<HTMLInputElement>();
let hasFocus = $state(false);
let hasAutoFocused = $state(false);

// Auto-focus effect
$effect(() => {
  if (autoFocus && inputElement && !hasFocus && !hasAutoFocused) {
    requestAnimationFrame(() => {
      inputElement?.focus();
      hasAutoFocused = true;
    });
  }
});
```

## Testing Considerations

### Visual Regression Testing
- Test focus states across different browsers
- Verify no layout shifts occur on focus/blur
- Check mobile responsive behavior

### Accessibility Testing
- Screen reader compatibility
- Keyboard navigation flow
- High contrast mode appearance
- Color contrast ratios

### Functional Testing
- All event callbacks work correctly
- Programmatic methods (focus, blur, select) function
- Auto-focus behavior is reliable
- Value binding works bidirectionally

## Example Implementation: New Contact Page

**Location**: `/frontend/src/routes/(authenticated)/clients/[id]/people/new/+page.svelte`

The New Contact page demonstrates the chromeless pattern in a real-world application:

```svelte
<!-- Name Field - Large, prominent -->
<ChromelessInput
  id="name"
  bind:value={formData.name}
  placeholder="Full name"
  customClass="name-input"
  required
  autoFocus
/>

<!-- Title Field - Secondary -->
<ChromelessInput
  id="title"
  bind:value={formData.title}
  placeholder="Job title or role"
  customClass="title-input"
/>

<!-- Contact Methods - Multiple instances -->
{#each contactMethods as method, index (method.id)}
  <ChromelessInput
    bind:value={method.value}
    placeholder={index === 0 ? "Email or phone" : "Address or other contact method"}
    customClass="contact-input"
    type="text"
    ariaLabel={`Contact method ${index + 1}`}
  />
{/each}
```

## Performance Considerations

### Optimization Strategies
- **CSS Transitions**: Kept minimal (150ms) for smooth but not sluggish feedback
- **Event Handling**: Efficient event delegation without unnecessary re-renders
- **DOM Manipulation**: Uses Svelte's reactive system for optimal updates
- **Memory Management**: Proper cleanup of event listeners and effects

### Bundle Impact
- **Size**: Minimal CSS footprint (~2KB compressed)
- **Dependencies**: Only requires focus-ring SCSS mixin
- **Runtime**: No significant JavaScript overhead

## Migration Guide

### From Traditional Form Inputs

1. **Replace input elements**:
   ```svelte
   <!-- Before -->
   <input type="text" bind:value placeholder="Name" />
   
   <!-- After -->
   <ChromelessInput bind:value placeholder="Name" />
   ```

2. **Add custom styling**:
   ```css
   /* Apply appropriate sizing and alignment */
   :global(.chromeless-input) {
     font-size: 16px;
     text-align: center;
   }
   ```

3. **Test focus behavior**:
   - Verify no layout shifts
   - Check accessibility with screen readers
   - Test keyboard navigation

### From EditableTitle Pattern

ChromelessInput is designed to be compatible with the EditableTitle pattern:

```svelte
<!-- Can replace EditableTitle in form contexts -->
<ChromelessInput
  bind:value={title}
  placeholder="Click to edit"
  customClass="editable-title-style"
  selectOnFocus
/>
```

## Future Enhancements

### Planned Improvements
1. **Validation Integration**: Built-in validation state styling
2. **Loading States**: Spinner integration for async operations
3. **Multi-line Support**: Textarea variant with same chromeless design
4. **Icon Support**: Prefix/suffix icon integration
5. **Group Variants**: Support for input groups and compound fields

### Design System Evolution
- Consider expanding to other form controls (select, textarea)
- Evaluate integration with form validation libraries
- Explore animation enhancements for state transitions

---

## Quick Reference

### Import
```typescript
import ChromelessInput from '$lib/components/ui/ChromelessInput.svelte';
```

### Basic Usage
```svelte
<ChromelessInput bind:value placeholder="Enter text" />
```

### With Custom Styling
```svelte
<ChromelessInput
  bind:value
  placeholder="Large input"
  customClass="large-input"
/>
```

### Programmatic Control
```svelte
<script>
  let inputRef;
  
  function focusInput() {
    inputRef?.focus();
  }
</script>

<ChromelessInput bind:this={inputRef} bind:value />
<button onclick={focusInput}>Focus Input</button>
```

---

**Pattern Author**: Documented August 2, 2025  
**Implementation**: New Contact Page Redesign Epic  
**Design System**: BOS Frontend Design System  
**Accessibility**: WCAG 2.1 AA Compliant