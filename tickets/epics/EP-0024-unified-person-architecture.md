# EP-0024: Unified Person Component Architecture

## Overview
Create a unified, beautiful, and maintainable architecture for all person-related views (create, view, edit) using a hybrid component approach. This replaces EP-0023 by expanding the scope to include not just form consolidation but a complete architectural redesign that maximizes code reuse while maintaining optimal performance and user experience for each mode.

## Problem Statement
Currently, we have three completely different implementations for person-related interfaces:
1. **New Person Form** (`/people/new`): Beautiful, modern UI with contact normalization and dynamic features
2. **Edit Person View** (`/people/[personId]` inline): Clunky inline editing that doesn't match the new form
3. **View Person Display** (`/people/[personId]` view mode): Basic display that doesn't share the beautiful design

This fragmentation creates multiple issues:
- **Inconsistent UX**: Three different interfaces for related tasks confuse users
- **Triple Maintenance**: Same logic and styling maintained in three places
- **Wasted Effort**: Beautiful features only exist in one mode
- **Poor Performance**: View mode loads edit logic it doesn't need
- **Design Drift**: Interfaces diverge over time without shared components

## Business Value
- **Superior User Experience**: Consistent, beautiful interface across all person interactions
- **Reduced Development Time**: 80% code reuse across all modes
- **Easier Maintenance**: Shared components mean single-point updates
- **Better Performance**: Optimized bundles for each mode
- **Design Consistency**: Shared components prevent UI drift
- **Faster Feature Development**: New features automatically work across all modes

## Solution: Hybrid Component Architecture

### Core Architectural Principle
**"Share the presentation layer, separate the interaction layer"**

This hybrid approach gives us the best of both worlds:
- Visual consistency and code reuse through shared layout components
- Optimized performance through mode-specific interaction components
- Clear separation of concerns for maintainability

### Svelte 5 Patterns Used
- **Runes**: `$state`, `$derived`, `$effect` for reactive state management
- **Snippets**: Replace slots with type-safe snippets for composition
- **Props**: Proper `let { ... } = $props()` destructuring
- **Bindable**: `$bindable` for two-way binding where needed
- **Event Handlers**: Modern `onclick` syntax (no colon)
- **Debugging**: `$inspect` for development-time debugging

### 1. Component Architecture

#### Shared Components (Presentation Layer)
```
/src/lib/components/people/shared/
├── PersonLayout.svelte          # Overall container with snippet support
├── PersonHeader.svelte          # Icon, name, title display with snippets
├── PersonContactList.svelte     # Contact list container (accepts children)
├── ContactItem.svelte           # Single contact display/edit
├── ContactTypeIndicator.svelte  # Icon and label for contact type
├── PersonGroups.svelte          # Groups/departments display
├── PersonMetadata.svelte        # Status badges, timestamps
└── styles/
    ├── person-layout.css        # Shared layout styles
    └── person-theme.css         # Design tokens and variables
```

#### Mode-Specific Components (Interaction Layer)
```
/src/lib/components/people/
├── PersonForm.svelte            # Orchestrates create/edit modes
├── PersonView.svelte            # Orchestrates view mode
├── create/
│   └── PersonCreateFields.svelte
├── edit/
│   └── PersonEditFields.svelte
└── view/
    └── PersonViewFields.svelte
```

#### ContactItem Component (with $bindable for two-way binding)
```svelte
<script lang="ts">
  import type { NormalizedContact } from '$lib/utils/contactNormalizer';
  import ContactTypeIndicator from './ContactTypeIndicator.svelte';
  
  interface Props {
    mode: 'create' | 'edit' | 'view';
    value: string = $bindable('');  // Two-way bindable
    type?: string;
    normalized?: NormalizedContact | null;
    onBlur?: (event: Event) => void;
    onInput?: (event: Event) => void;
    placeholder?: string;
  }
  
  let { 
    mode, 
    value = $bindable(''),
    type,
    normalized,
    onBlur,
    onInput,
    placeholder = 'Email, phone, or address'
  }: Props = $props();
</script>

<div class="contact-item" data-mode={mode}>
  {#if normalized || type}
    <ContactTypeIndicator 
      contactType={normalized?.contact_type || type} 
    />
  {:else}
    <span class="contact-type-placeholder"></span>
  {/if}
  
  {#if mode === 'view'}
    <span class="contact-value">{value}</span>
  {:else}
    <input
      bind:value
      {placeholder}
      class="contact-input"
      {onblur}
      {oninput}
    />
  {/if}
</div>

<style>
  .contact-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .contact-item[data-mode="view"] {
    padding: 8px 0;
  }
  
  .contact-input {
    flex: 1;
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }
</style>
```

### 2. Component Interfaces

#### PersonLayout (Shared Container)
```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    mode: 'create' | 'edit' | 'view';
    person?: Person;
    client?: Client;
    loading?: boolean;
    error?: string | null;
    header?: Snippet;
    fields?: Snippet;
    contacts?: Snippet;
    groups?: Snippet;
    actions?: Snippet;
  }
  
  let { 
    mode, 
    person, 
    client, 
    loading, 
    error,
    header,
    fields,
    contacts,
    groups,
    actions
  }: Props = $props();
</script>

<div class="person-layout" data-mode={mode}>
  {#if loading}
    <div class="loading-spinner">Loading...</div>
  {:else if error}
    <div class="error-message" role="alert">{error}</div>
  {:else}
    {@render header?.()}
    {@render fields?.()}
    {@render contacts?.()}
    {@render groups?.()}
    {@render actions?.()}
  {/if}
</div>

<style>
  .person-layout {
    /* Shared layout styles for all modes */
    max-width: 600px;
    margin: 0 auto;
    padding: 24px;
  }
  
  .person-layout[data-mode="view"] {
    /* View-specific adjustments */
  }
</style>
```

#### PersonHeader (Shared Header)
```svelte
<script lang="ts">
  interface Props {
    mode: 'create' | 'edit' | 'view';
    name: string;
    namePreferred?: string;
    namePronunciation?: string;
    title?: string;
    isActive?: boolean;
    onEdit?: () => void;  // For view mode edit button
    nameInput?: () => any;  // Snippet for name input
    titleInput?: () => any; // Snippet for title input
  }
  
  let { 
    mode, 
    name, 
    namePreferred, 
    namePronunciation, 
    title, 
    isActive,
    onEdit,
    nameInput,
    titleInput
  }: Props = $props();
</script>

<div class="person-header">
  <div class="person-icon">
    <img src="/icons/person.circle.fill.svg" alt="" />
  </div>
  
  <div class="person-info">
    {#if mode === 'view'}
      <h1>{namePreferred || name}</h1>
      {#if namePronunciation}
        <span class="pronunciation">({namePronunciation})</span>
      {/if}
    {:else if nameInput}
      {@render nameInput()}
    {/if}
    
    {#if title}
      {#if mode === 'view'}
        <p class="title">{title}</p>
      {:else if titleInput}
        {@render titleInput()}
      {/if}
    {/if}
  </div>
  
  {#if mode === 'view' && onEdit}
    <button class="edit-button" onclick={onEdit}>
      <img src="/icons/pencil.svg" alt="Edit" />
    </button>
  {/if}
</div>
```

#### PersonForm (Create/Edit Orchestrator)
```svelte
<script lang="ts">
  import PersonLayout from './shared/PersonLayout.svelte';
  import PersonHeader from './shared/PersonHeader.svelte';
  import PersonContactList from './shared/PersonContactList.svelte';
  import PersonGroups from './shared/PersonGroups.svelte';
  import ChromelessInput from '$lib/components/ui/ChromelessInput.svelte';
  import { normalizeContact, resizeInput } from '$lib/utils/contactNormalizer';
  
  interface Props {
    mode: 'create' | 'edit';
    person?: Person;
    clientId: string;
    onSuccess?: (person: Person) => void;
    onCancel?: () => void;
  }
  
  let { mode, person, clientId, onSuccess, onCancel }: Props = $props();
  
  // Form state
  let formData = $state({
    name: person?.name || '',
    namePreferred: person?.name_preferred || '',
    namePronunciation: person?.name_pronunciation_hint || '',
    title: person?.title || '',
    isActive: person?.is_active ?? true,
  });
  
  // Contact methods with all the beautiful features
  let contactMethods = $state<TempContactMethod[]>(
    person?.contactMethods?.map(cm => ({
      id: crypto.randomUUID(),
      value: cm.value,
      normalized: normalizeContact(cm.value)
    })) || [
      { id: crypto.randomUUID(), value: '', normalized: null },
      { id: crypto.randomUUID(), value: '', normalized: null }
    ]
  );
  
  // All the dynamic width calculation logic
  function handleContactInput(method: TempContactMethod, index: number, event: Event) {
    // Implementation from actual new person form
    if (index === contactMethods.length - 1 && method.value.trim()) {
      const hasEmptyField = contactMethods.some((cm, i) => i !== index && !cm.value.trim());
      if (!hasEmptyField) {
        addContactMethod();
      }
    }
    resizeInput();
  }
  
  function handleContactBlur(method: TempContactMethod, index: number, event: Event) {
    const normalized = normalizeContact(method.value);
    method.normalized = normalized;
    
    if (normalized && (normalized.contact_type === 'email' || normalized.contact_type === 'phone')) {
      method.value = normalized.formatted_value;
    }
    
    setTimeout(() => resizeInput(), 0);
    
    if (!method.value.trim() && contactMethods.length > 2 && index !== contactMethods.length - 1) {
      contactMethods = contactMethods.filter((cm) => cm.id !== method.id);
    }
  }
  
  // Save handling with proper error management
  let saving = $state(false);
  
  async function handleSubmit() {
    if (!formData.name.trim()) {
      error = 'Name is required';
      return;
    }
    
    saving = true;
    error = null;
    
    try {
      const personData = {
        name: formData.name.trim(),
        name_preferred: formData.namePreferred.trim() || undefined,
        name_pronunciation_hint: formData.namePronunciation.trim() || undefined,
        title: formData.title.trim() || undefined,
        is_active: formData.isActive,
        client_id: clientId,
      };
      
      const savedPerson = mode === 'create' 
        ? await Person.create(personData)
        : await Person.update(person!.id, personData);
      
      onSuccess?.(savedPerson);
    } catch (err) {
      error = (err as Error).message || 'Failed to save person';
    } finally {
      saving = false;
    }
  }
  
  // Use $effect for side effects
  $effect(() => {
    // Update layout store or other side effects
    if (import.meta.env.DEV) {
      $inspect('Form state:', { formData, contactMethods, saving });
    }
  });
</script>

<!-- Using Svelte 5 snippets for composition -->
{#snippet nameInputSnippet()}
  <ChromelessInput 
    bind:value={formData.name}
    class="name-input"
    oninput={() => resizeInput()}
  />
{/snippet}

{#snippet titleInputSnippet()}
  <ChromelessInput 
    bind:value={formData.title}
    class="title-input"
    oninput={() => resizeInput()}
  />
{/snippet}

{#snippet headerSnippet()}
  <PersonHeader 
    {mode} 
    name={formData.name}
    namePreferred={formData.namePreferred}
    namePronunciation={formData.namePronunciation}
    title={formData.title}
    isActive={formData.isActive}
    nameInput={nameInputSnippet}
    titleInput={titleInputSnippet}
  />
{/snippet}
  
{#snippet contactsSnippet()}
  <PersonContactList {mode}>
    {#each contactMethods as method, index (method.id)}
      <ContactItem
        {mode}
        {method}
        {index}
        onInput={handleContactInput}
        onBlur={handleContactBlur}
      />
    {/each}
  </PersonContactList>
{/snippet}

{#snippet groupsSnippet()}
  <PersonGroups 
    {mode}
    groups={formData.selectedGroupIds}
    departments={formData.selectedDepartmentIds}
  />
{/snippet}

<PersonLayout 
  {mode} 
  {person}
  header={headerSnippet}
  contacts={contactsSnippet}
  groups={groupsSnippet}
/>
```

#### PersonView (View Mode Orchestrator)
```svelte
<script lang="ts">
  import PersonLayout from './shared/PersonLayout.svelte';
  import PersonHeader from './shared/PersonHeader.svelte';
  import PersonContactList from './shared/PersonContactList.svelte';
  import PersonGroups from './shared/PersonGroups.svelte';
  import ContactItem from './shared/ContactItem.svelte';
  import { goto } from '$app/navigation';
  
  interface Props {
    person: Person;
    clientId: string;
    canEdit?: boolean;
    canDelete?: boolean;
  }
  
  let { person, clientId, canEdit, canDelete }: Props = $props();
  
  function handleEdit() {
    goto(`/clients/${clientId}/people/${person.id}/edit`);
  }
</script>

<!-- Using Svelte 5 snippets for view mode -->
{#snippet headerSnippet()}
  <PersonHeader 
    mode="view"
    name={person.name}
    namePreferred={person.name_preferred}
    namePronunciation={person.name_pronunciation_hint}
    title={person.title}
    isActive={person.is_active}
    onEdit={canEdit ? handleEdit : undefined}
  />
{/snippet}

{#snippet contactsSnippet()}
  <PersonContactList mode="view">
    {#each person.contactMethods as method (method.id)}
      <ContactItem
        mode="view"
        type={method.contact_type}
        value={method.formatted_value || method.value}
      />
    {/each}
  </PersonContactList>
{/snippet}

{#snippet groupsSnippet()}
  <PersonGroups 
    mode="view"
    groups={person.groups}
    departments={person.departments}
  />
{/snippet}

<PersonLayout 
  mode="view" 
  {person}
  header={headerSnippet}
  contacts={contactsSnippet}
  groups={groupsSnippet}
/>
```

### 3. Route Structure

#### Clean URL Architecture
```
/clients/[id]/people              # List all people
/clients/[id]/people/new          # Create new person
/clients/[id]/people/[personId]   # View person (read-only)
/clients/[id]/people/[personId]/edit  # Edit person
```

#### Route Implementations

**New Person Route** (`/people/new/+page.svelte`)
```svelte
<script lang="ts">
  import PersonForm from '$lib/components/people/PersonForm.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  const clientId = $derived($page.params.id);
  
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

**View Person Route** (`/people/[personId]/+page.svelte`)
```svelte
<script lang="ts">
  import PersonView from '$lib/components/people/PersonView.svelte';
  import { page } from '$app/stores';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  const clientId = $derived($page.params.id);
  const person = $derived(data.person);
  const canEdit = $derived(data.user?.permissions?.canEditPeople ?? false);
  const canDelete = $derived(data.user?.permissions?.canDeletePeople ?? false);
</script>

<PersonView {person} {clientId} {canEdit} {canDelete} />
```

**Edit Person Route** (`/people/[personId]/edit/+page.svelte`)
```svelte
<script lang="ts">
  import PersonForm from '$lib/components/people/PersonForm.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  const clientId = $derived($page.params.id);
  const person = $derived(data.person);
  
  function handleSuccess(updatedPerson: Person) {
    goto(`/clients/${clientId}/people/${updatedPerson.id}`);
  }
  
  function handleCancel() {
    goto(`/clients/${clientId}/people/${person.id}`);
  }
</script>

<PersonForm 
  mode="edit" 
  {person} 
  {clientId} 
  onSuccess={handleSuccess} 
  onCancel={handleCancel} 
/>
```

### 4. Component Communication with $bindable

#### Using $bindable for Two-Way Data Flow
```svelte
<!-- Parent component -->
<script lang="ts">
  import ContactItem from './ContactItem.svelte';
  
  let email = $state('user@example.com');
</script>

<!-- Two-way binding with child component -->
<ContactItem 
  bind:value={email}
  mode="edit"
  placeholder="Email address"
/>

<!-- Email is automatically updated when ContactItem changes it -->
<p>Current email: {email}</p>
```

### 5. Shared Features Across All Modes

#### Visual Consistency
- Same layout structure and spacing
- Consistent typography and colors
- Shared icon system
- Unified contact type indicators

#### Smart Features (Edit/Create Only)
- Contact normalization (email/phone/address)
- Dynamic width calculation
- Auto-expanding contact fields
- Auto-removal of empty fields
- Type detection with visual indicators

#### Display Features (All Modes)
- Beautiful person icon header
- Contact type icons
- Group/department badges
- Status indicators
- Responsive design

### 6. Performance Optimizations

#### Code Splitting Strategy
```typescript
// View mode - lightweight bundle
import PersonView from '$lib/components/people/PersonView.svelte';
// No normalization utilities, no validation, no dynamic width logic

// Edit mode - full featured bundle  
import PersonForm from '$lib/components/people/PersonForm.svelte';
import { normalizeContact, resizeInput } from '$lib/utils/contactNormalizer';

// Using Svelte 5's $effect for performance monitoring
$effect(() => {
  if (import.meta.env.DEV) {
    $inspect('Bundle loaded:', isEditing ? 'edit' : 'view');
  }
});
```

#### Lazy Loading
```svelte
<script lang="ts">
  import PersonView from './PersonView.svelte';
  
  let { isEditing, ...props } = $props();
</script>

<!-- Only load edit components when needed -->
{#if isEditing}
  {#await import('./PersonForm.svelte') then module}
    <svelte:component this={module.default} {...props} />
  {/await}
{:else}
  <PersonView {...props} />
{/if}
```

### 7. Testing Strategy

#### Unit Tests
```typescript
import { render, screen } from '@testing-library/svelte';
import { vi } from 'vitest';
import PersonHeader from './PersonHeader.svelte';

// Shared components
describe('PersonHeader', () => {
  test('renders correctly in view mode', () => {
    render(PersonHeader, {
      props: {
        mode: 'view',
        name: 'John Doe',
        title: 'Software Engineer'
      }
    });
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
  
  test('renders snippets in edit mode', () => {
    const nameInput = vi.fn(() => 'Name Input');
    render(PersonHeader, {
      props: {
        mode: 'edit',
        name: 'John Doe',
        nameInput
      }
    });
    // Verify snippet was rendered
  });
  
  test('shows edit button when canEdit is true', () => {
    const onEdit = vi.fn();
    render(PersonHeader, {
      props: {
        mode: 'view',
        name: 'John Doe',
        canEdit: true,
        onEdit
      }
    });
    const editButton = screen.getByRole('button', { name: /edit/i });
    expect(editButton).toBeInTheDocument();
  });
});

describe('PersonContactList', () => {
  test('displays contacts in view mode');
  test('handles dynamic fields in edit mode');
  test('maintains minimum 2 fields');
});

// Mode-specific components
describe('PersonForm', () => {
  test('creates new person with Svelte 5 state', async () => {
    const onSuccess = vi.fn();
    const { component } = render(PersonForm, {
      props: {
        mode: 'create',
        clientId: '123',
        onSuccess
      }
    });
    
    // Test $state reactivity
    const nameInput = screen.getByPlaceholderText('Full name');
    await userEvent.type(nameInput, 'Jane Doe');
    
    // Submit form
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    
    // Verify onSuccess was called
    expect(onSuccess).toHaveBeenCalled();
  });
  
  test('updates existing person', () => {
    // Test edit mode with existing person data
  });
  
  test('normalizes contacts on blur', () => {
    // Test contact normalization logic
  });
  
  test('dynamically resizes inputs with $effect', () => {
    // Test dynamic width calculation
  });
});

describe('PersonView', () => {
  test('displays person information');
  test('navigates to edit on button click');
  test('shows formatted contact values');
});
```

#### Integration Tests
- Complete create person flow
- View to edit navigation
- Edit and save flow
- Cancel operations
- Contact method CRUD

## Implementation Steps

### Key Svelte 5 Implementation Guidelines
1. **Always use `let` for props destructuring**: `let { ... } = $props()`
2. **Use snippets instead of slots**: Pass snippets as props for composition
3. **Mark bindable props explicitly**: Use `$bindable` for two-way binding
4. **Leverage runes for state**: `$state`, `$derived`, `$effect`
5. **Use modern event syntax**: `onclick` not `on:click`
6. **Add development helpers**: Use `$inspect` for debugging in DEV mode

### Phase 1: Shared Components (4 hours)
1. Create `PersonLayout` component
2. Create `PersonHeader` component
3. Create `PersonContactList` component
4. Create `ContactItem` component
5. Create `ContactTypeIndicator` component
6. Extract shared styles

### Phase 2: Form Consolidation (4 hours)
1. Create `PersonForm` orchestrator
2. Migrate new person page to use `PersonForm`
3. Create edit route and page
4. Update toolbar recognition

### Phase 3: View Mode Enhancement (3 hours)
1. Create `PersonView` orchestrator
2. Update view page to use new components
3. Add edit button and navigation
4. Remove old inline edit code

### Phase 4: Testing & Polish (3 hours)
1. Unit tests for all components
2. Integration tests for workflows
3. Performance testing
4. Visual regression testing
5. Accessibility audit

## Success Criteria
- [ ] All three modes use shared presentation components
- [ ] 80% code reuse across modes
- [ ] View mode bundle is <50% size of edit mode bundle
- [ ] All contact normalization features work
- [ ] Dynamic width calculation works
- [ ] Visual consistency across all modes
- [ ] Edit button navigates to dedicated edit route
- [ ] No regression in functionality
- [ ] All tests passing
- [ ] Performance metrics meet targets

## Metrics for Success

### Code Metrics
- Lines of code reduced by >60%
- Component count reduced by >40%
- CSS duplication reduced by >70%

### Performance Metrics
- View mode initial load <100ms
- Edit mode initial load <200ms
- No layout shift when switching modes

### User Experience Metrics
- Task completion time reduced by 20%
- Error rate reduced by 30%
- User satisfaction score increased

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-abstraction complexity | High | Keep interaction layer separate, document patterns clearly |
| Performance regression | Medium | Implement code splitting, lazy loading, measure bundles |
| Migration bugs | Medium | Comprehensive testing, feature flags for rollout |
| Component coupling | Low | Clear interfaces, single responsibility principle |

## Estimated Effort
- **Total**: 14-16 hours
- **Development**: 11 hours
- **Testing**: 3 hours
- **Documentation & Review**: 2 hours

## Dependencies
- Existing contactNormalizer utility
- ChromelessInput component
- Person and ContactMethod models
- Reactive models for data loading
- Current routing system

## Migration Path

### Week 1
1. Build shared components in parallel with existing code
2. Test shared components in isolation
3. Create PersonForm orchestrator

### Week 2
1. Migrate new person page to PersonForm
2. Create edit route using PersonForm
3. Update navigation and toolbar

### Week 3
1. Create PersonView orchestrator
2. Migrate view page to new architecture
3. Remove old inline edit code
4. Full testing and polish

## Future Enhancements (Out of Scope)
- Inline editing capabilities (if needed later)
- Advanced field customization per client
- Bulk editing interface
- Person comparison view
- Version history display
- Real-time collaboration

## Definition of Done
- [ ] Shared components created and documented
- [ ] PersonForm handles create and edit modes
- [ ] PersonView provides beautiful read-only display
- [ ] All routes working with new components
- [ ] 80% code reuse achieved
- [ ] Bundle sizes optimized
- [ ] All tests passing (unit, integration, e2e)
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] Code reviewed and approved
- [ ] Documentation complete
- [ ] Deployed to staging
- [ ] User acceptance testing complete
- [ ] Deployed to production

## Architecture Decision Records

### ADR-001: Hybrid Approach Over Full DRY
**Decision**: Use shared presentation components with separate interaction layers
**Rationale**: Balances code reuse (80%) with performance and maintainability
**Consequences**: Slightly more components but clearer separation of concerns

### ADR-002: Separate Edit Route Over Inline Editing  
**Decision**: Dedicated `/edit` route instead of inline editing
**Rationale**: Cleaner navigation, better performance, clearer user mental model
**Consequences**: Additional route but simpler state management

### ADR-003: Snippets Over Props for Composition
**Decision**: Use Svelte 5 snippets for component composition
**Rationale**: More flexible than slots, better TypeScript support, cleaner APIs, proper Svelte 5 pattern
**Consequences**: More verbose templates but better maintainability and type safety