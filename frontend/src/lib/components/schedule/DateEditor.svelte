<script lang="ts">
  import { Calendar } from '$lib/components/ui/calendar';
  import { Trash2 } from 'lucide-svelte';
  import { CalendarDate, type DateValue, today, getLocalTimeZone } from '@internationalized/date';

  interface Props {
    title: string;
    value?: Date | string | number | null;
    onSave: (date: Date | null) => void;
    onCancel: () => void;
    onRemove?: () => void;
    canRemove?: boolean;
    onHeightChange?: () => void;
  }

  let {
    title,
    value = null,
    onSave,
    onCancel,
    onRemove,
    canRemove = false,
    onHeightChange,
  }: Props = $props();

  // Convert value to Date object and CalendarDate
  let selectedDate = $state<Date | null>(null);
  let calendarValue = $state<DateValue | null>(null);

  // Set a placeholder to today's date so calendar shows current month
  let calendarPlaceholder = $state<DateValue>(today(getLocalTimeZone()));
  let calendarSection = $state<HTMLDivElement>();

  // Use ResizeObserver to detect when calendar changes size
  $effect(() => {
    if (calendarSection && onHeightChange) {
      const resizeObserver = new ResizeObserver(() => {
        onHeightChange();
      });

      resizeObserver.observe(calendarSection);

      return () => {
        resizeObserver.disconnect();
      };
    }
  });

  // Convert Date to CalendarDate
  function dateToCalendarDate(date: Date): CalendarDate {
    return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  // Convert CalendarDate to Date
  function calendarDateToDate(calDate: DateValue): Date {
    return new Date(calDate.year, calDate.month - 1, calDate.day);
  }

  // Initialize from prop value - only once on mount
  let hasInitialized = false;
  $effect(() => {
    if (!hasInitialized) {
      hasInitialized = true;
      if (value) {
        let dateObj: Date;

        if (typeof value === 'string') {
          dateObj = new Date(value);
        } else if (typeof value === 'number') {
          dateObj = new Date(value);
        } else {
          dateObj = value;
        }

        if (!isNaN(dateObj.getTime())) {
          selectedDate = dateObj;
          calendarValue = dateToCalendarDate(dateObj);
        }
      }
    }
  });

  // Watch for calendar value changes - simple and direct
  $effect(() => {
    // Only update if calendar value actually exists
    if (calendarValue) {
      const date = calendarDateToDate(calendarValue);
      selectedDate = date;
    }
  });

  // Save the date
  function handleSave() {
    onSave(selectedDate);
  }

  // Handle remove
  function handleRemove() {
    onRemove?.();
  }
</script>

<div class="date-editor">
  <!-- Toolbar -->
  <div class="date-toolbar">
    <div class="toolbar-left">
      <button
        class="toolbar-button toolbar-cancel"
        onclick={onCancel}
        type="button"
        aria-label="Cancel"
      >
        Cancel
      </button>
    </div>

    <h3 class="toolbar-title">{title}</h3>

    <div class="toolbar-right">
      <button
        class="toolbar-button toolbar-save"
        onclick={handleSave}
        type="button"
        aria-label="Save"
      >
        Save
      </button>
    </div>
  </div>

  <!-- Content -->
  <div class="date-content">
    <!-- Calendar -->
    <div class="calendar-section" bind:this={calendarSection}>
      <Calendar
        bind:value={calendarValue}
        bind:placeholder={calendarPlaceholder}
        class="custom-calendar [--cell-size:26px]"
      />
    </div>

    <!-- Remove button if date is set -->
    {#if canRemove}
      <div class="remove-section">
        <button
          class="remove-button"
          onclick={handleRemove}
          type="button"
          aria-label="Remove {title.toLowerCase()}"
        >
          <Trash2 size={18} />
          <span>Remove {title}</span>
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .date-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .date-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-primary);
    border-left: 1px solid var(--border-primary);
    border-right: 1px solid var(--border-primary);
  }

  .toolbar-left,
  .toolbar-right {
    min-width: 50px;
    display: flex;
    align-items: center;
  }

  .toolbar-left {
    justify-content: flex-start;
  }

  .toolbar-right {
    justify-content: flex-end;
  }

  .toolbar-button {
    padding: 0;
    border: none;
    background: transparent;
    font-size: 15px;
    font-weight: 400;
    cursor: default;
    transition: opacity 0.15s ease;
  }

  .toolbar-cancel {
    color: var(--accent-red);
  }

  .toolbar-cancel:hover {
    opacity: 0.7;
  }

  .toolbar-save {
    color: var(--accent-blue);
  }

  .toolbar-save:hover {
    opacity: 0.7;
  }

  .toolbar-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    opacity: 0.33;
    margin: 0;
    margin-top: 1px;
    flex: 1;
    text-align: center;
    white-space: nowrap;
  }

  .date-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .calendar-section {
    display: flex;
    justify-content: center;
  }

  .remove-section {
    padding-top: 12px;
  }

  .remove-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    color: var(--accent-red);
    font-size: 14px;
    font-weight: 500;
    cursor: default;
    transition: all 0.15s ease;
  }

  .remove-button:hover {
    background: rgba(255, 69, 58, 0.1);
  }

  /* Custom calendar styles */
  :global(.custom-calendar) {
    border: none !important;
    padding: 4px !important;
  }

  /* Reduce spacing between dates */
  :global(.custom-calendar [data-bits-calendar-grid]) {
    gap: 0 !important;
    margin-top: 2px !important;
  }

  :global(.custom-calendar [data-bits-calendar-grid-row]) {
    gap: 0 !important;
    margin-top: 0 !important;
  }

  /* Override the mt-2 class on grid rows */
  :global(.custom-calendar .mt-2) {
    margin-top: 2px !important;
  }

  /* Cell font size */
  :global(.custom-calendar [data-bits-calendar-day]) {
    font-size: 13px !important;
  }

  /* Today's date in red */
  :global(.custom-calendar [data-today]:not([data-selected])) {
    color: var(--accent-red, #ff453a) !important;
    background: transparent !important;
    font-weight: 600 !important;
  }

  /* Selected date with blue circle background */
  :global(.custom-calendar [data-selected]) {
    background: var(--accent-blue, #00a3ff) !important;
    color: #ffffff !important;
    text-shadow: 1.5px 1.5px 3px rgba(0, 0, 0, 0.5) !important;
    border-radius: 50% !important;
  }

  :global(.custom-calendar [data-selected]:hover) {
    background: var(--accent-blue-hover, #0089e0) !important;
  }

  /* Dates outside current month in gray */
  :global(.custom-calendar [data-outside-month]:not([data-selected])) {
    color: var(--text-tertiary, #8e8e93) !important;
    opacity: 0.5 !important;
  }

  /* Hover states */
  :global(
    .custom-calendar [data-bits-calendar-day]:hover:not([data-selected]):not([data-disabled])
  ) {
    background: var(--bg-secondary, #2c2c2e) !important;
  }

  /* Header adjustments for smaller calendar */
  :global(.custom-calendar [data-bits-calendar-header]) {
    height: 24px !important;
    font-size: 14px !important;
    padding: 0 2px !important;
  }

  /* Navigation buttons smaller */
  :global(.custom-calendar [data-bits-calendar-prev-button]),
  :global(.custom-calendar [data-bits-calendar-next-button]) {
    width: 24px !important;
    height: 24px !important;
  }

  /* Weekday headers smaller */
  :global(.custom-calendar [data-bits-calendar-head-cell]) {
    font-size: 11px !important;
    font-weight: 500 !important;
    color: var(--text-secondary, #a1a1a6) !important;
  }

  /* Responsive adjustments */
  @media (max-width: 480px) {
    .date-content {
      padding: 16px;
      gap: 16px;
    }

    .date-toolbar {
      padding: 12px 16px;
    }

    .toolbar-title {
      font-size: 16px;
    }
  }

  /* Accessibility improvements */
  @media (prefers-reduced-motion: reduce) {
    .toolbar-button,
    .remove-button {
      transition: none;
    }
  }
</style>
