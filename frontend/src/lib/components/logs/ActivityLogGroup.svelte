<script lang="ts">
  import type { ActivityLogData } from '$lib/models/types/activity-log-data';
  import type { ClientData } from '$lib/models/types/client-data';
  import type { JobData } from '$lib/models/types/job-data';
  import EntityEmoji from './EntityEmoji.svelte';
  import ActivityLogRow from './ActivityLogRow.svelte';
  import ActivityLogDateHeader from './ActivityLogDateHeader.svelte';

  interface Props {
    groupType: 'general' | 'client' | 'job' | 'cross-reference';
    client?: ClientData;
    job?: JobData;
    logs: ActivityLogData[];
    isCollapsed?: boolean;
  }

  let { 
    groupType, 
    client, 
    job, 
    logs,
    isCollapsed = false
  }: Props = $props();

  let collapsed = $state(isCollapsed);

  function toggleCollapse() {
    collapsed = !collapsed;
  }

  // Group logs by date for display
  const logsByDate = $derived(() => {
    const dateGroups = new Map<string, ActivityLogData[]>();
    
    logs.forEach(log => {
      const date = new Date(log.created_at);
      const dateKey = date.toDateString();
      
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      
      dateGroups.get(dateKey)!.push(log);
    });
    
    // Sort dates (newest first)
    return Array.from(dateGroups.entries()).sort((a, b) => {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    });
  });
</script>

<div class="activity-log-group">
  <button 
    class="group-header"
    onclick={toggleCollapse}
    type="button"
  >
    <span class="header-content">
      {#if groupType === 'cross-reference'}
        <span class="cross-ref-indicator">🔗</span>
        <span>Cross-Reference</span>
        {#if client && job}
          <span class="separator">›</span>
          <EntityEmoji entityType="Client" entity={client} />
          <span class="client-name">{client.name}</span>
          <span class="separator">›</span>
          <EntityEmoji entityType="Job" />
          <span>{job.title}</span>
        {/if}
      {:else if client && job}
        <EntityEmoji entityType="Client" entity={client} />
        <span class="client-name">{client.name}</span>
        <span class="separator">›</span>
        <EntityEmoji entityType="Job" />
        <span>{job.title}</span>
      {:else if client}
        <EntityEmoji entityType="Client" entity={client} />
        <span>{client.name}</span>
      {:else if groupType === 'general'}
        <span class="system-indicator">⚙️</span>
        <span>System Activity</span>
      {/if}
    </span>
    <span class="log-count">({logs.length})</span>
    <span class="chevron" class:rotated={!collapsed}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
  </button>

  {#if !collapsed}
    <div class="group-content">
      {#each logsByDate() as [dateKey, dateLogs]}
        <ActivityLogDateHeader date={dateKey} />
        <div class="date-logs">
          {#each dateLogs as log (log.id)}
            <ActivityLogRow {log} />
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .activity-log-group {
    margin-bottom: 1rem;
    border: 1px solid var(--border-primary);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .group-header {
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: var(--bg-secondary);
    border: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
    transition: background-color 0.2s;
  }

  .group-header:hover {
    background-color: var(--bg-tertiary);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .client-name {
    font-weight: 500;
  }

  .separator {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .cross-ref-indicator,
  .system-indicator {
    font-size: 1rem;
    margin-right: 0.25rem;
  }

  .cross-ref-indicator {
    color: var(--accent-orange, #FF9500);
  }

  .system-indicator {
    color: var(--text-secondary);
  }

  .log-count {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-left: 0.5rem;
  }

  .chevron {
    transition: transform 0.2s;
    color: var(--text-secondary);
  }

  .chevron.rotated {
    transform: rotate(-180deg);
  }

  .group-content {
    padding: 0;
    border-top: 1px solid var(--border-primary);
    background-color: var(--bg-primary);
  }

  .date-logs {
    padding: 0 1rem;
  }
</style>