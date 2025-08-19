# Person Form Components

This module provides a unified person form architecture that consolidates the functionality from the original separate person forms into reusable components.

## Components

### PersonForm (Main Component)
The primary unified form component that handles all person form operations.

**Props:**
- `mode: 'create' | 'edit' | 'view'` - Form mode
- `person: PersonData | null` - Person data for edit/view modes
- `clientId: string` - Client ID for the person
- `loading: boolean` - Loading state
- `error: string | null` - Error message to display
- `showValidation: boolean` - Whether to show validation errors

**Events:**
- `save: { person, contactMethods, groupMemberships }` - Fired when form is saved
- `cancel: void` - Fired when form is cancelled
- `delete: { person }` - Fired when person is deleted

### PersonHeader
Handles the display and editing of person name, title, and avatar.

**Props:**
- `mode: 'create' | 'edit' | 'view'`
- `name, namePreferred, namePronunciationHint, title: string`
- `isActive: boolean`
- `avatarSrc: string`
- `dynamicWidthConfig: DynamicWidthConfig`
- `canDelete: boolean`
- `onDelete: () => void`

### ContactMethodsSection
Manages the collection of contact methods (email, phone, address).

**Props:**
- `mode: 'create' | 'edit' | 'view'`
- `contactMethods: Array<{ id, value, normalized }>`
- `onContactMethodsChange: (methods) => void`
- `dynamicWidthConfig: DynamicWidthConfig`
- `showValidation: boolean`

### ContactItem
Individual contact method display and editing.

**Props:**
- `value: string`
- `placeholder: string`
- `mode: 'create' | 'edit' | 'view'`
- `showValidation: boolean`
- `onInput, onBlur: (event) => void`

## Usage Examples

### Create Mode
```svelte
<script>
  import { PersonForm } from '$lib/components/person';
  
  let clientId = 'client-123';
  let loading = false;
  let error = null;
  
  function handleSave(event) {
    const { person, contactMethods, groupMemberships } = event.detail;
    // Handle save logic
    console.log('Person created:', person);
  }
  
  function handleCancel() {
    // Handle cancel logic
    console.log('Creation cancelled');
  }
</script>

<PersonForm
  mode="create"
  {clientId}
  {loading}
  {error}
  showValidation={true}
  on:save={handleSave}
  on:cancel={handleCancel}
/>
```

### Edit Mode
```svelte
<script>
  import { PersonForm } from '$lib/components/person';
  import { ReactivePerson } from '$lib/models/reactive-person';
  
  let personId = 'person-123';
  let clientId = 'client-123';
  
  const personQuery = $derived(ReactivePerson.includes('contactMethods').find(personId));
  const person = $derived(personQuery?.data);
  const loading = $derived(personQuery?.isLoading || false);
  
  function handleSave(event) {
    const { person, contactMethods, groupMemberships } = event.detail;
    // Handle save logic
    console.log('Person updated:', person);
  }
  
  function handleCancel() {
    // Handle cancel logic
    console.log('Edit cancelled');
  }
  
  function handleDelete(event) {
    const { person } = event.detail;
    // Handle delete logic
    console.log('Person deleted:', person);
  }
</script>

<PersonForm
  mode="edit"
  {person}
  {clientId}
  {loading}
  showValidation={true}
  on:save={handleSave}
  on:cancel={handleCancel}
  on:delete={handleDelete}
/>
```

### View Mode
```svelte
<script>
  import { PersonForm } from '$lib/components/person';
  import { ReactivePerson } from '$lib/models/reactive-person';
  
  let personId = 'person-123';
  let clientId = 'client-123';
  
  const personQuery = $derived(ReactivePerson.includes('contactMethods').find(personId));
  const person = $derived(personQuery?.data);
  const loading = $derived(personQuery?.isLoading || false);
  
  function handleDelete(event) {
    const { person } = event.detail;
    // Handle delete logic
    console.log('Person deleted:', person);
  }
</script>

<PersonForm
  mode="view"
  {person}
  {clientId}
  {loading}
  on:delete={handleDelete}
/>
```

## Features

### Dynamic Width Calculation
All input fields automatically resize to accommodate their content while maintaining a consistent width across all fields.

### Contact Normalization
Contact methods are automatically detected and normalized:
- Email addresses are lowercased
- Phone numbers are formatted as (123) 456-7890
- Addresses are preserved as-entered

### Contact Validation
Real-time validation for contact methods with user-friendly error messages.

### Keyboard Shortcuts
- **Cmd/Ctrl + S**: Save form
- **Cmd/Ctrl + Enter**: Save form
- **Escape**: Cancel/close form
- **Cmd + .**: Cancel/close form (macOS style)

### Responsive Design
All components adapt to mobile screens with appropriate layout changes.

### Permission Integration
Respects user permissions for delete operations and other restricted actions.

## Utilities

### Dynamic Width (`$lib/utils/person/dynamicWidth`)
- `resizeInputs(config)` - Resize inputs based on content
- `initializeInputWidths(config)` - Initialize input widths
- `cleanupMeasuringSpan()` - Clean up measuring elements

### Contact Validation (`$lib/utils/person/contactValidation`)
- `validateContact(value, expectedType?)` - Validate contact methods
- `validateEmail(email)` - Email-specific validation
- `validatePhone(phone)` - Phone-specific validation
- `validateAddress(address)` - Address-specific validation

### Contact Normalization (`$lib/utils/shared/contactNormalizer`)
- `normalizeContact(value)` - Detect type and normalize format
- `getContactTypeIcon(type)` - Get icon for contact type
- `getContactTypeLabel(type)` - Get label for contact type

## Migration from Existing Forms

To migrate from the existing person forms:

1. Replace the existing form component with `PersonForm`
2. Update the mode prop based on the form purpose
3. Handle the `save`, `cancel`, and `delete` events
4. Remove custom contact normalization logic (now handled automatically)
5. Remove custom width calculation logic (now handled automatically)

The new unified form preserves all the functionality from the original forms while providing a cleaner, more maintainable architecture.