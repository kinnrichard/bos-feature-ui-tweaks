import { jobsSearch, jobsSearchActions } from '$lib/stores/jobsSearch.svelte';
import { clientsSearch, clientsSearchActions } from '$lib/stores/clientsSearch.svelte';
import { taskFilter, taskFilterActions } from '$lib/stores/taskFilter.svelte';
import { peopleSearch, peopleSearchActions } from '$lib/stores/peopleSearch.svelte';
import type { SearchContext, SearchConfig } from '$lib/types/toolbar';
import { SEARCH_PLACEHOLDERS } from '$lib/types/toolbar';

/**
 * Centralized search state management
 * Maps search contexts to their respective stores and actions
 */
export function getSearchConfig(context: SearchContext): SearchConfig | null {
  if (!context) return null;

  switch (context) {
    case 'jobs':
    case 'client-jobs':
      return {
        context,
        placeholder: SEARCH_PLACEHOLDERS[context],
        searchQuery: jobsSearch.searchQuery,
        setQuery: jobsSearchActions.setSearchQuery,
        clearQuery: jobsSearchActions.clearSearch,
      };

    case 'clients':
      return {
        context,
        placeholder: SEARCH_PLACEHOLDERS[context],
        searchQuery: clientsSearch.searchQuery,
        setQuery: clientsSearchActions.setSearchQuery,
        clearQuery: clientsSearchActions.clearSearch,
      };

    case 'tasks':
      return {
        context,
        placeholder: SEARCH_PLACEHOLDERS[context],
        searchQuery: taskFilter.searchQuery,
        setQuery: taskFilterActions.setSearchQuery,
        clearQuery: taskFilterActions.clearSearch,
      };

    case 'people':
      return {
        context,
        placeholder: SEARCH_PLACEHOLDERS[context],
        searchQuery: peopleSearch.searchQuery,
        setQuery: peopleSearchActions.setSearchQuery,
        clearQuery: peopleSearchActions.clearSearch,
      };

    default:
      return null;
  }
}

/**
 * Clear all search queries across all contexts
 */
export function clearAllSearches(): void {
  jobsSearchActions.clearSearch();
  clientsSearchActions.clearSearch();
  taskFilterActions.clearSearch();
  peopleSearchActions.clearSearch();
}
