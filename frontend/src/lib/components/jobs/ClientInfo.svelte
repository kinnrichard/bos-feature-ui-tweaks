<script lang="ts">
  let {
    client
  }: {
    client: {
      id: string;
      name: string;
      created_at: string;
      updated_at: string;
    };
  } = $props();

  function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function getClientInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // Future: This could be expanded to include more client data
  // like contact info, address, etc. when available in the API
</script>

<div class="client-info-panel">
  <div class="panel-header">
    <h3>Client Information</h3>
  </div>

  <div class="client-main">
    <!-- Client Avatar and Name -->
    <div class="client-identity">
      <div class="client-avatar">
        {getClientInitials(client.name)}
      </div>
      <div class="client-details">
        <h4 class="client-name">{client.name}</h4>
        <span class="client-id">ID: {client.id}</span>
      </div>
    </div>

    <!-- Client Information Grid -->
    <div class="client-info-grid">
      <div class="info-group">
        <h5>Account Details</h5>
        <div class="info-items">
          <div class="info-item">
            <span class="info-label">Client Since</span>
            <span class="info-value">{formatDateTime(client.created_at)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Last Updated</span>
            <span class="info-value">{formatDateTime(client.updated_at)}</span>
          </div>
        </div>
      </div>

      <!-- Placeholder for future client data -->
      <div class="info-group">
        <h5>Contact Information</h5>
        <div class="info-items">
          <div class="info-item">
            <span class="info-label">Email</span>
            <span class="info-value no-data">Not available</span>
          </div>
          <div class="info-item">
            <span class="info-label">Phone</span>
            <span class="info-value no-data">Not available</span>
          </div>
          <div class="info-item">
            <span class="info-label">Address</span>
            <span class="info-value no-data">Not available</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions (Future Enhancement) -->
    <div class="client-actions">
      <div class="action-buttons">
        <button class="action-button" disabled>
          <span class="action-icon">📞</span>
          <span>Contact</span>
        </button>
        <button class="action-button" disabled>
          <span class="action-icon">📍</span>
          <span>Location</span>
        </button>
        <button class="action-button" disabled>
          <span class="action-icon">📄</span>
          <span>History</span>
        </button>
      </div>
      <p class="action-note">Additional client features coming soon</p>
    </div>
  </div>
</div>

<style>
  .client-info-panel {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 12px;
    padding: 24px;
    height: fit-content;
  }

  .panel-header {
    margin-bottom: 20px;
  }

  .panel-header h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .client-main {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .client-identity {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .client-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: var(--accent-blue);
    color: white;
    font-size: 16px;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
    text-shadow: 0.5px 0.5px 2px rgba(0, 0, 0, 0.75);
  }

  .client-details {
    flex: 1;
    min-width: 0;
  }

  .client-name {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 4px 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .client-id {
    font-size: 12px;
    color: var(--text-tertiary);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .client-info-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .info-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .info-group h5 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .info-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .info-label {
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 500;
    flex-shrink: 0;
    min-width: 80px;
  }

  .info-value {
    font-size: 13px;
    color: var(--text-primary);
    text-align: right;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .no-data {
    color: var(--text-tertiary);
    font-style: italic;
  }

  .client-actions {
    border-top: 1px solid var(--border-primary);
    padding-top: 20px;
  }

  .action-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .action-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    cursor: not-allowed;
    transition: all 0.15s ease;
    opacity: 0.6;
  }

  .action-button:not(:disabled) {
    opacity: 1;
  }

  .action-button:not(:disabled):hover {
    background-color: var(--bg-primary);
    border-color: var(--accent-blue);
    color: var(--text-primary);
  }

  .action-icon {
    font-size: 16px;
  }

  .action-note {
    font-size: 11px;
    color: var(--text-tertiary);
    text-align: center;
    margin: 0;
    font-style: italic;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .client-info-panel {
      padding: 20px;
    }

    .client-identity {
      gap: 12px;
    }

    .client-avatar {
      width: 40px;
      height: 40px;
      font-size: 14px;
    }

    .client-name {
      font-size: 18px;
    }

    .info-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .info-label {
      min-width: auto;
    }

    .info-value {
      text-align: left;
    }

    .action-buttons {
      grid-template-columns: 1fr;
      gap: 6px;
    }

    .action-button {
      flex-direction: row;
      justify-content: center;
      padding: 10px 12px;
    }
  }

  @media (max-width: 480px) {
    .client-info-panel {
      padding: 16px;
    }

    .client-main {
      gap: 20px;
    }

    .client-info-grid {
      gap: 16px;
    }

    .action-buttons {
      gap: 4px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .client-info-panel {
      border-width: 2px;
    }

    .client-actions {
      border-top-width: 2px;
    }

    .action-button {
      border-width: 2px;
    }
  }
</style>