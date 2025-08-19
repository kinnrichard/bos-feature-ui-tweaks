<script lang="ts">
  import type { ClientData } from '$lib/models/types/client-data';
  
  interface Props {
    type: string;
    entityData?: ClientData | { client_type?: string; business?: boolean };
    size?: 'small' | 'medium' | 'large';
    class?: string;
  }

  let { 
    type, 
    entityData,
    size = 'medium',
    class: className = ''
  }: Props = $props();

  /**
   * Get emoji for different entity types
   */
  function getEntityEmoji(entityType: string, data?: ClientData | { client_type?: string; business?: boolean }): string {
    switch (entityType) {
      case 'Client':
        // Check if entity has client type information
        if (data) {
          // Support both client_type field and business boolean
          if ('client_type' in data && data.client_type === 'business') {
            return '🏢';
          } else if ('client_type' in data && data.client_type === 'residential') {
            return '🏠';
          } else if ('business' in data && data.business) {
            return '🏢';
          } else if ('business' in data && data.business === false) {
            return '🏠';
          }
        }
        // Default for client when type is unknown
        return '👤';
      case 'Job':
        return '💼';
      case 'Task':
        return '☑️';
      case 'Person':
        return '👤';
      case 'Device':
        return '💻';
      case 'Note':
        return '📝';
      default:
        return '📄';
    }
  }

  const emoji = $derived(getEntityEmoji(type, entityData));
  const sizeClass = $derived(`entity-emoji--${size}`);
</script>

<span 
  class="entity-emoji {sizeClass} {className}"
  title="{type} {emoji}"
>
  {emoji}
</span>

<style>
  .entity-emoji {
    display: inline-block;
    line-height: 1;
  }

  .entity-emoji--small {
    font-size: 14px;
  }

  .entity-emoji--medium {
    font-size: 16px;
  }

  .entity-emoji--large {
    font-size: 18px;
  }
</style>