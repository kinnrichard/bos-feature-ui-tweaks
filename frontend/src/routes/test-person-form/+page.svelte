<script lang="ts">
  import PersonForm from '$lib/components/person/PersonForm.svelte';
  import type { PersonData } from '$lib/models/types/person-data';

  // Demo state
  let currentMode: 'create' | 'edit' | 'view' = 'create';
  let loading = false;
  let error: string | null = null;

  // Mock client ID
  const clientId = 'demo-client-123';

  // Mock person data for edit/view modes
  const mockPerson: PersonData = {
    id: 'demo-person-123',
    name: 'John Doe',
    name_preferred: 'Johnny',
    name_pronunciation_hint: 'JON-ee',
    title: 'Software Engineer',
    is_active: true,
    client_id: clientId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    contactMethods: [
      {
        id: 'cm-1',
        value: 'john.doe@example.com',
        contact_type: 'email',
        formatted_value: 'john.doe@example.com',
        person_id: 'demo-person-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'cm-2',
        value: '(555) 123-4567',
        contact_type: 'phone',
        formatted_value: '(555) 123-4567',
        person_id: 'demo-person-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  };

  // Get person data based on current mode
  $: person = currentMode === 'create' ? null : mockPerson;

  // Event handlers
  function handleSave(event: CustomEvent) {
    const { person, contactMethods, groupMemberships } = event.detail;
    console.log('PersonForm save event:', { person, contactMethods, groupMemberships });
    alert(`Person ${currentMode === 'create' ? 'created' : 'updated'} successfully!`);
  }

  function handleCancel() {
    console.log('PersonForm cancel event');
    alert('Form cancelled');
  }

  function handleDelete(event: CustomEvent) {
    const { person } = event.detail;
    console.log('PersonForm delete event:', person);
    alert('Person deleted successfully!');
  }
</script>

<div class="demo-container">
  <h1>PersonForm Demo</h1>

  <div class="demo-controls">
    <label>
      Mode:
      <select bind:value={currentMode}>
        <option value="create">Create</option>
        <option value="edit">Edit</option>
        <option value="view">View</option>
      </select>
    </label>
    <button onclick={() => (loading = !loading)}>
      {loading ? 'Stop Loading' : 'Simulate Loading'}
    </button>
    <button onclick={() => (error = error ? null : 'This is a sample error message')}>
      {error ? 'Clear Error' : 'Simulate Error'}
    </button>
  </div>

  <div class="demo-form">
    <PersonForm
      mode={currentMode}
      {person}
      {clientId}
      {loading}
      {error}
      showValidation={true}
      on:save={handleSave}
      on:cancel={handleCancel}
      on:delete={handleDelete}
    />
  </div>

  <div class="demo-info">
    <h3>Current State:</h3>
    <ul>
      <li><strong>Mode:</strong> {currentMode}</li>
      <li><strong>Person ID:</strong> {person?.id || 'N/A (create mode)'}</li>
      <li><strong>Loading:</strong> {loading}</li>
      <li><strong>Error:</strong> {error || 'None'}</li>
    </ul>

    <h3>Keyboard Shortcuts:</h3>
    <ul>
      <li><strong>Cmd/Ctrl + S:</strong> Save form</li>
      <li><strong>Cmd/Ctrl + Enter:</strong> Save form</li>
      <li><strong>Escape:</strong> Cancel form</li>
      <li><strong>Cmd + .:</strong> Cancel form (macOS)</li>
    </ul>
  </div>
</div>

<style>
  .demo-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 32px;
  }

  .demo-container h1 {
    grid-column: 1 / -1;
    margin: 0 0 24px 0;
    text-align: center;
    color: var(--text-primary);
  }

  .demo-controls {
    grid-column: 1 / -1;
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    gap: 24px;
    align-items: center;
    flex-wrap: wrap;
  }

  .demo-controls label {
    font-weight: 600;
    color: var(--text-primary);
  }

  .demo-controls select {
    margin-left: 8px;
    padding: 4px 8px;
    border: 1px solid var(--border-primary);
    border-radius: 4px;
  }

  .demo-controls button {
    padding: 6px 12px;
    background: var(--accent-blue);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: default;
    font-size: 14px;
  }

  .demo-form {
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    min-height: 600px;
  }

  .demo-info {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 16px;
    height: fit-content;
  }

  .demo-info h3 {
    margin: 0 0 12px 0;
    color: var(--text-primary);
    font-size: 16px;
  }

  .demo-info ul {
    margin: 0 0 24px 0;
    padding-left: 16px;
  }

  .demo-info li {
    margin-bottom: 6px;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .demo-info strong {
    color: var(--text-primary);
  }

  @media (max-width: 1024px) {
    .demo-container {
      grid-template-columns: 1fr;
      gap: 24px;
    }
  }
</style>
