<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import BasePopover from '$lib/components/ui/BasePopover.svelte';
  import { Calendar } from '$lib/components/ui/calendar';
  import { CalendarDate, type DateValue, today, getLocalTimeZone } from '@internationalized/date';
  import '$lib/styles/popover-common.css';

  interface Props {
    selected: string[];
    onFilterChange: (selected: string[]) => void;
    disabled?: boolean;
    fieldName?: string; // e.g., 'due_date', 'created_at', 'scheduled_date'
  }

  let { selected = [], onFilterChange, disabled = false, fieldName = 'due_date' }: Props = $props();

  const currentUrl = $derived($page.url);

  // Calendar state
  let calendarValue = $state<DateValue | undefined>(undefined);
  let calendarPlaceholder = $state<DateValue>(today(getLocalTimeZone()));

  // Date range calculations
  const todayDate = new Date();
  const tomorrow = new Date(todayDate);
  tomorrow.setDate(todayDate.getDate() + 1);
  
  const startOfWeek = new Date(todayDate);
  startOfWeek.setDate(todayDate.getDate() - todayDate.getDay());
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const endOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);

  // Format date for display and URL params
  function formatDate(date: Date): string {
    if (!date || isNaN(date.getTime())) {
      console.warn('Invalid date passed to formatDate:', date);
      return '';
    }
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  function formatDateDisplay(date: Date): string {
    if (!date || isNaN(date.getTime())) {
      console.warn('Invalid date passed to formatDateDisplay:', date);
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== todayDate.getFullYear() ? 'numeric' : undefined
    });
  }

  // Convert Date to CalendarDate
  function dateToCalendarDate(date: Date): CalendarDate {
    return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  // Convert CalendarDate to Date
  function calendarDateToDate(calDate: DateValue): Date {
    return new Date(calDate.year, calDate.month - 1, calDate.day);
  }

  // Determine effective selection based on query param or props
  const effectiveSelection = $derived(() => {
    const dateParam = currentUrl.searchParams.get(fieldName);

    if (!dateParam) return selected;

    switch (dateParam) {
      case 'today':
        return [`${fieldName}:today`];
      case 'tomorrow':
        return [`${fieldName}:tomorrow`];
      case 'this_week':
        return [`${fieldName}:this_week`];
      case 'this_month':
        return [`${fieldName}:this_month`];
      case 'overdue':
        return [`${fieldName}:overdue`];
      case 'no_date':
        return [`${fieldName}:no_date`];
      default:
        // Handle custom dates
        if (dateParam.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return [`${fieldName}:${dateParam}`];
        }
        return selected;
    }
  });

  // Parse selected date filters
  const selectedDateFilters = $derived(
    effectiveSelection()
      .filter((id) => id.startsWith(`${fieldName}:`))
      .map((id) => id.replace(`${fieldName}:`, ''))
  );

  // Simple display text without complex derived logic
  let displayText = $state('Date');

  // Update display text when selection changes
  $effect(() => {
    if (selectedDateFilters.length === 0) {
      displayText = 'Date';
      return;
    }
    
    const filter = selectedDateFilters[0];
    
    if (filter === 'today') displayText = 'Today';
    else if (filter === 'tomorrow') displayText = 'Tomorrow';
    else if (filter === 'this_week') displayText = 'This Week';
    else if (filter === 'this_month') displayText = 'This Month';
    else if (filter === 'overdue') displayText = 'Overdue';
    else if (filter === 'no_date') displayText = 'No Date';
    else displayText = 'Custom Date';
  });

  // Handle calendar date selection - with better error handling
  $effect(() => {
    if (calendarValue) {
      try {
        const date = calendarDateToDate(calendarValue);
        // Validate the date before using it
        if (date && !isNaN(date.getTime())) {
          const dateString = formatDate(date);
          if (dateString) {
            handleSelect(`${fieldName}:${dateString}`);
          }
        }
      } catch (error) {
        console.warn('Error handling calendar date selection:', error);
      }
    }
  });

  // Quick filter options
  const quickFilters = [
    {
      id: `${fieldName}:no_date`,
      label: 'No Date',
      emoji: '⊘'
    },
    ...(fieldName === 'due_date' ? [{
      id: `${fieldName}:overdue`,
      label: 'Overdue',
      emoji: '⚠️'
    }] : []),
    {
      id: `${fieldName}:today`,
      label: 'Today',
      emoji: '📅'
    },
    {
      id: `${fieldName}:tomorrow`,
      label: 'Tomorrow',
      emoji: '📅'
    },
    {
      id: `${fieldName}:this_week`,
      label: 'This Week',
      emoji: '📅'
    },
    {
      id: `${fieldName}:this_month`,
      label: 'This Month',
      emoji: '📅'
    },
  ];

  async function handleSelect(value: string | undefined) {
    if (!value) return;

    const isCurrentlySelected = effectiveSelection().includes(value);
    const newSelection = isCurrentlySelected ? [] : [value];

    // Build new URL with appropriate query params
    const url = new URL(currentUrl);
    const paramValue = value.replace(`${fieldName}:`, '');

    if (newSelection.length === 0) {
      url.searchParams.delete(fieldName);
    } else {
      url.searchParams.set(fieldName, paramValue);
    }

    // Navigate to the new URL
    await goto(url.toString());
    onFilterChange(newSelection);
  }

  async function clearFilter() {
    const url = new URL(currentUrl);
    url.searchParams.delete(fieldName);
    await goto(url.toString());
    onFilterChange([]);
    calendarValue = undefined;
  }

  const hasActiveFilters = $derived(effectiveSelection().length > 0);
</script>

<BasePopover preferredPlacement="bottom" panelWidth="280px">
  {#snippet trigger({ popover })}
    <button
      use:popover.button
      class="date-filter-button"
      class:active={hasActiveFilters}
      class:disabled
      {disabled}
      title="Date Filter"
    >
      📅 {displayText}
    </button>
  {/snippet}

  {#snippet children({ close })}
    <div class="date-filter-content">
      <!-- Quick Filters -->
      <div class="quick-filters">
        {#each quickFilters as filter}
          <button
            class="quick-filter-button"
            class:active={effectiveSelection().includes(filter.id)}
            onclick={() => handleSelect(filter.id)}
          >
            <span class="filter-emoji">{filter.emoji}</span>
            <span>{filter.label}</span>
          </button>
        {/each}
      </div>

      <!-- Divider -->
      <div class="divider"></div>

      <!-- Calendar using your existing component -->
      <div class="calendar-section">
        <Calendar
          bind:value={calendarValue}
          bind:placeholder={calendarPlaceholder}
          class="filter-calendar"
        />
      </div>

      <!-- Clear All Button -->
      {#if hasActiveFilters}
        <div class="clear-section">
          <button
            class="clear-all-button"
            onclick={() => clearFilter()}
            type="button"
          >
            Clear Filter
          </button>
        </div>
      {/if}
    </div>
  {/snippet}
</BasePopover>

<style>
  .date-filter-button {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border: 1px solid var(--border-secondary);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: default;
    transition: all 0.15s ease;
    white-space: nowrap;
    min-width: fit-content;
    max-width: 180px;
  }

  .date-filter-button:hover:not(.disabled) {
    background: var(--bg-hover);
    border-color: var(--border-primary);
  }

  .date-filter-button.active {
    background: var(--accent-blue);
    border-color: var(--accent-blue);
    color: white;
  }

  .date-filter-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .button-content {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
  }

  .button-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    opacity: 0.8;
  }

  .button-text {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .clear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    cursor: default;
    flex-shrink: 0;
  }

  .clear-button:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .clear-text {
    font-size: 14px;
    font-weight: bold;
    color: white;
  }

  .dropdown-arrow {
    font-size: 10px;
    opacity: 0.7;
    transition: transform 0.2s ease;
  }

  .date-filter-button.active .dropdown-arrow {
    transform: rotate(180deg);
  }

  .date-filter-content {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .quick-filters {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .quick-filter-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-primary);
    font-size: 13px;
    cursor: default;
    transition: background 0.15s ease;
  }

  .quick-filter-button:hover {
    background: var(--bg-secondary);
  }

  .quick-filter-button.active {
    background: var(--accent-blue);
    color: white;
  }

  .filter-emoji {
    font-size: 14px;
    width: 16px;
    display: flex;
    justify-content: center;
  }

  .divider {
    height: 1px;
    background: var(--border-secondary);
  }

  .calendar-section {
    display: flex;
    justify-content: center;
  }

  .clear-section {
    padding-top: 4px;
  }

  .clear-all-button {
    width: 100%;
    padding: 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--accent-red);
    font-size: 13px;
    font-weight: 500;
    cursor: default;
    transition: background 0.15s ease;
  }

  .clear-all-button:hover {
    background: rgba(255, 69, 58, 0.1);
  }

  /* Custom calendar styles to match your date editor design */
  :global(.filter-calendar) {
    --cell-size: 26px;
    border: none !important;
    padding: 4px !important;
    background: transparent !important;
  }

  /* Reduce spacing between dates */
  :global(.filter-calendar [data-bits-calendar-grid]) {
    gap: 0 !important;
    margin-top: 2px !important;
  }

  :global(.filter-calendar [data-bits-calendar-grid-row]) {
    gap: 0 !important;
    margin-top: 0 !important;
  }

  /* Override the mt-2 class on grid rows */
  :global(.filter-calendar .mt-2) {
    margin-top: 2px !important;
  }

  /* Cell font size */
  :global(.filter-calendar [data-bits-calendar-day]) {
    font-size: 13px !important;
  }

  /* Today's date in red - matching your design */
  :global(.filter-calendar [data-today]:not([data-selected])) {
    color: var(--accent-red, #ff453a) !important;
    background: transparent !important;
    font-weight: 600 !important;
  }

  /* Selected date with blue circle background - matching your design */
  :global(.filter-calendar [data-selected]) {
    background: var(--accent-blue, #00a3ff) !important;
    color: #ffffff !important;
    text-shadow: 1.5px 1.5px 3px rgba(0, 0, 0, 0.5) !important;
    border-radius: 50% !important;
  }

  :global(.filter-calendar [data-selected]:hover) {
    background: var(--accent-blue-hover, #0089e0) !important;
  }

  /* Dates outside current month in gray */
  :global(.filter-calendar [data-outside-month]:not([data-selected])) {
    color: var(--text-tertiary, #8e8e93) !important;
    opacity: 0.5 !important;
  }

  /* Hover states */
  :global(.filter-calendar [data-bits-calendar-day]:hover:not([data-selected]):not([data-disabled])) {
    background: var(--bg-secondary, #2c2c2e) !important;
  }

  /* Header adjustments for smaller calendar */
  :global(.filter-calendar [data-bits-calendar-header]) {
    height: 24px !important;
    font-size: 14px !important;
    padding: 0 2px !important;
  }

  /* Navigation buttons smaller */
  :global(.filter-calendar [data-bits-calendar-prev-button]),
  :global(.filter-calendar [data-bits-calendar-next-button]) {
    width: 24px !important;
    height: 24px !important;
  }

  /* Weekday headers smaller */
  :global(.filter-calendar [data-bits-calendar-head-cell]) {
    font-size: 11px !important;
    font-weight: 500 !important;
    color: var(--text-secondary, #a1a1a6) !important;
  }
</style>