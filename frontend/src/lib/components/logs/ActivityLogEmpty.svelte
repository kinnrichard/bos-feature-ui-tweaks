<script lang="ts">
  interface Props {
    context?: 'system' | 'client';
  }

  let { context = 'system' }: Props = $props();

  const message = $derived(
    context === 'client' 
      ? 'No activity logs found for this client.'
      : 'No activity logs found.'
  );
</script>

<div class="empty-state">
  <div class="empty-icon">
    📋
  </div>
  <p class="empty-message">{message}</p>
  <p class="empty-submessage">
    Activity will appear here as actions are performed.
  </p>
</div>

<style>
  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-message {
    color: var(--text-primary);
    font-size: 1.125rem;
    margin-bottom: 0.5rem;
  }

  .empty-submessage {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
</style>