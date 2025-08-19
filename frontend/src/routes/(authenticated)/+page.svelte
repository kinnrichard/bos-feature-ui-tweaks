<!--
  Homepage with Faultless Search
  
  Hero-style search page for finding clients
  Replaces the redirect to /jobs
-->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  
  let searchInput = $state('');
  let isLoading = $state(false);
  
  // Handle search submission
  function handleSearch(event: Event) {
    event.preventDefault();
    
    // Only proceed if there's search input
    if (searchInput.trim()) {
      // Navigate to clients page with search query
      goto(`/clients?q=${encodeURIComponent(searchInput.trim())}`);
    }
  }
  
  // Focus on search input when page loads
  onMount(() => {
    const input = document.querySelector('input[type="search"]') as HTMLInputElement;
    if (input) {
      input.focus();
    }
  });
</script>

<svelte:head>
  <title>Home - Faultless</title>
</svelte:head>

<AppLayout>
  <div class="homepage">
    <div class="homepage-content">
      <!-- Hero Search Section -->
      <div class="hero-search">
        <form class="search-form" onsubmit={handleSearch}>
          <div class="search-input-container">
            <img src="/icons/magnifyingglass.svg" alt="Search" class="search-icon" />
            <input
              type="search"
              class="search-input"
              placeholder="Search Clients"
              bind:value={searchInput}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              class="search-button"
              disabled={isLoading || !searchInput.trim()}
            >
              Search
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</AppLayout>

<style>
  .homepage {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0 60px 0;
  }
  
  .homepage-content {
    width: 100%;
    max-width: 600px;
    text-align: center;
  }
  
  .search-form {
    width: 100%;
  }
  
  .search-input-container {
    position: relative;
    display: flex;
    align-items: center;
    background-color: var(--bg-secondary, #1C1C1D);
    border: 2px solid var(--border-primary, #38383A);
    border-radius: 999px;
  }
  
  .search-input-container:focus-within {
    border-color: var(--accent-blue, #00A3FF);
    box-shadow: 0 0 0 3px rgba(0, 163, 255, 0.1);
  }
  
  .search-icon {
    width: 20px;
    height: 20px;
    opacity: 0.5;
    margin-left: 20px;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    padding: 16px 20px 16px 12px;
    background: none;
    border: none;
    color: var(--text-primary, #F2F2F7);
    font-size: 18px;
    font-weight: 400;
    outline: none;
  }
  
  .search-input::placeholder {
    color: var(--text-tertiary, #8E8E93);
  }
  
  /* Remove search input webkit styling */
  .search-input::-webkit-search-decoration,
  .search-input::-webkit-search-cancel-button,
  .search-input::-webkit-search-results-button,
  .search-input::-webkit-search-results-decoration {
    display: none;
  }
  
  .search-button {
    margin: 8px;
    padding: 12px 24px;
    background-color: var(--accent-blue, #00A3FF);
    color: white;
    border: none;
    border-radius: 999px;
    font-size: 16px;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .search-button:hover:not(:disabled) {
    background-color: var(--accent-blue-hover, #0089E0);
  }
  
  .search-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  
  /* Responsive adjustments */
  @media (max-width: 640px) {
    .search-icon {
      width: 18px;
      height: 18px;
      margin-left: 16px;
    }
    
    .search-input {
      font-size: 16px;
      padding: 14px 16px 14px 10px;
    }
    
    .search-button {
      font-size: 14px;
      padding: 10px 20px;
    }
    
  }
</style>