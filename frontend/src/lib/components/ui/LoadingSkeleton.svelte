<script lang="ts">
  let {
    count = 5,
    type = 'generic' as 'job-card' | 'job-detail' | 'conversation-card' | 'generic',
  } = $props();
</script>

{#if type === 'job-card'}
  <!-- Job card skeleton that matches JobCard layout -->
  {#each Array(count) as _item, i}
    <div class="skeleton-job-card" data-testid="job-card-skeleton">
      <!-- Status emoji skeleton -->
      <div class="skeleton-emoji"></div>

      <!-- Job name section skeleton -->
      <div class="skeleton-job-content">
        <div class="skeleton-client-name"></div>
        <div class="skeleton-job-title"></div>
      </div>

      <!-- Right section skeleton -->
      <div class="skeleton-right-section">
        <!-- Priority emoji skeleton (randomly show/hide) -->
        {#if i % 3 === 0}
          <div class="skeleton-priority-emoji"></div>
        {/if}

        <!-- Technician avatars skeleton (random 1-3 avatars) -->
        <div class="skeleton-technician-avatars">
          {#each Array(Math.min(3, Math.max(1, (i % 3) + 1))) as _avatar}
            <div class="skeleton-avatar"></div>
          {/each}
        </div>
      </div>
    </div>
  {/each}
{:else if type === 'job-detail'}
  <!-- Job detail skeleton that matches JobDetailView layout -->
  <div class="skeleton-job-detail" data-testid="job-detail-skeleton">
    <!-- Job Header Skeleton -->
    <div class="skeleton-job-header">
      <div class="skeleton-header-main">
        <div class="skeleton-title-section">
          <div class="skeleton-title-row">
            <div class="skeleton-large-emoji"></div>
            <div class="skeleton-job-title-large"></div>
            <div class="skeleton-priority-badge"></div>
          </div>
          <div class="skeleton-meta-row">
            <div class="skeleton-client-meta"></div>
            <div class="skeleton-job-id"></div>
          </div>
        </div>
        <div class="skeleton-status-section">
          <div class="skeleton-status-badge"></div>
          <div class="skeleton-priority-badge-small"></div>
        </div>
      </div>
      <div class="skeleton-description"></div>
    </div>

    <!-- Content Grid Skeleton -->
    <div class="skeleton-content-grid">
      <!-- Job Info Panel Skeleton -->
      <div class="skeleton-info-panel">
        <div class="skeleton-panel-header"></div>
        <div class="skeleton-info-groups">
          {#each Array(4) as _group}
            <div class="skeleton-info-group">
              <div class="skeleton-group-header"></div>
              <div class="skeleton-info-items">
                {#each Array(3) as _item}
                  <div class="skeleton-info-item">
                    <div class="skeleton-info-label"></div>
                    <div class="skeleton-info-value"></div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Client Info Panel Skeleton -->
      <div class="skeleton-info-panel">
        <div class="skeleton-panel-header"></div>
        <div class="skeleton-client-identity">
          <div class="skeleton-client-avatar"></div>
          <div class="skeleton-client-details">
            <div class="skeleton-client-name"></div>
            <div class="skeleton-client-id"></div>
          </div>
        </div>
        <div class="skeleton-info-groups">
          {#each Array(2) as _group}
            <div class="skeleton-info-group">
              <div class="skeleton-group-header"></div>
              <div class="skeleton-info-items">
                {#each Array(3) as _item}
                  <div class="skeleton-info-item">
                    <div class="skeleton-info-label"></div>
                    <div class="skeleton-info-value"></div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Tasks Section Skeleton -->
    <div class="skeleton-tasks-section">
      <div class="skeleton-tasks-header">
        <div class="skeleton-section-title"></div>
        <div class="skeleton-task-count"></div>
      </div>
      <div class="skeleton-task-list">
        {#each Array(3) as _task}
          <div class="skeleton-task-item">
            <div class="skeleton-task-content">
              <div class="skeleton-task-status"></div>
              <div class="skeleton-task-title"></div>
              <div class="skeleton-task-description"></div>
            </div>
            <div class="skeleton-task-actions">
              <div class="skeleton-action-button"></div>
              <div class="skeleton-action-button"></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{:else if type === 'conversation-card'}
  <!-- Conversation card skeleton that matches ConversationCard layout -->
  {#each Array(count) as _item}
    <div class="skeleton-conversation-card" data-testid="conversation-card-skeleton">
      <!-- Status emoji skeleton -->
      <div class="skeleton-emoji"></div>

      <!-- Conversation content section skeleton -->
      <div class="skeleton-conversation-content">
        <div class="skeleton-recipient-handle"></div>
        <div class="skeleton-conversation-subject"></div>
      </div>

      <!-- Right section skeleton -->
      <div class="skeleton-right-section">
        <div class="skeleton-waiting-time"></div>
      </div>
    </div>
  {/each}
{:else}
  <!-- Generic skeleton -->
  {#each Array(count) as _item}
    <div class="skeleton-generic">
      <div class="skeleton-line skeleton-line--title"></div>
      <div class="skeleton-line skeleton-line--subtitle"></div>
    </div>
  {/each}
{/if}

<style>
  .skeleton-job-card {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    margin-bottom: 8px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  .skeleton-emoji {
    width: 16px;
    height: 16px;
    margin-right: 12px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
    flex-shrink: 0;
  }

  .skeleton-job-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .skeleton-client-name {
    width: 60%;
    height: 12px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-job-title {
    width: 80%;
    height: 14px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-right-section {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .skeleton-priority-emoji {
    width: 14px;
    height: 14px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-technician-avatars {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .skeleton-avatar {
    width: 24px;
    height: 24px;
    background-color: var(--bg-tertiary);
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Conversation card skeleton styles */
  .skeleton-conversation-card {
    display: flex;
    align-items: flex-start;
    padding: 12px 16px;
    margin-bottom: 8px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
    gap: 12px;
  }

  .skeleton-conversation-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .skeleton-recipient-handle {
    width: 70%;
    height: 14px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-conversation-subject {
    width: 85%;
    height: 15px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-waiting-time {
    width: 50px;
    height: 12px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
    margin-top: 2px;
  }

  .skeleton-generic {
    padding: 16px;
    margin-bottom: 8px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  .skeleton-line {
    height: 16px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .skeleton-line--title {
    width: 75%;
  }

  .skeleton-line--subtitle {
    width: 50%;
    margin-bottom: 0;
  }

  /* Job Detail Skeleton Styles */
  .skeleton-job-detail {
    display: flex;
    flex-direction: column;
    gap: 32px;
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  .skeleton-job-header {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 12px;
    padding: 24px;
  }

  .skeleton-header-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 16px;
  }

  .skeleton-title-section {
    flex: 1;
    min-width: 0;
  }

  .skeleton-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .skeleton-large-emoji {
    width: 24px;
    height: 24px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
    flex-shrink: 0;
  }

  .skeleton-job-title-large {
    height: 28px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
    flex: 1;
    min-width: 0;
  }

  .skeleton-priority-badge {
    width: 20px;
    height: 20px;
    background-color: var(--bg-tertiary);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .skeleton-meta-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .skeleton-client-meta {
    width: 120px;
    height: 14px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-job-id {
    width: 80px;
    height: 12px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-status-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }

  .skeleton-status-badge {
    width: 100px;
    height: 28px;
    background-color: var(--bg-tertiary);
    border-radius: 20px;
  }

  .skeleton-priority-badge-small {
    width: 80px;
    height: 24px;
    background-color: var(--bg-tertiary);
    border-radius: 20px;
  }

  .skeleton-description {
    width: 70%;
    height: 16px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-primary);
  }

  .skeleton-content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }

  .skeleton-info-panel {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 12px;
    padding: 24px;
  }

  .skeleton-panel-header {
    width: 140px;
    height: 18px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
    margin-bottom: 20px;
  }

  .skeleton-client-identity {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  }

  .skeleton-client-avatar {
    width: 48px;
    height: 48px;
    background-color: var(--bg-tertiary);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .skeleton-client-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .skeleton-client-name {
    width: 80%;
    height: 20px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-client-id {
    width: 60%;
    height: 12px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-info-groups {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .skeleton-info-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skeleton-group-header {
    width: 100px;
    height: 14px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-info-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .skeleton-info-label {
    width: 80px;
    height: 13px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
    flex-shrink: 0;
  }

  .skeleton-info-value {
    width: 60%;
    height: 13px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-tasks-section {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 12px;
    padding: 24px;
  }

  .skeleton-tasks-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .skeleton-section-title {
    width: 60px;
    height: 20px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-task-count {
    width: 120px;
    height: 14px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-task-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
  }

  .skeleton-task-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-task-status {
    width: 80px;
    height: 12px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-task-title {
    width: 90%;
    height: 14px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-task-description {
    width: 70%;
    height: 13px;
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }

  .skeleton-task-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
  }

  .skeleton-action-button {
    width: 28px;
    height: 28px;
    background-color: var(--bg-tertiary);
    border-radius: 6px;
  }

  @keyframes skeleton-pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
    100% {
      opacity: 1;
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .skeleton-job-card {
      padding: 10px 12px;
    }

    .skeleton-client-name {
      height: 11px;
    }

    .skeleton-job-title {
      height: 13px;
    }

    /* Conversation card responsive */
    .skeleton-conversation-card {
      padding: 10px 12px;
    }

    .skeleton-recipient-handle {
      height: 13px;
    }

    .skeleton-conversation-subject {
      height: 14px;
    }

    .skeleton-waiting-time {
      width: 40px;
      height: 11px;
    }

    /* Job Detail Responsive */
    .skeleton-job-detail {
      gap: 24px;
    }

    .skeleton-job-header {
      padding: 20px;
    }

    .skeleton-header-main {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }

    .skeleton-content-grid {
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .skeleton-info-panel {
      padding: 20px;
    }

    .skeleton-tasks-section {
      padding: 20px;
    }
  }

  @media (max-width: 1024px) {
    .skeleton-content-grid {
      grid-template-columns: 1fr;
      gap: 24px;
    }
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .skeleton-job-card,
    .skeleton-job-detail,
    .skeleton-generic {
      animation: none;
    }
  }
</style>
