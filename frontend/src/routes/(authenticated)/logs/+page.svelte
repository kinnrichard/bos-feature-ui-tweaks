<script lang="ts">
  import { ActivityLogList, LogsLayout } from '$lib/components/logs';
  import { ReactiveActivityLogV2 } from '$lib/models/reactive-activity-log-v2';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';

  // Use ReactiveActivityLogV2 with flash prevention and progressive loading
  const logsQuery = ReactiveActivityLogV2.includes(['user', 'client', 'job'])
    .orderBy('created_at', 'desc')
    .limit(500)
    .all();

  // Zero.js handles all retries and refreshes automatically
  // ReactiveView provides flash prevention and enhanced state management
</script>

<svelte:head>
  <title>System Activity Logs - bŏs</title>
</svelte:head>

<AppLayout>
  <LogsLayout title="System Activity Logs">
    <ActivityLogList {logsQuery} context="system" strategy="progressive" />
  </LogsLayout>
</AppLayout>
