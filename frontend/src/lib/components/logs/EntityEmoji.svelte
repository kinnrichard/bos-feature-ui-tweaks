<script lang="ts">
  interface Props {
    entityType: string;
    entity?: Record<string, unknown>; // The actual entity (client, job, etc.)
    size?: 'small' | 'medium' | 'large';
  }

  let { entityType, entity, size = 'medium' }: Props = $props();

  const sizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  const emoji = $derived(() => {
    switch (entityType) {
      case 'Client':
        if (entity?.client_type === 'business') {
          return '🏢';
        } else if (entity?.client_type === 'residential') {
          return '🏠';
        }
        return '👤';
      case 'Job':
        return '💼';
      case 'Task':
        return '📋';
      case 'Person':
        return '👤';
      case 'Device':
        return '💻';
      case 'Note':
        return '📝';
      default:
        return '📄';
    }
  });
</script>

<span class="entity-emoji {sizeClasses[size]}" role="img" aria-label="{entityType} icon">
  {emoji()}
</span>

<style>
  .entity-emoji {
    display: inline-block;
    line-height: 1;
  }
</style>
