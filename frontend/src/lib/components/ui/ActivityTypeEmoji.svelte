<script lang="ts">
  interface Props {
    type: 'client' | 'job' | 'cross-reference' | 'general';
    size?: 'small' | 'medium' | 'large';
    class?: string;
  }

  let { 
    type, 
    size = 'medium',
    class: className = ''
  }: Props = $props();

  /**
   * Get emoji for different activity log group types
   */
  function getActivityTypeEmoji(activityType: 'client' | 'job' | 'cross-reference' | 'general'): string {
    switch (activityType) {
      case 'client':
        return '👤';
      case 'job':
        return '💼';
      case 'cross-reference':
        return '🔗';
      case 'general':
        return '⚙️';
      default:
        return '📋';
    }
  }

  const emoji = $derived(getActivityTypeEmoji(type));
  const sizeClass = $derived(`activity-type-emoji--${size}`);
</script>

<span 
  class="activity-type-emoji {sizeClass} {className}"
  title="Activity type: {type}"
>
  {emoji}
</span>

<style>
  .activity-type-emoji {
    display: inline-block;
    line-height: 1;
  }

  .activity-type-emoji--small {
    font-size: 14px;
  }

  .activity-type-emoji--medium {
    font-size: 16px;
  }

  .activity-type-emoji--large {
    font-size: 18px;
  }
</style>