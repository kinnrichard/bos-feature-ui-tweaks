<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PersonHeader from './PersonHeader.svelte';
  import ContactMethodsSection from './ContactMethodsSection.svelte';
  import { Person } from '$lib/models/person';
  import { ContactMethod } from '$lib/models/contact-method';
  import { PeopleGroupMembership } from '$lib/models/people-group-membership';
  import { ReactivePeopleGroup } from '$lib/models/reactive-people-group';
  import type { CreatePersonData, UpdatePersonData } from '$lib/models/types/person-data';
  import type { PersonData } from '$lib/models/types/person-data';
  import type { NormalizedContact } from '$lib/utils/shared/contactNormalizer';
  import { normalizeContact } from '$lib/utils/contactNormalizer';
  import {
    initializeInputWidths,
    cleanupMeasuringSpan,
    PERSON_FORM_WIDTH_CONFIG,
  } from '$lib/utils/person/dynamicWidth';
  import { peoplePermissionHelpers } from '$lib/stores/peoplePermissions.svelte';

  // Props
  interface Props {
    mode?: 'create' | 'edit' | 'view';
    person?: PersonData | null;
    clientId: string;
    error?: string | null;
    showValidation?: boolean;
  }

  let {
    mode = 'create',
    person = null,
    clientId,
    error = null,
    showValidation = false,
  }: Props = $props();

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    save: {
      person: PersonData;
      contactMethods: Array<{
        id?: string;
        type: string;
        value: string;
        isPrimary: boolean;
        _destroy?: boolean;
      }>;
      groupMemberships: string[];
    };
    cancel: void;
    delete: { person: PersonData };
  }>();

  // Form data
  let formData = $state({
    name: '',
    namePreferred: '',
    namePronunciationHint: '',
    title: '',
    isActive: true,
    selectedGroupIds: [] as string[],
    selectedDepartmentIds: [] as string[],
  });

  // Contact methods
  interface TempContactMethod {
    id?: string; // Optional - new records don't have IDs
    value: string;
    contact_type?: 'phone' | 'email' | 'address'; // Store original type
    normalized?: NormalizedContact | null;
  }

  let contactMethods = $state<TempContactMethod[]>([]);

  // DRY helper to ensure there's always at least one empty contact method for user input
  function ensureEmptyContactMethod(methods: TempContactMethod[]): TempContactMethod[] {
    // Check if there's already an empty contact method
    const hasEmptyMethod = methods.some((cm) => !cm.value.trim());

    if (!hasEmptyMethod) {
      // Add one empty contact method for user to add new ones
      // No ID for new records - follows Rails pattern
      return [
        ...methods,
        {
          value: '',
          normalized: null,
        },
      ];
    }

    return methods;
  }

  // Load groups and departments for this client
  const groupsQuery = $derived(
    ReactivePeopleGroup.where({ client_id: clientId }).orderBy('name', 'asc')
  );
  const allGroups = $derived(groupsQuery?.data || []);
  const groups = $derived(allGroups.filter((g) => !g.is_department));
  const departments = $derived(allGroups.filter((g) => g.is_department));

  // Track the person ID to detect when it actually changes
  let lastPersonId = $state<string | null>(null);

  // Initialize form data when person changes
  $effect(() => {
    const currentPersonId = person?.id || null;

    // In view mode, always update when person data changes
    // In edit mode, only update when switching to a different person (not during edits)
    if (person && mode === 'view') {
      // Always sync in view mode
      formData.name = person.name || '';
      formData.namePreferred = person.name_preferred || '';
      formData.namePronunciationHint = person.name_pronunciation_hint || '';
      formData.title = person.title || '';
      formData.isActive = person.is_active ?? true;

      // Set contact methods
      let newContactMethods: TempContactMethod[] = [];
      if (person.contactMethods?.length) {
        newContactMethods = person.contactMethods.map((cm) => ({
          id: cm.id,
          value: cm.value,
          contact_type: cm.contact_type, // Preserve original type
          normalized: cm.contact_type
            ? {
                contact_type: cm.contact_type as any,
                formatted_value: cm.formatted_value || cm.value,
              }
            : null,
        }));
      }

      // Ensure there's always at least one empty field for adding new contacts
      contactMethods = ensureEmptyContactMethod(newContactMethods);

      // Load group memberships (would need to be loaded separately in real implementation)
      formData.selectedGroupIds = [];
      formData.selectedDepartmentIds = [];

      lastPersonId = currentPersonId;
    } else if (person && mode === 'edit' && currentPersonId !== lastPersonId) {
      // In edit mode, only update when switching to a different person
      formData.name = person.name || '';
      formData.namePreferred = person.name_preferred || '';
      formData.namePronunciationHint = person.name_pronunciation_hint || '';
      formData.title = person.title || '';
      formData.isActive = person.is_active ?? true;

      // Set contact methods
      let newContactMethods: TempContactMethod[] = [];
      if (person.contactMethods?.length) {
        newContactMethods = person.contactMethods.map((cm) => ({
          id: cm.id,
          value: cm.value,
          contact_type: cm.contact_type, // Preserve original type
          normalized: cm.contact_type
            ? {
                contact_type: cm.contact_type as any,
                formatted_value: cm.formatted_value || cm.value,
              }
            : null,
        }));
      }

      // Ensure there's always at least one empty field for adding new contacts
      contactMethods = ensureEmptyContactMethod(newContactMethods);

      // Load group memberships (would need to be loaded separately in real implementation)
      formData.selectedGroupIds = [];
      formData.selectedDepartmentIds = [];

      lastPersonId = currentPersonId;
    } else if (mode === 'create' && lastPersonId !== 'create-mode') {
      // Initialize empty form for create mode
      formData = {
        name: '',
        namePreferred: '',
        namePronunciationHint: '',
        title: '',
        isActive: true,
        selectedGroupIds: [],
        selectedDepartmentIds: [],
      };

      // Initialize with one empty contact method (auto-add will create more as needed)
      contactMethods = ensureEmptyContactMethod([]);

      lastPersonId = 'create-mode'; // Special marker for create mode
    }
  });

  // Validation
  const canSave = $derived(formData.name.trim().length > 0);
  const canDelete = $derived(person ? peoplePermissionHelpers.canDeletePerson(person) : false);

  // Handle form submission
  async function handleSubmit(event?: Event) {
    event?.preventDefault();

    if (!canSave) {
      error = 'Name is required';
      return;
    }

    console.log('[PersonForm] Save clicked, mode:', mode);
    try {
      if (mode === 'create') {
        await handleCreate();
      } else if (mode === 'edit') {
        await handleUpdate();
      }
    } catch (err) {
      console.error('[PersonForm] Save error:', err);
      error = (err as Error).message || 'Failed to save person. Please try again.';
    }
  }

  // Handle create
  async function handleCreate() {
    const personData: CreatePersonData = {
      name: formData.name.trim(),
      name_preferred: formData.namePreferred.trim() || undefined,
      name_pronunciation_hint: formData.namePronunciationHint.trim() || undefined,
      title: formData.title.trim() || undefined,
      is_active: formData.isActive,
      client_id: clientId,
    };

    const newPerson = await Person.create(personData);

    // Create contact methods with normalized data
    const validContactMethods = contactMethods.filter((cm) => cm.value.trim());

    const createdContactMethods = [];

    for (const cm of validContactMethods) {
      const normalized = cm.normalized || normalizeContact(cm.value);

      const createData = {
        person_id: newPerson.id,
        value: cm.value.trim(),
        contact_type: normalized?.contact_type,
        normalized_value: normalized?.normalized_value || cm.value.trim(),
      };

      const created = await ContactMethod.create(createData);
      createdContactMethods.push(created);
    }

    // Create group memberships
    const allGroupIds = [...formData.selectedGroupIds, ...formData.selectedDepartmentIds];
    for (const groupId of allGroupIds) {
      await PeopleGroupMembership.create({
        person_id: newPerson.id,
        people_group_id: groupId,
      });
    }

    dispatch('save', {
      person: newPerson,
      contactMethods: createdContactMethods,
      groupMemberships: allGroupIds,
    });
  }

  // Handle update
  async function handleUpdate() {
    console.log('[PersonForm] handleUpdate called');
    console.log('[PersonForm] Current contactMethods:', contactMethods);
    if (!person) return;

    const updateData: UpdatePersonData = {
      name: formData.name.trim(),
      name_preferred: formData.namePreferred.trim(),
      name_pronunciation_hint: formData.namePronunciationHint.trim(),
      title: formData.title.trim(),
      is_active: formData.isActive,
    };

    let updatedPerson;
    try {
      updatedPerson = await Person.update(person.id, updateData);
      console.log('[PersonForm] Person update succeeded');
    } catch (personError) {
      console.error('[PersonForm] Person update failed:', personError);
      throw personError;
    }

    // Handle contact methods
    console.log('[PersonForm] About to handle contact methods');
    const validContactMethods = contactMethods.filter((cm) => cm.value.trim() || cm.id);
    console.log('[PersonForm] Valid contact methods after filter:', validContactMethods);

    // Delete removed contact methods
    if (person.contactMethods) {
      const existingIds = validContactMethods.map((cm) => cm.id).filter(Boolean);
      const toDelete = person.contactMethods.filter((cm) => !existingIds.includes(cm.id));
      for (const cm of toDelete) {
        await ContactMethod.destroy(cm.id);
      }
    }

    // Update or create contact methods
    console.log(
      '[PersonForm] Starting contact method updates, validContactMethods:',
      validContactMethods
    );
    const updatedContactMethods = [];
    for (const cm of validContactMethods) {
      console.log('[PersonForm] Processing contact method:', cm);
      if (cm.value.trim()) {
        const normalized = cm.normalized || normalizeContact(cm.value);
        console.log('[PersonForm] Normalized result:', normalized);
        if (cm.id) {
          // Update existing
          const updatePayload = {
            contact_type: normalized?.contact_type || cm.contact_type || 'address', // Preserve existing type or default to address
            value: cm.value.trim(),
            normalized_value: normalized?.normalized_value || cm.value.trim(),
          };

          console.log('[PersonForm] Contact method update payload:', {
            id: cm.id,
            payload: updatePayload,
            normalized,
            originalContactType: cm.contact_type,
          });

          try {
            const updated = await ContactMethod.update(cm.id, updatePayload);
            updatedContactMethods.push(updated);
          } catch (error) {
            console.error('[PersonForm] Contact method update failed:', {
              error,
              id: cm.id,
              payload: updatePayload,
              errorMessage: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        } else {
          // Create new
          const created = await ContactMethod.create({
            person_id: person.id,
            contact_type: normalized?.contact_type || 'address', // Default to address if normalization fails
            value: cm.value.trim(),
            normalized_value: normalized?.normalized_value || cm.value.trim(),
          });
          updatedContactMethods.push(created);
        }
      }
    }

    // Handle group memberships (simplified - delete all and recreate)
    const memberships = await PeopleGroupMembership.where({ person_id: person.id }).all();
    for (const membership of memberships) {
      await PeopleGroupMembership.destroy(membership.id);
    }

    const allGroupIds = [...formData.selectedGroupIds, ...formData.selectedDepartmentIds];
    for (const groupId of allGroupIds) {
      await PeopleGroupMembership.create({
        person_id: person.id,
        people_group_id: groupId,
      });
    }

    dispatch('save', {
      person: updatedPerson,
      contactMethods: updatedContactMethods,
      groupMemberships: allGroupIds,
    });
  }

  // Handle cancel
  function handleCancel() {
    dispatch('cancel');
  }

  // Handle delete
  function handleDelete() {
    if (person) {
      dispatch('delete', { person });
    }
  }

  // Handle contact methods change
  function handleContactMethodsChange(methods: typeof contactMethods) {
    contactMethods = methods;
  }

  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    if (mode === 'view') return;

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === 's' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    } else if (event.key === '.' && event.metaKey) {
      event.preventDefault();
      handleCancel();
    }
  }

  // Initialize dynamic width calculation
  $effect(() => {
    if (mode !== 'view') {
      initializeInputWidths(PERSON_FORM_WIDTH_CONFIG);
    }
  });

  // Initialize input widths when form data changes
  $effect(() => {
    if (mode !== 'view') {
      // Trigger on form data change
      formData.name;
      formData.title;
      initializeInputWidths(PERSON_FORM_WIDTH_CONFIG);
    }
  });

  // Cleanup on unmount
  $effect(() => {
    return () => {
      cleanupMeasuringSpan();
    };
  });

  // Expose method to trigger form submission from parent component
  export function triggerSubmit() {
    handleSubmit();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="person-form" class:view-mode={mode === 'view'}>
  {#if error}
    <div class="error-message" role="alert">
      {error}
    </div>
  {/if}

  <form onsubmit={handleSubmit} novalidate>
    <!-- Person Header -->
    <PersonHeader
      {mode}
      bind:name={formData.name}
      bind:namePreferred={formData.namePreferred}
      bind:namePronunciationHint={formData.namePronunciationHint}
      bind:title={formData.title}
      bind:isActive={formData.isActive}
      dynamicWidthConfig={mode !== 'view' ? PERSON_FORM_WIDTH_CONFIG : undefined}
      {canDelete}
      onDelete={handleDelete}
    />

    <!-- Divider -->
    <hr class="divider" />

    <!-- Contact Methods -->
    <ContactMethodsSection
      {mode}
      bind:contactMethods
      onContactMethodsChange={handleContactMethodsChange}
      dynamicWidthConfig={mode !== 'view' ? PERSON_FORM_WIDTH_CONFIG : undefined}
      {showValidation}
    />

    <!-- Groups and Departments -->
    {#if (groups.length > 0 || departments.length > 0) && mode !== 'view'}
      <div class="groups-section">
        {#if departments.length > 0}
          <div class="form-field">
            <label class="field-label">Departments</label>
            <div class="checkbox-group">
              {#each departments as dept}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    value={dept.id}
                    checked={formData.selectedDepartmentIds.includes(dept.id)}
                    onchange={(e) => {
                      const isChecked = e.currentTarget.checked;
                      if (isChecked) {
                        formData.selectedDepartmentIds.push(dept.id);
                      } else {
                        const index = formData.selectedDepartmentIds.indexOf(dept.id);
                        if (index > -1) {
                          formData.selectedDepartmentIds.splice(index, 1);
                        }
                      }
                    }}
                  />
                  {dept.name}
                </label>
              {/each}
            </div>
          </div>
        {/if}

        {#if groups.length > 0}
          <div class="form-field">
            <label class="field-label">Groups</label>
            <div class="checkbox-group">
              {#each groups as group}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    value={group.id}
                    checked={formData.selectedGroupIds.includes(group.id)}
                    onchange={(e) => {
                      const isChecked = e.currentTarget.checked;
                      if (isChecked) {
                        formData.selectedGroupIds.push(group.id);
                      } else {
                        const index = formData.selectedGroupIds.indexOf(group.id);
                        if (index > -1) {
                          formData.selectedGroupIds.splice(index, 1);
                        }
                      }
                    }}
                  />
                  {group.name}
                </label>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </form>
</div>

<style>
  .person-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    padding: 16px;
  }

  .person-form.view-mode {
    padding: 16px;
  }

  .error-message {
    background-color: rgba(255, 69, 58, 0.1);
    color: var(--accent-red);
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    line-height: 1.5;
    width: 100%;
    text-align: center;
  }

  hr.divider {
    width: 100%;
    border: none;
    border-top: 1px solid var(--border-primary);
    margin: 16px 0;
  }

  .groups-section {
    width: 100%;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--border-secondary);
  }

  .form-field {
    margin-bottom: 24px;
  }

  .form-field:last-child {
    margin-bottom: 0;
  }

  .field-label {
    display: block;
    margin-bottom: 12px;
    font-weight: 600;
    font-size: 16px;
    color: var(--text-primary);
  }

  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: default;
    font-size: 14px;
    color: var(--text-primary);
    user-select: none;
    padding: 8px 0;
  }

  .checkbox-label input[type='checkbox'] {
    cursor: default;
    width: 18px;
    height: 18px;
    margin: 0;
    flex-shrink: 0;
  }

  .checkbox-label:hover {
    color: var(--text-primary);
    background-color: var(--bg-hover, rgba(0, 0, 0, 0.05));
    border-radius: 6px;
    padding: 8px 12px;
    margin: 0 -12px;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .person-form {
      padding: 12px;
      gap: 20px;
    }

    .checkbox-label:hover {
      padding: 8px 0;
      margin: 0;
      background-color: transparent;
    }
  }

  @media (max-width: 480px) {
    .person-form {
      padding: 8px;
    }
  }
</style>
