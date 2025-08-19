import { createFilterStore, type FilterOption } from '$lib/utils/createFilterStore.svelte';

// Client type filter options
export const clientTypeOptions: FilterOption[] = [
  { id: 'residential', value: 'residential', label: 'Residential' },
  { id: 'business', value: 'business', label: 'Business' },
];

// Create client type filter store
export const clientTypeFilter = createFilterStore({
  filterKey: 'clientTypes',
  options: clientTypeOptions,
  defaultSelected: [], // No filters selected by default (shows all)
});

// Clients search store - for filtering clients on the listing page
export const clientsSearch = $state({
  searchQuery: '' as string,
  searchFields: ['name', 'name_normalized'] as string[],
});

// Filter function for clients (combines search and type filtering)
export function shouldShowClient(client: {
  name?: string;
  name_normalized?: string;
  type?: string;
  client_type?: string;
}): boolean {
  // Apply search filter
  if (clientsSearch.searchQuery.trim()) {
    const query = clientsSearch.searchQuery.toLowerCase().trim();

    // Search in client name
    const nameMatch = client.name && client.name.toLowerCase().includes(query);

    // Search in normalized name
    const normalizedMatch =
      client.name_normalized && client.name_normalized.toLowerCase().includes(query);

    if (!nameMatch && !normalizedMatch) {
      return false;
    }
  }

  // Apply client type filter
  if (clientTypeFilter.hasActiveFilters) {
    // Handle both 'type' and 'client_type' field names
    const clientType = client.type || client.client_type;
    if (!clientTypeFilter.isSelected(clientType)) {
      return false;
    }
  }

  return true;
}

// Actions for managing clients search
export const clientsSearchActions = {
  setSearchQuery: (query: string) => {
    clientsSearch.searchQuery = query;
  },

  clearSearch: () => {
    clientsSearch.searchQuery = '';
  },

  setClientTypes: (types: string[]) => {
    clientTypeFilter.setSelected(types);
  },

  clearAllFilters: () => {
    clientsSearch.searchQuery = '';
    clientTypeFilter.clearFilters();
  },
};
