# Svelte Actions

This directory contains reusable Svelte actions that can be applied to DOM elements across the application.

## Available Actions

### `fixContentEditable`

**Purpose**: Fixes common contenteditable browser quirks and provides consistent behavior across all contenteditable elements.

**Features**:
- **Spellcheck Management**: Automatically manages spellcheck behavior to prevent visual clutter
- **Selection Clearing**: Clears text selection/cursor on blur to prevent insertion point persistence
- **Browser Compatibility**: Handles cross-browser contenteditable inconsistencies
- **Extensible**: Ready to handle future contenteditable browser quirks

**Behavior**:
- Sets `spellcheck="false"` by default (no spell check suggestions shown)
- Enables `spellcheck="true"` when element gains focus (spell check active during editing)
- Disables `spellcheck="false"` when element loses focus (spell check suggestions hidden)
- Clears text selection on blur to prevent cursor from remaining visible

**Usage**:
```svelte
<script>
  import { fixContentEditable } from '$lib/actions/fixContentEditable';
</script>

<!-- Apply to any contenteditable element -->
<div contenteditable="true" use:fixContentEditable>
  Editable content here
</div>

<!-- Works with any element type -->
<p contenteditable="true" use:fixContentEditable>Paragraph content</p>
<h1 contenteditable="true" use:fixContentEditable>Header content</h1>
<span contenteditable="true" use:fixContentEditable>Span content</span>
```

**Benefits**:
- **Comprehensive Fix**: Handles multiple contenteditable browser issues
- **Consistent Behavior**: Uniform experience across all contenteditable elements
- **Automatic Cleanup**: Proper event listener cleanup when elements are destroyed
- **Zero Configuration**: Just add the action - no manual focus/blur management needed
- **Universal Compatibility**: Works regardless of how element gains/loses focus

**Example Integration**:
```svelte
<script>
  import { fixContentEditable } from '$lib/actions/fixContentEditable';
  
  let content = "Edit me!";
</script>

<div 
  contenteditable="true" 
  use:fixContentEditable
  bind:textContent={content}
>
  {content}
</div>
```

**Important**: This action should be used on **all** contenteditable elements throughout the application to ensure consistent behavior and prevent browser quirks.