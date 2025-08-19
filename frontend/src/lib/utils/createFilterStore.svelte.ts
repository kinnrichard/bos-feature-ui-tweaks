import { goto } from '$app/navigation';

export interface FilterOption {
  id: string;
  value: string;
  label: string;
}

export interface FilterStoreConfig<T extends FilterOption> {
  filterKey: string; // Key for URL query parameter (e.g., 'clientTypes', 'statuses')
  options: T[];
  defaultSelected?: string[]; // If not provided, all options are selected by default
  supportDeleted?: boolean; // Whether to support soft delete filtering
  deletedKey?: string; // URL parameter key for deleted toggle (default: 'showDeleted')
}

export interface FilterStore<T extends FilterOption> {
  selected: string[];
  options: T[];
  hasActiveFilters: boolean;
  showDeleted: boolean;
  setSelected: (values: string[]) => void;
  setShowDeleted: (show: boolean) => void;
  clearFilters: () => void;
  isSelected: (value: string) => boolean;
  getFilteredItems: <Item>(items: Item[], getItemValue: (item: Item) => string, getItemDiscardedAt?: (item: Item) => unknown) => Item[];
}

export function createFilterStore<T extends FilterOption>(
  config: FilterStoreConfig<T>
): FilterStore<T> {
  const { filterKey, options, defaultSelected, supportDeleted = false, deletedKey = 'showDeleted' } = config;
  
  // Initialize from URL or defaults
  let selected = $state<string[]>([]);
  let showDeleted = $state(false);
  
  // Initialize selected values from URL query params
  function initializeFromUrl() {
    // Access window.location directly to avoid import issues
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const urlParam = url.searchParams.get(filterKey);
      
      if (urlParam) {
        // Parse comma-separated values from URL
        const values = urlParam.split(',').filter(v => options.some(opt => opt.value === v));
        selected = values.length > 0 ? values : (defaultSelected || options.map(opt => opt.value));
      } else {
        // Use defaults if no URL param
        selected = defaultSelected || options.map(opt => opt.value);
      }
      
      // Initialize showDeleted if supported
      if (supportDeleted) {
        const deletedParam = url.searchParams.get(deletedKey);
        showDeleted = deletedParam === 'true';
      }
    } else {
      // SSR fallback
      selected = defaultSelected || options.map(opt => opt.value);
      showDeleted = false;
    }
  }
  
  // Update URL with current filter state
  function updateUrl() {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      
      // Only add to URL if not all options are selected (i.e., filters are active)
      if (selected.length > 0 && selected.length < options.length) {
        url.searchParams.set(filterKey, selected.join(','));
      } else {
        url.searchParams.delete(filterKey);
      }
      
      // Handle showDeleted parameter if supported
      if (supportDeleted) {
        if (showDeleted) {
          url.searchParams.set(deletedKey, 'true');
        } else {
          url.searchParams.delete(deletedKey);
        }
      }
      
      // Use goto with replaceState to update URL without navigation
      goto(url.toString(), { replaceState: true, noScroll: true });
    }
  }
  
  // Computed values
  const hasActiveFilters = $derived(
    (selected.length > 0 && selected.length < options.length) || showDeleted
  );
  
  // Methods
  function setSelected(values: string[]) {
    selected = values;
    updateUrl();
  }
  
  function setShowDeleted(show: boolean) {
    showDeleted = show;
    updateUrl();
  }
  
  function clearFilters() {
    selected = options.map(opt => opt.value);
    showDeleted = false;
    updateUrl();
  }
  
  function isSelected(value: string): boolean {
    return selected.includes(value);
  }
  
  function getFilteredItems<Item>(
    items: Item[], 
    getItemValue: (item: Item) => string,
    getItemDiscardedAt?: (item: Item) => unknown
  ): Item[] {
    // Handle deleted/discarded filter if supported
    if (supportDeleted && getItemDiscardedAt) {
      if (showDeleted) {
        // When showing deleted, only show items that have discarded_at
        items = items.filter(item => !!getItemDiscardedAt(item));
      } else {
        // When not showing deleted, exclude items that have discarded_at
        items = items.filter(item => !getItemDiscardedAt(item));
      }
    }
    
    // Apply status filter only when NOT showing deleted items
    if (!showDeleted && selected.length > 0 && selected.length < options.length) {
      items = items.filter(item => selected.includes(getItemValue(item)));
    }
    
    return items;
  }
  
  // Initialize on creation
  initializeFromUrl();
  
  // Re-initialize when navigating (browser only)
  if (typeof window !== 'undefined') {
    // Listen for popstate events (browser navigation)
    window.addEventListener('popstate', () => {
      initializeFromUrl();
    });
  }
  
  return {
    get selected() { return selected; },
    get options() { return options; },
    get hasActiveFilters() { return hasActiveFilters; },
    get showDeleted() { return showDeleted; },
    setSelected,
    setShowDeleted,
    clearFilters,
    isSelected,
    getFilteredItems
  };
}