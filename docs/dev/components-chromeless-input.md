# ChromelessInput Component Documentation

**Location**: `/frontend/src/lib/components/ui/ChromelessInput.svelte`  
**Pattern**: [Chromeless UI Pattern](./chromeless-ui-pattern.md)  
**Created**: August 2, 2025  
**Status**: Production Ready ✅

## Overview

ChromelessInput is a clean, borderless input component that provides subtle focus states while maintaining full accessibility. It implements the chromeless design pattern established by the EditableTitle component and extends it for general form use.

## Features

- ✅ **Chromeless Design**: No visible borders or chrome by default
- ✅ **Subtle Focus States**: Background color change with inset shadow focus ring
- ✅ **Layout Stability**: Prevents layout shift when focus states change
- ✅ **Full Accessibility**: ARIA support, high contrast mode, reduced motion
- ✅ **Event Handling**: Complete event callback support
- ✅ **Programmatic Control**: Public methods for focus(), blur(), select()
- ✅ **Auto-focus Support**: Optional auto-focus with proper timing
- ✅ **Responsive Design**: Mobile-first responsive behavior

## API Reference

### Props

```typescript
interface Props {
  // Input value (bindable)
  value?: string;
  
  // Basic input attributes
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
  
  // Behavior
  autoFocus?: boolean;          // Auto-focus on mount
  selectOnFocus?: boolean;      // Select all text when focused
  customClass?: string;         // Additional CSS classes
  
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

### Public Methods

```typescript
// Programmatically focus the input
export function focus(): void;

// Programmatically blur the input
export function blur(): void;

// Select all text in the input
export function select(): void;
```

## Usage Examples

### Basic Usage

```svelte
<script>
  import ChromelessInput from '$lib/components/ui/ChromelessInput.svelte';
  
  let name = '';
</script>

<ChromelessInput bind:value={name} placeholder="Enter your name" />
```

### Advanced Usage

```svelte
<script>
  import ChromelessInput from '$lib/components/ui/ChromelessInput.svelte';
  
  let email = '';
  let inputRef;
  
  function handleInput(event) {
    console.log('Input changed:', event.target.value);
  }
  
  function focusEmail() {
    inputRef?.focus();
  }
</script>

<ChromelessInput
  bind:this={inputRef}
  bind:value={email}
  type="email"
  placeholder="Enter email address"
  customClass="email-input"
  required
  autoFocus
  ariaLabel="Email address"
  oninput={handleInput}
/>

<button onclick={focusEmail}>Focus Email Field</button>
```

### Form Integration

```svelte
<script>
  import ChromelessInput from '$lib/components/ui/ChromelessInput.svelte';
  
  let formData = {
    name: '',
    title: '',
    email: ''
  };
  
  function handleSubmit() {
    console.log('Form submitted:', formData);
  }
</script>

<form onsubmit={handleSubmit}>
  <!-- Name field - large and prominent -->
  <ChromelessInput
    bind:value={formData.name}
    placeholder="Full name"
    customClass="name-input"
    required
    autoFocus
  />
  
  <!-- Title field - secondary -->
  <ChromelessInput
    bind:value={formData.title}
    placeholder="Job title"
    customClass="title-input"
  />
  
  <!-- Email field - standard -->
  <ChromelessInput
    bind:value={formData.email}
    type="email"
    placeholder="Email address"
    customClass="email-input"
    required
  />
</form>
```

## Styling

### Default CSS Classes

The component applies these CSS classes:

- `.chromeless-input`: Base styling
- `.focused`: Applied when input has focus
- `.disabled`: Applied when disabled
- `.readonly`: Applied when readonly
- `{customClass}`: Your custom class

### Custom Styling Examples

```css
/* Large name input */
:global(.name-input) {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  padding: 8px 16px;
  margin: -8px -16px;
}

/* Secondary title input */
:global(.title-input) {
  font-size: 18px;
  font-weight: 400;
  text-align: center;
  color: var(--text-secondary);
  padding: 6px 16px;
  margin: -6px -16px;
}

/* Standard contact input */
:global(.contact-input) {
  font-size: 16px;
  padding: 8px 12px;
  margin: -8px -12px;
}

/* Email input with icon space */
:global(.email-input) {
  padding-left: 32px;
  margin-left: -32px;
  background-image: url('/icons/email.svg');
  background-position: 8px center;
  background-repeat: no-repeat;
  background-size: 16px;
}
```

### Focus State Customization

```css
/* Custom focus background */
:global(.custom-input:focus) {
  background-color: rgba(59, 130, 246, 0.1); /* Blue tint */
}

/* Custom focus ring color */
:global(.custom-input) {
  --accent-blue: #3b82f6;
}
```

## Accessibility

### Built-in Accessibility Features

- **ARIA Support**: Full ARIA label and description support
- **High Contrast**: Automatic outline in high contrast mode
- **Reduced Motion**: Respects user's motion preferences
- **Keyboard Navigation**: Standard keyboard interaction
- **Screen Reader**: Proper announcements and state changes

### Accessibility Best Practices

```svelte
<!-- Always provide accessible labels -->
<ChromelessInput
  bind:value
  placeholder="Search products"
  ariaLabel="Product search input"
  ariaDescribedby="search-help"
/>
<div id="search-help">Enter product name or SKU</div>

<!-- Use appropriate input types -->
<ChromelessInput
  bind:value={email}
  type="email"
  placeholder="Email"
  ariaLabel="Email address"
  autocomplete="email"
/>

<!-- Required field indication -->
<ChromelessInput
  bind:value={name}
  placeholder="Full name"
  ariaLabel="Full name (required)"
  required
/>
```

## Performance

### Optimization Features

- **Efficient Reactivity**: Uses Svelte 5 $state and $effect
- **Minimal Re-renders**: Only updates when necessary
- **CSS Transitions**: Smooth 150ms transitions
- **Memory Management**: Proper cleanup of effects

### Bundle Impact

- **CSS Size**: ~2KB (compressed)
- **JS Size**: ~1KB (compressed)
- **Dependencies**: Only requires focus-ring SCSS mixin
- **Runtime**: Minimal performance overhead

## Testing

### Test Coverage

The component should be tested for:

- ✅ **Value Binding**: Bidirectional value updates
- ✅ **Event Handling**: All event callbacks work
- ✅ **Focus Management**: Auto-focus and programmatic control
- ✅ **Accessibility**: ARIA attributes and keyboard navigation
- ✅ **Styling**: Custom classes and focus states
- ✅ **Responsive**: Mobile and desktop behavior

### Example Test

```typescript
import { render, fireEvent } from '@testing-library/svelte';
import ChromelessInput from './ChromelessInput.svelte';

test('handles input changes', async () => {
  const { getByRole } = render(ChromelessInput, {
    placeholder: 'Test input'
  });
  
  const input = getByRole('textbox');
  await fireEvent.input(input, { target: { value: 'Hello' } });
  
  expect(input.value).toBe('Hello');
});

test('calls focus method', () => {
  const { component } = render(ChromelessInput);
  
  // Should not throw
  component.focus();
  component.blur();
  component.select();
});
```

## Common Patterns

### Dynamic Input Lists

```svelte
<script>
  let items = [
    { id: 1, value: '' },
    { id: 2, value: '' }
  ];
  
  function addItem() {
    items = [...items, { id: Date.now(), value: '' }];
  }
</script>

{#each items as item (item.id)}
  <div class="input-row">
    <ChromelessInput
      bind:value={item.value}
      placeholder="Enter value"
      customClass="list-input"
    />
    <button onclick={() => removeItem(item.id)}>Remove</button>
  </div>
{/each}

<button onclick={addItem}>Add Item</button>
```

### Conditional Styling

```svelte
<script>
  let value = '';
  let hasError = false;
  
  $: inputClass = hasError ? 'error-input' : 'normal-input';
</script>

<ChromelessInput
  bind:value
  placeholder="Enter value"
  customClass={inputClass}
  ariaDescribedby={hasError ? 'error-message' : undefined}
/>

{#if hasError}
  <div id="error-message" role="alert">
    Please enter a valid value
  </div>
{/if}
```

### Integration with Form Libraries

```svelte
<script>
  import { createForm } from 'felte';
  
  const { form, data, errors } = createForm({
    onSubmit: (values) => console.log(values),
    validate: (values) => ({
      email: !values.email?.includes('@') ? 'Invalid email' : null
    })
  });
</script>

<form use:form>
  <ChromelessInput
    name="email"
    type="email"
    placeholder="Email address"
    customClass={$errors.email ? 'error-input' : 'normal-input'}
    ariaDescribedby={$errors.email ? 'email-error' : undefined}
  />
  
  {#if $errors.email}
    <div id="email-error" role="alert">{$errors.email}</div>
  {/if}
</form>
```

## Migration Guide

### From Standard HTML Input

**Before**:
```svelte
<input
  type="text"
  bind:value
  placeholder="Name"
  class="form-input"
  on:input={handleInput}
/>
```

**After**:
```svelte
<ChromelessInput
  bind:value
  placeholder="Name"
  customClass="form-input chromeless-style"
  oninput={handleInput}
/>
```

### From EditableTitle

**Before**:
```svelte
<EditableTitle bind:value={title} />
```

**After**:
```svelte
<ChromelessInput
  bind:value={title}
  customClass="editable-title-style"
  selectOnFocus
/>
```

## Related Documentation

- [Chromeless UI Pattern Guide](./chromeless-ui-pattern.md)
- [Frontend Style Guide](../standards/style-guide.md)
- [Component Testing Strategy](../testing/zero-testing-strategy.md)
- [Accessibility Guidelines](../standards/accessibility.md)

---

**Component Version**: 1.0.0  
**Last Updated**: August 2, 2025  
**Maintained By**: Frontend Team  
**Design System**: BOS Frontend Design System