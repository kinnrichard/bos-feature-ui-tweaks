<script lang="ts">
  interface Props {
    spacing?: 'small' | 'medium' | 'large';
    className?: string;
  }

  let { spacing = 'medium', className = '' }: Props = $props();
</script>

<div 
  class="popover-separator {spacing} {className}"
  role="separator"
  aria-orientation="horizontal"
></div>

<style>
  .popover-separator {
    height: 0;
    width: calc(100% + 32px); /* Extend 16px on each side to reach edges */
    margin-left: -16px; /* Negative margin to pull to edge */
    border: none;
    border-top: 1px solid var(--border-primary); /* Match popover border */
    background: none;
  }

  /* Spacing variants */
  .popover-separator.small {
    margin-top: 8px;
    margin-bottom: 8px;
  }

  .popover-separator.medium {
    margin-top: 12px;
    margin-bottom: 12px;
  }

  .popover-separator.large {
    margin-top: 16px;
    margin-bottom: 16px;
  }

  /* For popovers with different padding, we can use CSS custom properties */
  .popover-separator {
    --popover-padding: 16px; /* Default padding */
    width: calc(100% + (var(--popover-padding) * 2));
    margin-left: calc(var(--popover-padding) * -1);
  }
</style>