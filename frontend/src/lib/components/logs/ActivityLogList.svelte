<script lang="ts">
  import type { ActivityLogData } from '$lib/models/types/activity-log-data';
  import type { ClientData } from '$lib/models/types/client-data';
  import type { JobData } from '$lib/models/types/job-data';
  import type { ReactiveQuery } from '$lib/models/base/types';
  import ReactiveView from '$lib/reactive/ReactiveView.svelte';
  import ActivityLogEmpty from './ActivityLogEmpty.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
  import ActivityTypeEmoji from '$lib/components/ui/ActivityTypeEmoji.svelte';
  import {
    getTaskStatusEmoji,
    getJobStatusEmoji,
    getTaskPriorityEmoji,
    getJobPriorityEmoji,
  } from '$lib/config/emoji';
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  interface Props {
    logs?: ActivityLogData[]; // Made optional for backward compatibility
    context?: 'system' | 'client';
    isLoading?: boolean; // Deprecated in favor of ReactiveView
    error?: Error | null; // Deprecated in favor of ReactiveView
    // New ReactiveView integration
    logsQuery?: ReactiveQuery<ActivityLogData[]>;
    strategy?: 'progressive' | 'blocking';
  }

  interface LogGroup {
    key: string;
    type: 'general' | 'client' | 'job' | 'cross-reference';
    client?: ClientData;
    job?: JobData;
    logs: ActivityLogData[];
    priority: number; // For sorting groups
    lastActivity: Date; // For recency sorting
  }

  let {
    logs = [],
    context = 'system',
    isLoading = false,
    error = null,
    logsQuery,
    strategy = 'progressive',
  }: Props = $props();

  let tableContainer = $state<HTMLElement>();
  let groupStates = $state<Record<string, boolean>>({});
  let autoScrolled = $state<boolean>(false);

  // Helper function to toggle group collapse state
  function toggleGroup(group: LogGroup) {
    groupStates[group.key] = !(groupStates[group.key] ?? true);
  }

  // Helper function to get group collapsed state
  function isGroupCollapsed(groupKey: string): boolean {
    return groupStates[groupKey] ?? true; // Default to collapsed
  }

  // Helper function to get group header CSS class
  function getGroupHeaderClass(groupType: LogGroup['type']): string {
    switch (groupType) {
      case 'general':
        return 'logs-group-header--general';
      case 'cross-reference':
        return 'logs-group-header--cross-reference';
      default:
        return '';
    }
  }

  // Helper function to render group title (now returns object for component use)
  function getGroupTitleData(group: LogGroup): { type: LogGroup['type']; text: string } {
    let text: string;

    switch (group.type) {
      case 'client':
        text = `${group.client?.name || 'Unknown Client'}`;
        break;
      case 'job':
        text = `${group.job?.title || 'Unknown Job'} for ${group.client?.name || 'Unknown Client'}`;
        break;
      case 'cross-reference':
        text = `${group.job?.title || 'Unknown Job'} for ${group.client?.name || 'Unknown Client'}} (Cross-reference)`;
        break;
      case 'general':
        text = 'General Activity';
        break;
      default:
        text = 'Activity';
    }

    return { type: group.type, text };
  }

  // Helper function to group logs by date
  function getLogsByDate(logs: ActivityLogData[]): [string, ActivityLogData[]][] {
    const dateGroups = new Map<string, ActivityLogData[]>();

    logs.forEach((log) => {
      const date = new Date(log.created_at);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format

      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)!.push(log);
    });

    // Sort by date ascending (oldest first, recent at bottom)
    return Array.from(dateGroups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }

  // Helper function to format date headers
  function formatDateHeader(dateKey: string): string {
    const date = new Date(dateKey);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateKey === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateKey === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  }

  // Helper function to format log messages with rich content matching Rails logic
  function formatLogMessage(log: ActivityLogData): string {
    const loggableTypeEmoji = getLoggableTypeEmoji(log.loggable_type);
    const loggableName = getLoggableName(log);
    const metadata = log.metadata || {};

    switch (log.action) {
      case 'created':
        return `created ${loggableTypeEmoji} ${loggableName}`;

      case 'viewed':
        return `viewed ${loggableTypeEmoji} ${loggableName}`;

      case 'renamed': {
        const oldName = metadata.old_name || 'Unknown';
        const newName = metadata.name || loggableName;
        return `renamed ${loggableTypeEmoji} ${oldName} to ${loggableTypeEmoji} ${newName}`;
      }

      case 'updated': {
        if (metadata.changes) {
          // Filter out unimportant attributes
          const filteredChanges = Object.fromEntries(
            Object.entries(metadata.changes).filter(
              ([field]) =>
                !['position', 'lock_version', 'reordered_at', 'parent_id'].includes(field)
            )
          );

          const changeKeys = Object.keys(filteredChanges);

          if (changeKeys.length === 0) {
            return null; // Hide unimportant updates
          }

          // Handle special field changes
          if (changeKeys.length === 1 && changeKeys[0] === 'priority') {
            const [, newPriority] = filteredChanges.priority;
            // Use appropriate priority emoji function based on loggable type
            const priorityEmoji =
              log.loggable_type === 'Job'
                ? getJobPriorityEmoji(newPriority)
                : getTaskPriorityEmoji(newPriority);
            return `marked ${loggableTypeEmoji} ${loggableName} as ${priorityEmoji} ${newPriority?.charAt(0)?.toUpperCase() + newPriority?.slice(1)} Priority`;
          }

          if (changeKeys.length === 1 && changeKeys[0] === 'assigned_to_id') {
            const [, newId] = filteredChanges.assigned_to_id;
            if (!newId) {
              return `unassigned ${loggableTypeEmoji} ${loggableName}`;
            } else {
              // Look up user name from metadata or use fallback
              const assignedToName = metadata.assigned_to || `user #${newId}`;
              return `assigned ${loggableTypeEmoji} ${loggableName} to ${assignedToName}`;
            }
          }

          // Format other changes
          const changesText = changeKeys
            .map((field) => {
              const [oldValue, newValue] = filteredChanges[field];
              return `${field}: ${oldValue} → ${newValue}`;
            })
            .join(', ');

          return `updated ${loggableName}: ${changesText}`;
        }
        return `updated ${loggableTypeEmoji} ${loggableName}`;
      }

      case 'deleted':
        return `deleted ${loggableTypeEmoji} ${loggableName}`;

      case 'assigned': {
        const assignedTo = metadata.assigned_to || 'someone';
        return `assigned ${loggableTypeEmoji} ${loggableName} to ${assignedTo}`;
      }

      case 'unassigned': {
        const unassignedFrom = metadata.unassigned_from || 'someone';
        return `unassigned ${unassignedFrom} from ${loggableTypeEmoji} ${loggableName}`;
      }

      case 'status_changed': {
        const newStatusLabel = metadata.new_status_label || metadata.new_status || 'Unknown';
        const statusEmoji = getStatusEmoji(metadata.new_status, log.loggable_type);
        return `set ${loggableTypeEmoji} ${loggableName} to ${statusEmoji} ${newStatusLabel}`;
      }

      case 'added': {
        const parentType = metadata.parent_type || 'container';
        const parentName = metadata.parent_name || 'Unknown';
        return `added ${loggableTypeEmoji} ${loggableName} to ${parentType} ${parentName}`;
      }

      case 'logged_in':
        return 'signed into bŏs';

      case 'logged_out':
        return 'signed out of bŏs';

      default:
        return `${log.action} ${loggableName}`;
    }
  }

  // Helper function to get emoji for loggable types
  function getLoggableTypeEmoji(loggableType: string): string {
    // Use EntityEmoji's logic but return string for now
    switch (loggableType) {
      case 'Client':
        return '🏢'; // Could be 🏠 for residential, but we'd need the client data
      case 'Job':
        return '💼';
      case 'Task':
        return '☑️';
      case 'Person':
        return '👤';
      default:
        return '';
    }
  }

  // Helper function to get loggable name
  function getLoggableName(log: ActivityLogData): string {
    const metadata = log.metadata || {};

    if (metadata.name) {
      return metadata.name;
    }

    // Try to get name from the related objects
    switch (log.loggable_type) {
      case 'Client':
        return log.client?.name || 'Unknown Client';
      case 'Job':
        return log.job?.title || 'Unknown Job';
      case 'Task':
        return metadata.title || 'Unknown Task';
      case 'Person': {
        const personName = metadata.person_name || 'Unknown Person';
        const clientName = log.client?.name || 'Unknown Client';
        const clientEmoji = log.client?.business ? '🏢' : '🏠';
        return `${personName} with ${clientEmoji} ${clientName}`;
      }
      default:
        return log.loggable_type || 'Unknown';
    }
  }

  // Helper function to get status emoji based on entity type
  function getStatusEmoji(status: string, loggableType?: string): string {
    if (loggableType === 'Task') {
      return getTaskStatusEmoji(status);
    } else if (loggableType === 'Job') {
      return getJobStatusEmoji(status);
    }

    // Fallback for other types
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'done':
        return '✅';
      case 'in_progress':
      case 'working':
        return '🔄';
      case 'pending':
      case 'waiting':
        return '⏳';
      case 'cancelled':
      case 'canceled':
        return '❌';
      case 'on_hold':
        return '⏸️';
      default:
        return '📋';
    }
  }

  // Helper function to check if log has duplicates
  function hasDuplicates(log: ActivityLogData): boolean {
    return !!(log.metadata?.duplicateCount && log.metadata.duplicateCount > 1);
  }

  // Helper function to get duplicate count
  function getDuplicateCount(log: ActivityLogData): number {
    return log.metadata?.duplicateCount || 1;
  }

  // Helper function to format timestamps
  function formatTimestamp(createdAt: string): string {
    const date = new Date(createdAt);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Auto-scroll to bottom on mount and when new logs arrive
  $effect(() => {
    if (tableContainer && logs.length > 0) {
      requestAnimationFrame(() => {
        if (!autoScrolled) {
          tableContainer.scrollTop = tableContainer.scrollHeight;
          autoScrolled = true;
        }
      });
    }
  });

  // Enhanced grouping algorithm with duplicate detection and cross-references
  const groupedLogs = $derived(() => {
    // Step 1: Detect and group duplicate actions
    const processedLogs = detectDuplicateActions(logs);

    // Step 2: Create context groups
    const groups = new Map<string, LogGroup>();

    processedLogs.forEach((log) => {
      const { groupKey, groupType, priority } = determineLogGroup(log);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          type: groupType,
          client: log.client,
          job: log.job,
          logs: [],
          priority,
          lastActivity: new Date(log.created_at),
        });
      }

      const group = groups.get(groupKey)!;
      group.logs.push(log);

      // Update last activity time for recency sorting
      const logDate = new Date(log.created_at);
      if (logDate > group.lastActivity) {
        group.lastActivity = logDate;
      }
    });

    // Step 3: Enhanced sorting with priority and recency
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      // First by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then by oldest activity first (most recent last)
      return a.lastActivity.getTime() - b.lastActivity.getTime();
    });

    // Step 4: Initialize collapsed states - all groups collapsed by default
    sortedGroups.forEach((group) => {
      if (!(group.key in groupStates)) {
        groupStates[group.key] = true; // Default to collapsed
      }
    });

    return sortedGroups;
  });

  // New function for ReactiveView integration
  function groupLogsByContext(logData: ActivityLogData[]): LogGroup[] {
    // Step 1: Detect and group duplicate actions
    const processedLogs = detectDuplicateActions(logData);

    // Step 2: Create context groups
    const groups = new Map<string, LogGroup>();

    processedLogs.forEach((log) => {
      const { groupKey, groupType, priority } = determineLogGroup(log);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          type: groupType,
          client: log.client,
          job: log.job,
          logs: [],
          priority,
          lastActivity: new Date(log.created_at),
        });
      }

      const group = groups.get(groupKey)!;
      group.logs.push(log);

      // Update last activity time for recency sorting
      const logDate = new Date(log.created_at);
      if (logDate > group.lastActivity) {
        group.lastActivity = logDate;
      }
    });

    // Step 3: Enhanced sorting with priority and recency
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      // First by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then by oldest activity first (most recent last)
      return a.lastActivity.getTime() - b.lastActivity.getTime();
    });

    // Step 4: Initialize collapsed states - all groups collapsed by default
    sortedGroups.forEach((group) => {
      if (!(group.key in groupStates)) {
        groupStates[group.key] = true; // Default to collapsed
      }
    });

    return sortedGroups;
  }

  // Helper function to detect duplicate actions within time windows
  function detectDuplicateActions(logs: ActivityLogData[]): ActivityLogData[] {
    const duplicateWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
    const duplicateGroups = new Map<string, ActivityLogData[]>();

    // Group potentially duplicate actions
    logs.forEach((log) => {
      const actionKey = `${log.action}-${log.loggable_type}-${log.loggable_id}-${log.user_id}`;
      const logTime = new Date(log.created_at).getTime();

      // Find existing group within time window
      let foundGroup = false;
      for (const [key, group] of duplicateGroups) {
        if (key.startsWith(actionKey)) {
          const groupTime = new Date(group[0].created_at).getTime();
          if (Math.abs(logTime - groupTime) <= duplicateWindow) {
            group.push(log);
            foundGroup = true;
            break;
          }
        }
      }

      if (!foundGroup) {
        duplicateGroups.set(`${actionKey}-${logTime}`, [log]);
      }
    });

    // Process groups to mark duplicates
    const processedLogs: ActivityLogData[] = [];
    for (const group of duplicateGroups.values()) {
      if (group.length > 1) {
        // Keep the most recent log and mark it with duplicate count
        const sortedGroup = group.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const primaryLog = { ...sortedGroup[0] };

        // Add duplicate metadata
        primaryLog.metadata = {
          ...primaryLog.metadata,
          duplicateCount: group.length,
          duplicateTimespan: {
            start: sortedGroup[sortedGroup.length - 1].created_at,
            end: sortedGroup[0].created_at,
          },
        };

        processedLogs.push(primaryLog);
      } else {
        processedLogs.push(group[0]);
      }
    }

    return processedLogs.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  // Helper function to determine group classification and priority
  function determineLogGroup(log: ActivityLogData): {
    groupKey: string;
    groupType: LogGroup['type'];
    priority: number;
  } {
    // True cross-reference detection: only for explicitly marked cross-references
    // or operations that genuinely span multiple unrelated contexts
    const isCrossReference =
      log.metadata?.cross_reference || log.metadata?.is_cross_reference === true;

    if (isCrossReference) {
      return {
        groupKey: `cross-ref-${log.client_id}-${log.job_id}`,
        groupType: 'cross-reference',
        priority: 2, // Medium priority
      };
    }

    // If we have both client_id and job_id, this is job-specific activity
    // (tasks within jobs, job updates, etc.)
    if (log.client_id && log.job_id) {
      return {
        groupKey: `job-${log.job_id}`,
        groupType: 'job',
        priority: 1, // High priority - most specific context
      };
    }

    if (log.client_id && !log.job_id) {
      return {
        groupKey: `client-${log.client_id}`,
        groupType: 'client',
        priority: 3, // Lower priority - broader context
      };
    }

    return {
      groupKey: 'general',
      groupType: 'general',
      priority: 4, // Lowest priority - system-wide actions
    };
  }
</script>

<div class="logs-container" data-testid="activity-log-list" data-context={context}>
  {#if logsQuery}
    <!-- New ReactiveView integration -->
    <ReactiveView query={logsQuery} {strategy}>
      {#snippet loading()}
        <LoadingSkeleton type="generic" count={8} />
      {/snippet}

      {#snippet error({ error, refresh })}
        <div class="error-state">
          <div class="error-content">
            <h2>Unable to load activity logs</h2>
            <p>Zero.js will automatically retry. Please check your connection.</p>
            <div class="error-details">
              <code>{error?.message || 'Unknown error'}</code>
            </div>
            <button onclick={refresh} class="button button--primary">Retry</button>
          </div>
        </div>
      {/snippet}

      {#snippet empty()}
        <ActivityLogEmpty {context} />
      {/snippet}

      {#snippet content({ data, isLoading, isFresh })}
        <div class="logs-table-container" bind:this={tableContainer}>
          <!-- Show refresh indicator when data is being updated -->
          {#if isLoading && data.length > 0}
            <div class="refresh-indicator">
              <span class="refresh-icon">🔄</span>
              Refreshing logs...
            </div>
          {/if}

          <!-- Show data freshness indicator -->
          {#if !isFresh}
            <div class="stale-data-notice">
              <span class="warning-icon">⚠️</span>
              Showing cached data. <button onclick={() => logsQuery?.refresh()}>Refresh</button>
            </div>
          {/if}

          {#each groupLogsByContext(data || []) as group (group.key)}
            <div class="logs-group-container" data-testid="logs-group-container">
              <table class="logs-table">
                <tbody>
                  <!-- Group header row -->
                  <tr
                    class="logs-group-header {getGroupHeaderClass(group.type)} {isGroupCollapsed(
                      group.key
                    )
                      ? 'logs-group--collapsed'
                      : ''}"
                    onclick={() => toggleGroup(group)}
                    data-testid="logs-group-header"
                    data-group-key={group.key}
                  >
                    <td colspan="3">
                      <div class="logs-group-header-content">
                        <span class="logs-group-toggle">
                          <img
                            src="/icons/chevron-right.svg"
                            alt={isGroupCollapsed(group.key) ? 'Expand' : 'Collapse'}
                            class="chevron-icon"
                            class:expanded={!isGroupCollapsed(group.key)}
                            width="8"
                            height="12"
                          />
                        </span>

                        <span class="logs-group-title">
                          <ActivityTypeEmoji type={group.type} size="small" />
                          <span>{getGroupTitleData(group).text}</span>
                        </span>

                        <span class="logs-group-count">{group.logs.length}</span>
                      </div>
                    </td>
                  </tr>

                  {#if !isGroupCollapsed(group.key)}
                    <tr class="group-content-wrapper">
                      <td colspan="3" class="group-wrapper-cell">
                        <div
                          class="group-content-container"
                          transition:slide|global={{ duration: 250, easing: quintOut }}
                        >
                          <table class="nested-logs-table">
                            <tbody>
                              {#each getLogsByDate(group.logs) as [dateKey, dateLogs]}
                                <!-- Date header row -->
                                <tr class="logs-table__date-header logs-group-content">
                                  <th class="logs-table__date-header-cell" scope="col">
                                    <span class="date-header-user">User</span>
                                  </th>
                                  <th class="logs-table__date-header-cell" colspan="2" scope="col">
                                    <div class="date-header-action-time">
                                      <span class="date-header-action">Action</span>
                                      <span class="date-header-time"
                                        >{formatDateHeader(dateKey)}</span
                                      >
                                    </div>
                                  </th>
                                </tr>

                                <!-- Log entry rows -->
                                {#each dateLogs as log, index (log.id)}
                                  {@const currentUserId = log.user?.id || 'system'}
                                  {@const previousUserId =
                                    index > 0 ? dateLogs[index - 1].user?.id || 'system' : null}
                                  {@const shouldShowUser =
                                    index === 0 || currentUserId !== previousUserId}
                                  <tr
                                    class="logs-table__row logs-group-content"
                                    class:logs-table__row--alt={index % 2 === 1}
                                    data-log-id={log.id}
                                    data-testid="activity-log-row"
                                  >
                                    <!-- User cell -->
                                    <td class="logs-table__user-cell">
                                      {#if shouldShowUser}
                                        <div class="user-info">
                                          {#if log.user}
                                            <div
                                              class="user-avatar"
                                              style={log.user.avatar_style ||
                                                'background-color: var(--accent-blue);'}
                                            >
                                              {log.user.initials || log.user.name?.charAt(0) || 'U'}
                                            </div>
                                            <span class="user-name">{log.user.name}</span>
                                          {:else}
                                            <div
                                              class="user-avatar"
                                              style="background-color: #8E8E93;"
                                            >
                                              S
                                            </div>
                                            <span class="user-name">System</span>
                                          {/if}
                                        </div>
                                      {:else}
                                        <!-- Empty cell to maintain table structure -->
                                        <div class="user-info user-info--hidden"></div>
                                      {/if}
                                    </td>

                                    <!-- Action cell -->
                                    <td class="logs-table__action-cell" colspan="2">
                                      <div class="action-time-container">
                                        <!-- Show user info inline on mobile when user column is hidden -->
                                        {#if shouldShowUser}
                                          <div class="mobile-user-info">
                                            {#if log.user}
                                              <div
                                                class="user-avatar"
                                                style={log.user.avatar_style ||
                                                  'background-color: var(--accent-blue);'}
                                              >
                                                {log.user.initials ||
                                                  log.user.name?.charAt(0) ||
                                                  'U'}
                                              </div>
                                              <span class="user-name">{log.user.name}</span>
                                            {:else}
                                              <div
                                                class="user-avatar"
                                                style="background-color: #8E8E93;"
                                              >
                                                S
                                              </div>
                                              <span class="user-name">System</span>
                                            {/if}
                                          </div>
                                        {/if}
                                        <div class="action-time-row">
                                          <div class="action-content">
                                            {#if formatLogMessage(log)}
                                              {formatLogMessage(log)}
                                              {#if hasDuplicates(log)}
                                                <span class="log-count-badge"
                                                  >{getDuplicateCount(log)}×</span
                                                >
                                              {/if}
                                            {:else}
                                              <em class="log-hidden">Update with minor changes</em>
                                            {/if}
                                          </div>
                                          <div class="time-content">
                                            <time
                                              datetime={log.created_at}
                                              title={new Date(log.created_at).toString()}
                                            >
                                              {formatTimestamp(log.created_at)}
                                            </time>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                {/each}
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  {/if}
                </tbody>
              </table>
            </div>
          {/each}
        </div>
      {/snippet}

      {#snippet loadingOverlay()}
        <div class="loading-overlay">
          <span class="loading-spinner">⟳</span>
          Updating...
        </div>
      {/snippet}
    </ReactiveView>
  {:else}
    <!-- Fallback to original behavior for backward compatibility -->
    {#if isLoading}
      <LoadingSkeleton type="generic" count={8} />
    {:else if error}
      <div class="error-state">
        <div class="error-content">
          <h2>Unable to load activity logs</h2>
          <p>Zero.js will automatically retry. Please check your connection.</p>
          <div class="error-details">
            <code>{error.message}</code>
          </div>
        </div>
      </div>
    {:else if logs.length === 0}
      <ActivityLogEmpty {context} />
    {:else}
      <div class="logs-table-container" bind:this={tableContainer}>
        {#each groupedLogs() as group (group.key)}
          <div class="logs-group-container" data-testid="logs-group-container">
            <table class="logs-table">
              <tbody>
                <!-- Group header row -->
                <tr
                  class="logs-group-header {getGroupHeaderClass(group.type)} {isGroupCollapsed(
                    group.key
                  )
                    ? 'logs-group--collapsed'
                    : ''}"
                  onclick={() => toggleGroup(group)}
                  data-testid="logs-group-header"
                  data-group-key={group.key}
                >
                  <td colspan="3">
                    <div class="logs-group-header-content">
                      <span class="logs-group-toggle">
                        <img
                          src="/icons/chevron-right.svg"
                          alt={isGroupCollapsed(group.key) ? 'Expand' : 'Collapse'}
                          class="chevron-icon"
                          class:expanded={!isGroupCollapsed(group.key)}
                          width="8"
                          height="12"
                        />
                      </span>

                      <span class="logs-group-title">
                        <ActivityTypeEmoji type={group.type} size="small" />
                        <span>{getGroupTitleData(group).text}</span>
                      </span>

                      <span class="logs-group-count">{group.logs.length}</span>
                    </div>
                  </td>
                </tr>

                {#if !isGroupCollapsed(group.key)}
                  <tr class="group-content-wrapper">
                    <td colspan="3" class="group-wrapper-cell">
                      <div
                        class="group-content-container"
                        transition:slide|global={{ duration: 250, easing: quintOut }}
                      >
                        <table class="nested-logs-table">
                          <tbody>
                            {#each getLogsByDate(group.logs) as [dateKey, dateLogs]}
                              <!-- Date header row -->
                              <tr class="logs-table__date-header logs-group-content">
                                <th class="logs-table__date-header-cell" scope="col">
                                  <span class="date-header-user">User</span>
                                </th>
                                <th class="logs-table__date-header-cell" colspan="2" scope="col">
                                  <div class="date-header-action-time">
                                    <span class="date-header-action">Action</span>
                                    <span class="date-header-time">{formatDateHeader(dateKey)}</span
                                    >
                                  </div>
                                </th>
                              </tr>

                              <!-- Log entry rows -->
                              {#each dateLogs as log, index (log.id)}
                                {@const currentUserId = log.user?.id || 'system'}
                                {@const previousUserId =
                                  index > 0 ? dateLogs[index - 1].user?.id || 'system' : null}
                                {@const shouldShowUser =
                                  index === 0 || currentUserId !== previousUserId}
                                <tr
                                  class="logs-table__row logs-group-content"
                                  class:logs-table__row--alt={index % 2 === 1}
                                  data-log-id={log.id}
                                  data-testid="activity-log-row"
                                >
                                  <!-- User cell -->
                                  <td class="logs-table__user-cell">
                                    {#if shouldShowUser}
                                      <div class="user-info">
                                        {#if log.user}
                                          <div
                                            class="user-avatar"
                                            style={log.user.avatar_style ||
                                              'background-color: var(--accent-blue);'}
                                          >
                                            {log.user.initials || log.user.name?.charAt(0) || 'U'}
                                          </div>
                                          <span class="user-name">{log.user.name}</span>
                                        {:else}
                                          <div
                                            class="user-avatar"
                                            style="background-color: #8E8E93;"
                                          >
                                            S
                                          </div>
                                          <span class="user-name">System</span>
                                        {/if}
                                      </div>
                                    {:else}
                                      <!-- Empty cell to maintain table structure -->
                                      <div class="user-info user-info--hidden"></div>
                                    {/if}
                                  </td>

                                  <!-- Action cell -->
                                  <td class="logs-table__action-cell" colspan="2">
                                    <div class="action-time-container">
                                      <!-- Show user info inline on mobile when user column is hidden -->
                                      {#if shouldShowUser}
                                        <div class="mobile-user-info">
                                          {#if log.user}
                                            <div
                                              class="user-avatar"
                                              style={log.user.avatar_style ||
                                                'background-color: var(--accent-blue);'}
                                            >
                                              {log.user.initials || log.user.name?.charAt(0) || 'U'}
                                            </div>
                                            <span class="user-name">{log.user.name}</span>
                                          {:else}
                                            <div
                                              class="user-avatar"
                                              style="background-color: #8E8E93;"
                                            >
                                              S
                                            </div>
                                            <span class="user-name">System</span>
                                          {/if}
                                        </div>
                                      {/if}
                                      <div class="action-time-row">
                                        <div class="action-content">
                                          {#if formatLogMessage(log)}
                                            {formatLogMessage(log)}
                                            {#if hasDuplicates(log)}
                                              <span class="log-count-badge"
                                                >{getDuplicateCount(log)}×</span
                                              >
                                            {/if}
                                          {:else}
                                            <em class="log-hidden">Update with minor changes</em>
                                          {/if}
                                        </div>
                                        <div class="time-content">
                                          <time
                                            datetime={log.created_at}
                                            title={new Date(log.created_at).toString()}
                                          >
                                            {formatTimestamp(log.created_at)}
                                          </time>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              {/each}
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .logs-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .logs-table-container {
    flex: 1;
    overflow-y: auto;
  }

  .logs-group-container {
    margin-bottom: 16px;
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    background-color: var(--bg-primary);
    overflow: hidden;
  }

  .logs-group-container:last-child {
    margin-bottom: 0;
  }

  .logs-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 14px;
  }

  /* Group header rows (Client/Job) */
  .logs-table :global(tr.logs-group-header) {
    background-color: var(--bg-secondary);
    user-select: none;
  }

  .logs-table :global(tr.logs-group-header:hover) {
    background-color: var(--bg-tertiary);
  }

  /* Wrapper row and cell for group content - remove all spacing */
  .group-content-wrapper {
    border: none;
    background: transparent;
  }

  .group-wrapper-cell {
    padding: 0 !important;
    margin: 0;
    border: none;
    vertical-align: top;
  }

  /* Group content container for slide animation */
  .group-content-container {
    overflow: hidden;
    transform-origin: top;
    margin: 0;
    padding: 0;
  }

  /* Nested table for group content */
  .nested-logs-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 14px;
    margin: 0;
    padding: 0;
    border: none;
    table-layout: fixed; /* Prevent layout recalculation during animation */
  }

  /* Remove any default spacing from nested table elements */
  .nested-logs-table tbody {
    margin: 0;
    padding: 0;
  }

  /* Ensure first row in nested table has no top spacing */
  .nested-logs-table tr:first-child {
    margin-top: 0;
  }

  .nested-logs-table tr:first-child th {
    margin-top: 0;
  }

  .logs-table :global(tr.logs-group-header.logs-group-header--general) {
    background-color: #1a2f3f; /* Solid blue-tinted background */
  }

  .logs-table :global(tr.logs-group-header.logs-group-header--cross-reference) {
    background-color: #3a2f1f; /* Solid orange-tinted background */
  }

  .logs-table :global(tr.logs-group-header td) {
    padding: 12px 16px;
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-primary);
  }

  .logs-group-header-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logs-group-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: var(--text-tertiary);
  }

  .chevron-icon {
    transition: transform 0.25s ease;
    color: var(--text-tertiary);
  }

  .chevron-icon.expanded {
    transform: rotate(90deg);
  }

  .logs-group-title {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .logs-group-count {
    margin-left: auto;
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 12px;
    min-width: 24px;
    text-align: center;
    display: inline-block;
  }

  /* Date header rows */
  .logs-table :global(tr.logs-table__date-header) {
    background-color: var(--bg-secondary);
  }

  .logs-table :global(th.logs-table__date-header-cell) {
    padding: 8px 16px;
    border-bottom: 1px solid var(--border-primary);
    font-weight: 600;
    font-size: 13px;
    color: var(--text-secondary);
    background-color: var(--bg-secondary); /* Ensure solid background */
    vertical-align: top; /* Prevent baseline shifts during animation */
  }

  .logs-table :global(th.logs-table__date-header-cell:first-child) {
    text-align: right;
    width: 140px; /* Match user cell width */
    white-space: nowrap;
  }

  .date-header-user {
    display: block;
  }

  .date-header-action-time {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .date-header-action {
    color: var(--text-secondary);
  }

  .date-header-time {
    color: var(--text-primary);
    font-weight: 600;
    white-space: nowrap;
    margin-left: 20px;
  }

  /* Log entry rows */
  .logs-table :global(tr.logs-table__row) {
    border-bottom: 1px solid var(--border-primary);
  }

  /* Alternating row colors */
  .logs-table :global(tr.logs-table__row--alt) {
    background-color: rgba(255, 255, 255, 0.02);
  }

  .logs-table :global(td) {
    padding: 8px 16px 6px 16px;
    vertical-align: baseline;
  }

  /* User cell styling */
  .logs-table :global(td.logs-table__user-cell) {
    white-space: nowrap;
    text-align: right;
    width: 140px; /* Fixed width to align with header */
  }

  .user-info {
    display: inline-flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 6px;
    line-height: 1.4;
  }

  .user-info--hidden {
    /* Maintain cell height but hide content */
    height: 20px;
    min-height: 20px;
  }

  .user-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: var(--accent-blue);
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 600;
    flex-shrink: 0;
    align-self: baseline;
    transform: translateY(2px); /* Move avatar down to align with text baseline */
  }

  .user-name {
    color: var(--text-primary);
    font-weight: 500;
    line-height: 1.4;
    font-size: 14px;
  }

  /* Action cell styling */
  .logs-table :global(td.logs-table__action-cell) {
    color: var(--text-primary);
    line-height: 1.4;
  }

  .action-time-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .action-time-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
    width: 100%;
  }

  .action-content {
    flex: 1;
    min-width: 0;
    line-height: 1.4;
    font-size: 14px;
  }

  .log-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 10px;
    margin-left: 8px;
    vertical-align: middle;
  }

  .log-hidden {
    color: var(--text-tertiary);
    font-style: italic;
    font-size: 13px;
  }

  .time-content {
    flex-shrink: 0;
    text-align: right;
    color: var(--text-tertiary);
    white-space: nowrap;
    font-size: 14px;
    line-height: 1.4;
  }

  /* Error State */
  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 40px 20px;
  }

  .error-content {
    text-align: center;
    max-width: 400px;
  }

  .error-content h2 {
    color: var(--text-primary);
    margin-bottom: 12px;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .error-content p {
    color: var(--text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .error-details {
    margin-bottom: 20px;
    padding: 12px;
    background-color: var(--bg-tertiary);
    border-radius: 6px;
    border: 1px solid var(--border-primary);
  }

  .error-details code {
    color: var(--accent-red);
    font-family:
      ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono',
      monospace;
    font-size: 0.875rem;
  }

  .button {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    transition: all 0.15s ease;
  }

  .button--primary {
    background-color: var(--accent-blue);
    color: white;
  }

  .button--primary:hover {
    background-color: var(--accent-blue-hover, #0089e0);
  }

  /* Mobile Responsive Styles */
  @media (max-width: 768px) {
    .logs-table-container {
      padding: 8px;
    }

    .logs-group-container {
      margin-bottom: 12px;
    }

    /* Reduce padding on mobile */
    .logs-table :global(td) {
      padding: 6px 12px;
    }

    .logs-table :global(th.logs-table__date-header-cell) {
      padding: 6px 12px;
      font-size: 12px;
    }

    /* Group headers - more touch-friendly */
    .logs-table :global(tr.logs-group-header td) {
      padding: 10px 12px;
      font-size: 13px;
    }

    .logs-group-title {
      font-size: 13px;
    }

    .logs-group-count {
      font-size: 11px;
      padding: 1px 6px;
      min-width: 20px;
    }

    /* Hide user column on very small screens */
    @media (max-width: 480px) {
      .logs-table :global(td.logs-table__user-cell) {
        display: none;
      }

      .logs-table :global(th.logs-table__date-header-cell:first-child) {
        display: none;
      }

      /* Show user info inline with action */
      .user-info {
        display: inline-flex;
        justify-content: flex-start;
        margin-bottom: 4px;
      }

      .user-avatar {
        width: 16px;
        height: 16px;
        font-size: 8px;
      }

      .user-name {
        font-size: 12px;
      }
    }

    /* Adjust action/time layout on mobile */
    .action-time-container {
      flex-direction: column;
      gap: 0;
    }

    /* Keep action and time on same line */
    .action-time-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }

    .action-content {
      font-size: 13px;
      flex: 1;
    }

    .time-content {
      font-size: 12px;
      color: var(--text-tertiary);
      flex-shrink: 0;
      white-space: nowrap;
    }

    /* Date headers on mobile */
    .date-header-action-time {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .date-header-time {
      margin-left: 0;
      font-size: 12px;
    }

    .date-header-action {
      display: none; /* Hide ACTION header on mobile */
    }

    /* Chevron icon - larger touch target */
    .logs-group-toggle {
      width: 24px;
      height: 24px;
    }
  }

  /* For very narrow screens, show user info differently */
  @media (max-width: 480px) {
    /* Move user info inside action cell */
    .logs-table :global(td.logs-table__action-cell) {
      padding-top: 8px;
    }
  }

  /* Mobile user info - hidden by default */
  .mobile-user-info {
    display: none;
  }

  /* Show mobile user info when screen is narrow */
  @media (max-width: 480px) {
    .mobile-user-info {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .mobile-user-info .user-avatar {
      width: 16px;
      height: 16px;
      font-size: 8px;
      transform: none; /* Remove baseline adjustment on mobile */
    }

    .mobile-user-info .user-name {
      font-size: 12px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    /* Ensure action/time stay on same line even with user info above */
    .action-time-container {
      flex-wrap: nowrap;
    }
  }

  /* ReactiveView integration styles */
  .refresh-indicator {
    position: absolute;
    top: -2rem;
    right: 0;
    padding: 0.5rem 1rem;
    background-color: rgba(59, 130, 246, 0.1);
    border: 1px solid #3b82f6;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    color: #3b82f6;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .refresh-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .stale-data-notice {
    padding: 0.75rem;
    margin-bottom: 1rem;
    background-color: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 0.25rem;
    color: #92400e;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stale-data-notice button {
    background: none;
    border: none;
    color: #3b82f6;
    text-decoration: underline;
    cursor: default;
    padding: 0;
    margin-left: 0.25rem;
    font-size: 0.875rem;
  }

  .stale-data-notice button:hover {
    color: #1d4ed8;
  }

  .loading-overlay {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: rgba(255, 255, 255, 0.95);
    border: 1px solid var(--border-primary);
    border-radius: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 20;
    backdrop-filter: blur(4px);
  }

  .loading-spinner {
    animation: spin 1s linear infinite;
  }
</style>
