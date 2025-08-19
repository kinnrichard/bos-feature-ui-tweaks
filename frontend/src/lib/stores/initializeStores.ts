/**
 * Store initialization module
 * 
 * This module handles the initialization of stores that have interdependencies
 * to avoid circular dependency issues.
 */

import { taskFilter } from './taskFilter.svelte';
import { setFilterStateGetter } from './taskPermissions.svelte';

/**
 * Initialize store connections
 * 
 * This function should be called once during app initialization
 * to connect stores that need to reference each other.
 */
export function initializeStores() {
  // Connect taskFilter to taskPermissions using a getter function
  // This avoids circular dependency issues
  setFilterStateGetter(() => ({
    showDeleted: taskFilter.showDeleted
  }));
}