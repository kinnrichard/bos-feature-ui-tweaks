<!--
  Client Detail Page
  
  Displays client information with view/edit modes and new client creation
  Supports both /clients/[id] and /clients/new routes
-->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ReactiveClient } from '$lib/models/reactive-client';
  import { Client } from '$lib/models/client';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import FormInput from '$lib/components/ui/FormInput.svelte';
  import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
  import type { CreateClientData, UpdateClientData } from '$lib/models/types/client-data';
  import { layoutActions } from '$lib/stores/layout.svelte';

  // Get client ID from URL params
  const clientId = $derived($page.params.id);
  const isNewClient = $derived(clientId === 'new');

  // Client data and loading states
  let clientQuery = $state<ReturnType<typeof ReactiveClient.find> | null>(null);
  let isEditing = $state(false);

  // Initialize edit mode for new clients
  $effect(() => {
    if (clientId === 'new') {
      isEditing = true;
    } else {
      // Reset to view mode when navigating to an existing client
      isEditing = false;
    }
  });
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  // Create new client object for new client mode
  const newClientObject = $derived(
    isNewClient
      ? Client.new({
          name: '',
          client_type: 'residential',
        })
      : null
  );

  // Form state
  let formData = $state({
    name: '',
    client_type: 'residential' as 'residential' | 'business',
  });

  // Initialize client query for existing clients
  $effect(() => {
    if (!isNewClient && clientId) {
      clientQuery = ReactiveClient.find(clientId);
    } else {
      clientQuery = null;
    }
  });

  // Update form data when client loads (only when not editing)
  $effect(() => {
    if (clientQuery?.data && !isNewClient && !isEditing) {
      formData.name = clientQuery.data.name || '';
      formData.client_type = clientQuery.data.client_type || 'residential';
    }
  });

  // Derived state
  const client = $derived(isNewClient ? newClientObject : clientQuery?.data || null);
  const queryLoading = $derived(clientQuery?.isLoading || false);
  const queryError = $derived(clientQuery?.error);

  // Helper functions
  function getClientTypeEmoji(type: string): string {
    return type === 'business' ? '🏢' : '🏠';
  }

  function getPageTitle(): string {
    if (isNewClient) return 'New Client - Faultless';
    if (client?.name) return `${client.name} - Faultless`;
    return 'Client - Faultless';
  }

  function getHeaderTitle(): string {
    if (isNewClient) return 'New Client';
    if (isEditing) return 'Edit Client';
    if (client?.name) return `${getClientTypeEmoji(client.client_type)} ${client.name}`;
    return 'Client';
  }

  // Form validation
  function validateForm(): string | null {
    const trimmedName = formData.name.trim();
    if (trimmedName.length < 2) {
      return 'Client name must be at least 2 characters long.';
    }
    return null;
  }

  // Event handlers
  function handleEdit() {
    if (client) {
      formData.name = client.name || '';
      formData.client_type = client.client_type || 'residential';
    }
    isEditing = true;
    error = null;
  }

  function handleCancel() {
    if (isNewClient) {
      goto('/clients');
      return;
    }

    // Reset form data to original values
    if (client) {
      formData.name = client.name || '';
      formData.client_type = client.client_type || 'residential';
    }

    isEditing = false;
    error = null;
  }

  async function handleSave() {
    const validationError = validateForm();
    if (validationError) {
      error = validationError;
      return;
    }

    isSaving = true;
    error = null;

    try {
      const trimmedName = formData.name.trim();

      if (isNewClient) {
        // Create new client
        const createData: CreateClientData = {
          name: trimmedName,
          client_type: formData.client_type,
        };

        const newClient = await Client.create(createData);

        // Navigate to the new client's page
        goto(`/clients/${newClient.id}`);
      } else if (client) {
        // Update existing client
        const updateData: UpdateClientData = {
          name: trimmedName,
          client_type: formData.client_type,
        };

        await Client.update(client.id, updateData);

        // Exit edit mode
        isEditing = false;

        // The reactive query will automatically update with new data
      }
    } catch (err) {
      console.error('Failed to save client:', err);
      error = err instanceof Error ? err.message : 'Failed to save client. Please try again.';
    } finally {
      isSaving = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isEditing) {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSave();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
      }
    }
  }

  // Client type options for SegmentedControl
  const clientTypeOptions = [
    { value: 'residential', label: 'Residential', icon: '🏠' },
    { value: 'business', label: 'Business', icon: '🏢' },
  ];

  // Focus management
  let nameInput: FormInput | null = $state(null);
  $effect(() => {
    if (isEditing && clientId === 'new' && nameInput) {
      // Auto-focus name input for new clients
      setTimeout(() => nameInput?.focus(), 100);
    }
  });

  // Derived validation state
  const canSave = $derived(validateForm() === null);

  // Set up client edit state in layout store
  $effect(() => {
    layoutActions.setClientEditState(isEditing, isNewClient);
    layoutActions.setSavingClient(isSaving);
    layoutActions.setCanSaveClient(canSave);
    layoutActions.setClientEditCallbacks({
      onEdit: handleEdit,
      onSave: handleSave,
      onCancel: handleCancel,
    });

    // Cleanup on unmount
    return () => {
      layoutActions.clearClientEditState();
    };
  });

  // Handle loading and error states
  const shouldShowLoading = $derived(queryLoading && !isNewClient);
  const shouldShowError = $derived(queryError && !isNewClient);
  const shouldShowContent = $derived(isNewClient || (!queryLoading && !queryError && client));
</script>

<svelte:head>
  <title>{getPageTitle()}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<AppLayout currentClient={client}>
  <div class="client-detail-page">
    <!-- Content -->
    <div class="client-content">
      {#if shouldShowLoading}
        <div class="loading-state">
          <LoadingSkeleton type="detail" />
        </div>
      {:else if shouldShowError}
        <div class="error-state">
          <h1>Error Loading Client</h1>
          <p>Could not load client information. Please try again.</p>
          <button class="retry-button" onclick={() => window.location.reload()}> Retry </button>
        </div>
      {:else if shouldShowContent}
        <div class="client-info">
          {#if isEditing}
            <!-- Edit Mode -->
            <div class="edit-form">
              <h1 class="page-title">{getHeaderTitle()}</h1>

              {#if error}
                <div class="form-error" role="alert">
                  {error}
                </div>
              {/if}

              <div class="form-group">
                <label for="client-name" class="form-label">Name</label>
                <FormInput
                  bind:this={nameInput}
                  id="client-name"
                  type="text"
                  bind:value={formData.name}
                  placeholder="Enter client name"
                  required
                  maxlength={255}
                  fullWidth={true}
                  ariaLabel="Client name"
                  ariaDescribedby={error ? 'name-error' : undefined}
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="client-type">Type</label>
                <SegmentedControl
                  id="client-type"
                  options={clientTypeOptions}
                  bind:value={formData.client_type}
                  fullWidth={true}
                  ariaLabel="Client type"
                />
              </div>
            </div>
          {:else}
            <!-- View Mode -->
            <div class="view-mode">
              <h1 class="client-title">
                {getHeaderTitle()}
              </h1>

              <div class="client-details">
                <div class="detail-item">
                  <span class="detail-label">Type</span>
                  <span class="detail-value">
                    {getClientTypeEmoji(client.client_type)}
                    {client.client_type === 'business' ? 'Business' : 'Residential'}
                  </span>
                </div>

                {#if client.created_at}
                  <div class="detail-item">
                    <span class="detail-label">Created</span>
                    <span class="detail-value">
                      {new Date(client.created_at).toLocaleDateString()}
                    </span>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</AppLayout>

<style>
  .client-detail-page {
    height: 100%;
    background-color: var(--bg-black, #000);
    display: flex;
    flex-direction: column;
  }

  /* Content */
  .client-content {
    flex: 1;
    padding: 32px 24px;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  /* View Mode */
  .view-mode {
    text-align: center;
  }

  .client-title {
    font-size: 32px;
    font-weight: 600;
    color: var(--text-primary, #f2f2f7);
    margin: 0 0 32px 0;
    line-height: 1.2;
  }

  .client-details {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 400px;
    margin: 0 auto;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-primary, #38383a);
  }

  .detail-label {
    font-size: 14px;
    color: var(--text-secondary, #c7c7cc);
    font-weight: 500;
  }

  .detail-value {
    font-size: 14px;
    color: var(--text-primary, #f2f2f7);
  }

  /* Edit Mode */
  .edit-form {
    max-width: 500px;
    margin: 0 auto;
  }

  .page-title {
    font-size: 32px;
    font-weight: 600;
    color: var(--text-primary, #f2f2f7);
    margin: 0 0 32px 0;
    text-align: center;
  }

  .form-group {
    margin-bottom: 24px;
  }

  .form-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #f2f2f7);
    margin-bottom: 8px;
  }

  .form-error {
    background-color: var(--bg-error, #2c1f1f);
    border: 1px solid var(--accent-red, #ff3b30);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 24px;
    color: var(--accent-red, #ff3b30);
    font-size: 14px;
  }

  /* States */
  .loading-state,
  .error-state {
    text-align: center;
    padding: 80px 20px;
  }

  .error-state h1 {
    font-size: 24px;
    color: var(--text-primary, #f2f2f7);
    margin-bottom: 16px;
  }

  .error-state p {
    color: var(--text-secondary, #c7c7cc);
    margin-bottom: 24px;
  }

  .retry-button {
    padding: 12px 24px;
    background-color: var(--accent-blue, #00a3ff);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: default;
    transition: all 0.15s ease;
  }

  .retry-button:hover {
    background-color: var(--accent-blue-hover, #0089e0);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .client-content {
      padding: 24px 16px;
    }

    .client-title {
      font-size: 36px;
    }
  }

  @media (max-width: 480px) {
    .client-title {
      font-size: 28px;
    }

    .page-title {
      font-size: 24px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .detail-item {
      border-bottom-width: 2px;
    }

    .form-error {
      border-width: 2px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .retry-button {
      transition: none;
    }
  }
</style>
