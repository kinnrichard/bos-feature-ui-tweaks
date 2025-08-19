<script lang="ts">
  import { page } from '$app/stores';
  import { layout, getClientTypeEmoji, layoutActions } from '$lib/stores/layout.svelte';
  import {
    globalNavItems,
    clientNavItems,
    footerNavItems,
    getActiveNavItem,
  } from '$lib/config/navigation';

  // Reactive active item tracking
  const activeItem = $derived(getActiveNavItem($page.url.pathname));

  // Helper to build client-specific URLs
  function buildClientUrl(pattern: string, clientId: string): string {
    return pattern.replace('{id}', clientId);
  }

  // Dynamic footer items based on current client
  const dynamicFooterItems = $derived(
    footerNavItems.map((item) => ({
      ...item,
      href:
        item.id === 'logs' && layout.currentClient
          ? `/clients/${layout.currentClient.id}/logs`
          : item.href,
      label: item.id === 'logs' ? 'Logs' : item.label,
    }))
  );
</script>

<div class="sidebar" role="navigation" aria-label="Main navigation">
  <!-- Brand/Logo -->
  <div class="brand-section">
    <!-- Logo - clickable to go home -->
    <a href="/" class="logo-link" aria-label="Go to homepage">
      <div class="logo-container">
        <img src="/faultless_logo.png" alt="Faultless" class="logo" />
      </div>
    </a>
  </div>

  <!-- Close button (CSS-controlled visibility) -->
  <button class="close-btn" onclick={layoutActions.hideSidebar} aria-label="Close sidebar">
    <!-- Close icon -->
    <img src="/icons/close.svg" alt="Close" />
  </button>

  <!-- Main Navigation -->
  <nav class="main-nav">
    <ul class="nav-list">
      {#if !layout.currentClient}
        <!-- Global Navigation (no client selected) -->
        {#each globalNavItems as item (item.id)}
          <li class="nav-item">
            <a
              href={item.href}
              class="nav-link"
              class:active={activeItem === item.id}
              data-nav-item={item.id}
            >
              <span class="nav-icon">{item.icon}</span>
              <span class="nav-label">{item.label}</span>
            </a>
          </li>
        {/each}
      {:else}
        <!-- Client-specific Navigation -->
        <!-- Current Client -->
        <li class="nav-item">
          <a
            href="/clients/{layout.currentClient.id}"
            class="nav-link"
            class:active={$page.url.pathname === `/clients/${layout.currentClient.id}`}
          >
            <span class="nav-icon">
              {getClientTypeEmoji(layout.currentClient.client_type)}
            </span>
            <span class="nav-label">{layout.currentClient.name}</span>
          </a>
        </li>

        <!-- Spacer -->
        <li class="nav-spacer" aria-hidden="true"></li>

        <!-- Client Navigation Items -->
        {#each clientNavItems as item (item.id)}
          <li class="nav-item">
            <a
              href={buildClientUrl(item.href, layout.currentClient.id)}
              class="nav-link"
              class:active={activeItem === item.id}
              data-nav-item={item.id}
            >
              <span class="nav-icon">{item.icon}</span>
              <span class="nav-label">{item.label}</span>
            </a>
          </li>
        {/each}
      {/if}
    </ul>
  </nav>

  <!-- Footer Navigation -->
  <div class="footer-nav">
    <ul class="nav-list">
      {#each dynamicFooterItems as item (item.id)}
        <li class="nav-item">
          <a href={item.href} class="nav-link footer-link" class:active={activeItem === item.id}>
            <span class="nav-icon">{item.icon}</span>
            <span class="nav-label">{item.label}</span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .sidebar {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-secondary);
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
    border-radius: 16px;
  }

  /* Close button */
  .close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 22px;
    height: 22px;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }

  .close-btn img {
    opacity: 0.5;
    transition: opacity 0.25s ease;
  }

  /* Show close button on hover - functional requirement */
  .brand-section:hover + .close-btn,
  .close-btn:hover {
    opacity: 1;
    pointer-events: auto;
  }

  .close-btn:hover img {
    opacity: 1;
  }

  /* Brand section */
  .brand-section {
    padding: 12px;
    margin-bottom: 30px;
  }

  .logo-link {
    display: block;
    text-decoration: none;
    transition: opacity 0.15s ease;
  }

  /* Logo link - no hover state */

  /* Sidebar logo styling */
  .brand-section .logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-section .logo {
    height: 40px;
    width: auto;
  }

  /* Main navigation */
  .main-nav {
    flex: 1;
    padding: 0 12px 16px;
  }

  .nav-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .nav-item {
    width: 100%;
  }

  .nav-spacer {
    height: 15px; /* matches nav-link height: 6px top + 6px bottom + 13px font + 12px for line-height */
    width: 100%;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 12px;
    text-decoration: none;
    color: var(--text-secondary);
    border-radius: 8px;
    transition: all 0.15s ease;
    font-size: 13px;
    font-weight: 500;
    margin: 0;
    width: 100%;
    background: none;
    border: none;
    text-align: left;
  }

  /* Navigation link - no hover state */

  .nav-link.active {
    background-color: var(--accent-blue);
    color: #ffffff;
    font-weight: bold;
    text-shadow: 1.5px 1.5px 3px rgba(0, 0, 0, 0.5);
  }

  .nav-icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translateY(-1px);
  }

  .nav-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Footer navigation */
  .footer-nav {
    padding: 0 12px 12px;
    margin-top: auto;
  }

  .footer-link {
    color: var(--text-secondary);
    font-size: 13px;
  }

  /* Footer link - no hover state */

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .sidebar {
      width: 280px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .nav-link.active {
      border: 2px solid var(--accent-blue-hover);
    }
  }

  /* Accessibility improvements */
  @media (prefers-reduced-motion: reduce) {
    .nav-link {
      transition: none;
    }
  }
</style>
