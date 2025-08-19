/**
 * People Search Store
 * Manages search state for people listing
 */

class PeopleSearchStore {
  searchQuery = $state<string>('');
  showActiveOnly = $state<boolean>(false);
  selectedGroupId = $state<string | null>(null);
  selectedDepartmentId = $state<string | null>(null);

  get activeFiltersCount(): number {
    let count = 0;
    if (this.showActiveOnly) count++;
    if (this.selectedGroupId) count++;
    if (this.selectedDepartmentId) count++;
    return count;
  }
}

// Singleton instance
const peopleSearch = new PeopleSearchStore();

// Actions
const peopleSearchActions = {
  setSearchQuery(query: string) {
    peopleSearch.searchQuery = query;
  },

  clearSearch() {
    peopleSearch.searchQuery = '';
  },

  setShowActiveOnly(value: boolean) {
    peopleSearch.showActiveOnly = value;
  },

  setSelectedGroupId(id: string | null) {
    peopleSearch.selectedGroupId = id;
  },

  setSelectedDepartmentId(id: string | null) {
    peopleSearch.selectedDepartmentId = id;
  },

  resetFilters() {
    peopleSearch.showActiveOnly = false;
    peopleSearch.selectedGroupId = null;
    peopleSearch.selectedDepartmentId = null;
  },

  clearAll() {
    peopleSearch.searchQuery = '';
    peopleSearch.showActiveOnly = false;
    peopleSearch.selectedGroupId = null;
    peopleSearch.selectedDepartmentId = null;
  },
};

// Helper function to check if a person should be shown
export function shouldShowPerson(person: {
  name?: string;
  name_preferred?: string;
  title?: string;
  is_active?: boolean;
}): boolean {
  // Apply search filter
  if (peopleSearch.searchQuery && peopleSearch.searchQuery.trim()) {
    const query = peopleSearch.searchQuery.toLowerCase().trim();

    // Search in name
    const nameMatch = person.name && person.name.toLowerCase().includes(query);

    // Search in preferred name
    const preferredNameMatch =
      person.name_preferred && person.name_preferred.toLowerCase().includes(query);

    // Search in title
    const titleMatch = person.title && person.title.toLowerCase().includes(query);

    if (!nameMatch && !preferredNameMatch && !titleMatch) {
      return false;
    }
  }

  // Apply active filter
  if (peopleSearch.showActiveOnly && !person.is_active) {
    return false;
  }

  // Apply group/department filter
  // TODO: Group filtering is temporarily disabled as the relationship is not available in Zero.js
  // This would need to be implemented differently, perhaps by loading group memberships separately

  return true;
}

export { peopleSearch, peopleSearchActions };
