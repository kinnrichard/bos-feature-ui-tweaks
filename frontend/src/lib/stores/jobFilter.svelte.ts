/**
 * Job filter store for managing status and priority filtering
 * Part of EP-0016: Job Filtering Implementation
 *
 * This store manages the UI state for job filtering using a single popover
 * with both status and priority options. It integrates with the existing
 * filter infrastructure from EP-0018.
 */

import { replaceState } from '$app/navigation';
import type { FilterOption } from '$lib/utils/createFilterStore.svelte';
import type { JobStatus, JobPriority } from '$lib/types/job';

// Define status filter options matching JobStatus type
export const jobStatusOptions: FilterOption[] = [
  { id: 'open', value: 'open', label: 'Open' },
  { id: 'in_progress', value: 'in_progress', label: 'In Progress' },
  { id: 'waiting_for_customer', value: 'waiting_for_customer', label: 'Waiting for Customer' },
  {
    id: 'waiting_for_scheduled_appointment',
    value: 'waiting_for_scheduled_appointment',
    label: 'Waiting for Appointment',
  },
  { id: 'paused', value: 'paused', label: 'Paused' },
  { id: 'successfully_completed', value: 'successfully_completed', label: 'Completed' },
  { id: 'cancelled', value: 'cancelled', label: 'Cancelled' },
];

// Define priority filter options matching JobPriority type
export const jobPriorityOptions: FilterOption[] = [
  { id: 'critical', value: 'critical', label: 'Critical' },
  { id: 'very_high', value: 'very_high', label: 'Very High' },
  { id: 'high', value: 'high', label: 'High' },
  { id: 'normal', value: 'normal', label: 'Normal' },
  { id: 'low', value: 'low', label: 'Low' },
  { id: 'proactive_followup', value: 'proactive_followup', label: 'Proactive Follow-up' },
];

// Extended filter option interface to support headers and dividers
interface ExtendedFilterOption extends FilterOption {
  header?: boolean;
  divider?: boolean;
}

// Combined filter options for single popover with sections
export const jobFilterOptions: ExtendedFilterOption[] = [
  { id: 'status-header', value: 'status-header', label: 'Filter Jobs by Status', header: true },
  ...jobStatusOptions.map((opt) => ({
    ...opt,
    id: `status:${opt.id}`,
    value: `status:${opt.value}`,
  })),
  { id: 'divider', value: 'divider', label: '', divider: true },
  {
    id: 'priority-header',
    value: 'priority-header',
    label: 'Filter Jobs by Priority',
    header: true,
  },
  ...jobPriorityOptions.map((opt) => ({
    ...opt,
    id: `priority:${opt.id}`,
    value: `priority:${opt.value}`,
  })),
];

// Create reactive state for managing filter selections
// We're not using createFilterStore here because we need more control
// over URL parameter handling to match existing patterns
class JobFilterStore {
  private _selected = $state<string[]>([]);
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private isInitializing = false;

  constructor() {
    // Initialize from URL on creation
    if (typeof window !== 'undefined') {
      this.initializeFromUrl();

      // Listen for browser navigation
      window.addEventListener('popstate', () => {
        this.initializeFromUrl();
      });
    }
  }

  private initializeFromUrl() {
    this.isInitializing = true;
    const url = new URL(window.location.href);

    const statusParam = url.searchParams.get('status');
    const priorityParam = url.searchParams.get('priority');
    // Note: technician filter is now handled by query param 'technician', not stored in this store
    const technicianIdsParam = null; // Deprecated - using query params directly

    const selected: string[] = [];

    // Add status selections
    if (statusParam) {
      const statuses = statusParam.split(',');
      statuses.forEach((status) => {
        if (jobStatusOptions.some((opt) => opt.value === status)) {
          selected.push(`status:${status}`);
        }
      });
    }

    // Add priority selections
    if (priorityParam) {
      const priorities = priorityParam.split(',');
      priorities.forEach((priority) => {
        if (jobPriorityOptions.some((opt) => opt.value === priority)) {
          selected.push(`priority:${priority}`);
        }
      });
    }

    // Add technician selections
    if (technicianIdsParam) {
      const technicianIds = technicianIdsParam.split(',');
      technicianIds.forEach((technicianId) => {
        // Allow special "not_assigned" value and any valid technician ID
        if (technicianId === 'not_assigned' || technicianId.trim()) {
          selected.push(`technician:${technicianId}`);
        }
      });
    }

    this._selected = selected;
    this.isInitializing = false;
  }

  private scheduleUrlUpdate() {
    // Don't update URL during initialization
    if (this.isInitializing) return;

    // Cancel any pending update
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    // Schedule a new update after 300ms
    this.updateTimer = setTimeout(() => {
      this.updateUrl();
    }, 300);
  }

  private updateUrl() {
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);

        // Extract status selections
        const statuses = this._selected
          .filter((id) => id.startsWith('status:'))
          .map((id) => id.replace('status:', ''));

        // Extract priority selections
        const priorities = this._selected
          .filter((id) => id.startsWith('priority:'))
          .map((id) => id.replace('priority:', ''));

        // Update URL parameters for status and priority only
        // Technician filters are handled separately via query params
        if (statuses.length > 0) {
          url.searchParams.set('status', statuses.join(','));
        } else {
          url.searchParams.delete('status');
        }

        if (priorities.length > 0) {
          url.searchParams.set('priority', priorities.join(','));
        } else {
          url.searchParams.delete('priority');
        }

        // Note: technician filters now use 'technician' query param, handled by TechnicianFilterPopover

        // Use SvelteKit's replaceState
        replaceState(url.href, {});
      } catch (error) {
        console.error('Failed to update URL:', error);
      }
    }
  }

  get selected(): string[] {
    return this._selected;
  }

  get hasActiveFilters(): boolean {
    return this._selected.length > 0;
  }

  setSelected(values: string[]) {
    // Filter out headers and dividers
    this._selected = values.filter((v) => !v.includes('-header') && v !== 'divider');
    this.scheduleUrlUpdate();
  }

  clearFilters() {
    this._selected = [];
    this.scheduleUrlUpdate();
  }
}

// Create singleton instance
export const jobFilter = new JobFilterStore();

// Helper functions to extract selected values
export function getSelectedJobStatuses(): JobStatus[] {
  return jobFilter.selected
    .filter((id) => id.startsWith('status:'))
    .map((id) => id.replace('status:', '') as JobStatus);
}

export function getSelectedJobPriorities(): JobPriority[] {
  return jobFilter.selected
    .filter((id) => id.startsWith('priority:'))
    .map((id) => id.replace('priority:', '') as JobPriority);
}

export function getSelectedTechnicianIds(): string[] {
  return jobFilter.selected
    .filter((id) => id.startsWith('technician:'))
    .map((id) => id.replace('technician:', ''));
}
