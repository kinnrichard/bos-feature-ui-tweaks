# EP-0023: Consolidate New/Edit Person Forms with Shared Component

## Overview
Consolidate the new person and edit person views into a single, beautiful, reusable form component. The current edit person view is clunky and doesn't match the polished UI of the new person form. This epic will create a shared PersonForm component that handles both creation and editing, while maintaining all the beautiful features recently implemented.

## Problem Statement
Currently, we have two completely different implementations for creating and editing people:
1. **New Person Form** (`/people/new`): Beautiful, modern UI with contact normalization, dynamic widths, and auto-expanding fields
2. **Edit Person View** (`/people/[personId]`): Inline editing with outdated UI that doesn't match the new form's polish

This creates several issues:
- **Inconsistent UX**: Users experience different interfaces for essentially the same task
- **Code Duplication**: Similar logic exists in two places, making maintenance difficult
- **Missing Features**: Edit mode lacks the beautiful features of the new form
- **Poor Architecture**: Inline editing makes the view page complex and harder to maintain

## Business Value
- **Improved User Experience**: Consistent, beautiful interface for all person-related forms
- **Reduced Maintenance**: Single source of truth for person form logic and UI
- **Faster Development**: New features only need to be added once
- **Better Architecture**: Clean separation between viewing and editing
- **Enhanced Productivity**: Users can work more efficiently with a consistent interface

## Solution: Shared PersonForm Component

### 1. Create Reusable PersonForm Component

#### Component Location
`/src/lib/components/people/PersonForm.svelte`

#### Component Interface
```typescript
interface PersonFormProps {
  mode: 'create' | 'edit';
  person?: Person;  // For edit mode
  clientId: string;
  onSuccess?: (person: Person) => void;
  onCancel?: () => void;
}
```

#### Features to Include
- Contact normalization (email/phone/address detection)
- Dynamic width calculation for all inputs
- Auto-expanding contact fields
- Auto-removal of empty fields (minimum 2)
- Type indicators with icons
- Groups and departments selection
- Real-time validation
- Keyboard shortcuts (Cmd+Enter, Escape)

### 2. Route Structure

#### Current Routes (Messy)
- Create: `/clients/[id]/people/new`
- View/Edit: `/clients/[id]/people/[personId]` (inline editing)

#### New Routes (Clean)
- Create: `/clients/[id]/people/new`
- View: `/clients/[id]/people/[personId]` (read-only)
- Edit: `/clients/[id]/people/[personId]/edit` (uses PersonForm)

### 3. Implementation Details

#### PersonForm Component Structure
```svelte
<script lang="ts">
  import { normalizeContact, getContactTypeIcon, getContactTypeLabel } from '$lib/utils/contactNormalizer';
  import ChromelessInput from '$lib/components/ui/ChromelessInput.svelte';
  // ... other imports

  interface Props {
    mode: 'create' | 'edit';
    person?: Person;
    clientId: string;
    onSuccess?: (person: Person) => void;
    onCancel?: () => void;
  }

  const { mode, person, clientId, onSuccess, onCancel }: Props = $props();

  // Form state
  let formData = $state({
    name: person?.name || '',
    namePreferred: person?.name_preferred || '',
    namePronunciationHint: person?.name_pronunciation_hint || '',
    title: person?.title || '',
    isActive: person?.is_active ?? true,
    selectedGroupIds: [],
    selectedDepartmentIds: [],
  });

  // Contact methods with normalization
  let contactMethods = $state<TempContactMethod[]>(
    person?.contactMethods?.length > 0
      ? person.contactMethods.map(cm => ({
          id: cm.id,
          value: cm.value,
          normalized: normalizeContact(cm.value),
        }))
      : [
          { id: crypto.randomUUID(), value: '', normalized: null },
          { id: crypto.randomUUID(), value: '', normalized: null },
        ]
  );

  // Dynamic width calculation
  function resizeInput() {
    // ... existing logic
  }

  // Contact normalization
  function handleContactBlur(method: TempContactMethod, index: number, event: Event) {
    // ... existing logic
  }

  // Save handling
  async function handleSubmit() {
    if (mode === 'create') {
      const newPerson = await Person.create(formData);
      // Create contact methods
      onSuccess?.(newPerson);
    } else {
      const updatedPerson = await Person.update(person.id, formData);
      // Update contact methods (add/update/delete)
      onSuccess?.(updatedPerson);
    }
  }
</script>

<!-- Beautiful form UI -->
<form onsubmit={handleSubmit}>
  <!-- Person icon, name, title, contact methods, groups -->
</form>
```

#### New Person Page (Simplified)
```svelte
<script lang="ts">
  import PersonForm from '$lib/components/people/PersonForm.svelte';
  import { goto } from '$app/navigation';
  
  let clientId = $page.params.id;
  
  function handleSuccess(person: Person) {
    goto(`/clients/${clientId}/people/${person.id}`);
  }
  
  function handleCancel() {
    goto(`/clients/${clientId}/people`);
  }
</script>

<PersonForm 
  mode="create"
  {clientId}
  onSuccess={handleSuccess}
  onCancel={handleCancel}
/>
```

#### Edit Person Page (New Route)
```svelte
<script lang="ts">
  import PersonForm from '$lib/components/people/PersonForm.svelte';
  import { goto } from '$app/navigation';
  
  let clientId = $page.params.id;
  let personId = $page.params.personId;
  
  // Load existing person
  const personQuery = $derived(ReactivePerson.includes('contactMethods').find(personId));
  const person = $derived(personQuery?.data);
  
  function handleSuccess(person: Person) {
    goto(`/clients/${clientId}/people/${person.id}`);
  }
  
  function handleCancel() {
    goto(`/clients/${clientId}/people/${personId}`);
  }
</script>

{#if person}
  <PersonForm 
    mode="edit"
    {person}
    {clientId}
    onSuccess={handleSuccess}
    onCancel={handleCancel}
  />
{/if}
```

#### Person View Page (Add Edit Button)
```svelte
<!-- In the header section -->
<div class="header-actions">
  <CircularButton
    iconSrc="/icons/pencil.svg"
    variant="default"
    size="medium"
    onclick={() => goto(`/clients/${clientId}/people/${personId}/edit`)}
    title="Edit person"
  />
  
  {#if canDelete}
    <!-- Existing delete button -->
  {/if}
</div>
```

### 4. Features to Preserve

#### Contact Normalization
- Email detection and lowercase formatting
- Phone number formatting (US format: (XXX) XXX-XXXX)
- Address as fallback for unrecognized input
- Visual type indicators with icons

#### Dynamic UI Behaviors
- All inputs share the same width (expand together)
- Width adjusts to accommodate longest content
- Minimum width of 180px, maximum 80% viewport
- Smooth transitions when resizing

#### Contact Method Management
- Minimum 2 contact fields always visible
- Auto-add new field when typing in last one
- Auto-remove empty fields on blur (keeping minimum 2)
- No manual add/remove buttons needed

#### Visual Design
- Person icon at top
- Name field with 18px font (matching toolbar)
- Title field below name
- Horizontal divider before contact methods
- Contact type indicators (icons) before inputs
- Groups and departments with checkboxes

### 5. Testing Strategy

#### Unit Tests
- PersonForm component with create mode
- PersonForm component with edit mode
- Contact normalization logic
- Dynamic width calculations
- Contact method add/remove logic

#### Integration Tests
- Create new person flow
- Edit existing person flow
- Navigation between view and edit modes
- Data persistence and updates
- Contact method CRUD operations

#### E2E Tests
- Complete person creation workflow
- Edit person with various changes
- Cancel operations
- Keyboard shortcuts
- Responsive behavior

## Implementation Steps

1. **Create PersonForm Component** (4 hours)
   - Extract logic from new person page
   - Add mode handling (create vs edit)
   - Implement data loading for edit mode

2. **Update New Person Page** (1 hour)
   - Replace inline form with PersonForm component
   - Simplify to just navigation logic

3. **Create Edit Route** (2 hours)
   - New route at `/people/[personId]/edit`
   - Load person data
   - Use PersonForm component

4. **Update Person View Page** (1 hour)
   - Remove inline edit mode
   - Add Edit button to header
   - Clean up view-only display

5. **Update Toolbar Recognition** (30 minutes)
   - Recognize new edit route
   - Ensure save/cancel buttons work

6. **Testing** (2 hours)
   - Unit tests for PersonForm
   - Integration tests for all flows
   - Manual testing of UI features

## Success Criteria
- [ ] PersonForm component handles both create and edit modes
- [ ] New person creation uses PersonForm component
- [ ] Edit person has dedicated route using PersonForm
- [ ] View page is read-only with Edit button
- [ ] All contact normalization features work in both modes
- [ ] Dynamic width calculation works for all inputs
- [ ] Contact methods properly add/remove/update
- [ ] Groups and departments selection works
- [ ] Keyboard shortcuts functional
- [ ] No regression in existing functionality
- [ ] Tests passing for all scenarios

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Thoroughly test edit mode with existing data |
| Performance with many contacts | Medium | Optimize dynamic width calculations |
| Browser compatibility | Low | Test in all supported browsers |
| User confusion with new flow | Low | Clear navigation and consistent UI patterns |

## Estimated Effort
- **Total**: 10-12 hours
- **Development**: 8 hours
- **Testing**: 2 hours
- **Code Review & Deployment**: 2 hours

## Dependencies
- Existing contactNormalizer utility
- ChromelessInput component
- Person and ContactMethod models
- Reactive models for data loading

## Future Enhancements (Out of Scope)
- Bulk person import
- Contact method preferences/priority
- International phone number support
- Address validation and autocomplete
- Custom fields per client
- Person merge/duplicate detection
- Export functionality

## Definition of Done
- [ ] PersonForm component created and tested
- [ ] New person page uses PersonForm
- [ ] Edit route created and functional
- [ ] View page has Edit button
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] User acceptance testing complete
- [ ] Deployed to production