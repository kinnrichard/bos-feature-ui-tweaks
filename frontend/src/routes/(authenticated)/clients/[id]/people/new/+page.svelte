<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import PersonForm from '$lib/components/person/PersonForm.svelte';
  import { ReactiveClient } from '$lib/models/reactive-client';
  import { layoutActions } from '$lib/stores/layout.svelte';

  // Make clientId reactive to respond to route changes
  const clientId = $derived($page.params.id);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Reference to PersonForm component to trigger its save method
  let personFormRef: any;

  // Load client to ensure it exists and for layout
  const clientQuery = $derived(ReactiveClient.find(clientId));
  const client = $derived(clientQuery?.data);

  // Handle form events
  function handleSave() {
    // Navigate back to people list
    goto(`/clients/${clientId}/people`);
  }

  function handleCancel() {
    goto(`/clients/${clientId}/people`);
  }

  // Handle save from toolbar - trigger PersonForm's submit
  function handleToolbarSave() {
    if (personFormRef && typeof personFormRef.triggerSubmit === 'function') {
      personFormRef.triggerSubmit();
    }
  }

  // Derived validation state (for layout)
  const canSave = $derived(true); // PersonForm handles its own validation

  // Set up person edit state in layout store
  $effect(() => {
    layoutActions.setPersonEditState(true, true); // editing = true, isNew = true
    layoutActions.setSavingPerson(loading);
    layoutActions.setCanSavePerson(canSave);
    layoutActions.setPersonEditCallbacks({
      onSave: handleToolbarSave, // Bridge to PersonForm's submit
      onCancel: handleCancel,
    });
    layoutActions.setPageTitle('New Person');

    // Cleanup on unmount
    return () => {
      layoutActions.clearPersonEditState();
      layoutActions.clearPageTitle();
    };
  });
</script>

<AppLayout currentClient={client}>
  <div class="new-contact-page">
    <div class="contact-card">
      <PersonForm
        bind:this={personFormRef}
        mode="create"
        {clientId}
        {loading}
        {error}
        on:save={handleSave}
        on:cancel={handleCancel}
      />
    </div>
  </div>
</AppLayout>

<style>
  .new-contact-page {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 0px 24px;
  }

  .contact-card {
    width: auto;
    min-width: 250px;
    max-width: 90%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding-top: 16px;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .new-contact-page {
      padding: 0px 24px;
    }

    .contact-card {
      gap: 20px;
      min-width: 100%;
      width: 100%;
      max-width: 100%;
    }
  }

  @media (max-width: 480px) {
    .new-contact-page {
      padding: 0px 12px;
    }
  }
</style>
