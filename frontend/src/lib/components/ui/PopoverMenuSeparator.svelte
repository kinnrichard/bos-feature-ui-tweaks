<script lang="ts">
  // PopoverMenuSeparator component for visual separation in PopoverMenu
</script>

<div class="popover-menu-separator" role="separator">
  <div class="separator-line"></div>
</div>

<style>
  .popover-menu-separator {
    /* Half the height of a menu item (menu items are ~28px) */
    height: 14px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    pointer-events: none;
  }

  .separator-line {
    height: 1px;
    background-color: var(--border-primary);
    width: 100%;
    /* Align with where text starts in menu items (after checkmark) */
    margin-left: 20px;
    margin-right: 8px;
  }
</style>