<script lang="ts">
  import { Calendar } from '$lib/components/ui/calendar';
  import FormInput from '$lib/components/ui/FormInput.svelte';
  import {
    formatDisplayDate,
    formatTimeForInput,
    combineDateAndTime,
    parseTimeFromInput,
  } from '$lib/utils/date-formatting';
  import { ChevronLeft, Trash2 } from 'lucide-svelte';
  import { CalendarDate, type DateValue, today, getLocalTimeZone } from '@internationalized/date';

  interface Props {
    title: string;
    value?: Date | string | number | null;
    onSave: (date: Date | null) => void;
    onCancel: () => void;
    onRemove?: () => void;
    timeSet?: boolean;
    onTimeSetChange?: (set: boolean) => void;
    canRemove?: boolean;
    placeholder?: string;
  }

  let {
    title,
    value = null,
    onSave,
    onCancel,
    onRemove,
    timeSet = false,
    onTimeSetChange,
    canRemove = false,
  }: Props = $props();

  // Convert value to Date object and CalendarDate
  let selectedDate = $state<Date | null>(null);
  let selectedTime = $state<Date | null>(null);
  let includeTime = $state(timeSet);
  let calendarValue = $state<DateValue | null>(null);

  // Set a placeholder to today's date so calendar shows current month
  let calendarPlaceholder = $state<DateValue>(today(getLocalTimeZone()));

  // Time input value
  let timeInputValue = $state('');

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
          selectedTime = dateObj;
          timeInputValue = formatTimeForInput(dateObj);
          calendarValue = dateToCalendarDate(dateObj);
        }
      }
      includeTime = timeSet;
    }
  });

  // Watch for calendar value changes - simple and direct
  $effect(() => {
    // Only update if calendar value actually exists
    if (calendarValue) {
      const date = calendarDateToDate(calendarValue);
      selectedDate = date;

      // Initialize time if needed
      if (!selectedTime) {
        selectedTime = date;
      }
    }
  });

  // Handle time input change
  function handleTimeInputChange() {
    if (selectedDate) {
      selectedTime = parseTimeFromInput(timeInputValue, selectedDate);
    }
  }

  // Handle time checkbox change
  function handleTimeCheckboxChange() {
    includeTime = !includeTime;
    onTimeSetChange?.(includeTime);

    if (!includeTime) {
      timeInputValue = '';
      selectedTime = null;
    }
  }

  // Save the date/time combination
  function handleSave() {
    let finalDate = selectedDate;

    if (finalDate && includeTime && selectedTime) {
      finalDate = combineDateAndTime(finalDate, selectedTime);
    }

    onSave(finalDate);
  }

  // Handle remove
  function handleRemove() {
    onRemove?.();
  }
</script>

<div class="datetime-editor">
  <!-- Toolbar -->
  <div class="datetime-toolbar">
    <button
      class="toolbar-back-button"
      onclick={onCancel}
      type="button"
      aria-label="Back to schedule menu"
    >
      <ChevronLeft size={20} />
    </button>

    <h3 class="toolbar-title">{title}</h3>

    {#if canRemove}
      <button
        class="toolbar-remove-button"
        onclick={handleRemove}
        type="button"
        aria-label="Remove {title.toLowerCase()}"
      >
        <Trash2 size={18} />
      </button>
    {:else}
      <div class="toolbar-spacer"></div>
    {/if}
  </div>

  <!-- Content -->
  <div class="datetime-content">
    <!-- Calendar -->
    <div class="calendar-section">
      <Calendar
        bind:value={calendarValue}
        bind:placeholder={calendarPlaceholder}
        class="custom-calendar"
      />
    </div>

    <!-- Time Section -->
    <div class="time-section">
      <div class="time-checkbox-row">
        <input
          type="checkbox"
          id="include-time"
          bind:checked={includeTime}
          onchange={handleTimeCheckboxChange}
          class="time-checkbox"
        />
        <label for="include-time" class="time-checkbox-label"> Include specific time </label>
      </div>

      {#if includeTime}
        <div class="time-input-section">
          <label for="time-input" class="input-label">Time</label>
          <FormInput
            id="time-input"
            type="time"
            bind:value={timeInputValue}
            onchange={handleTimeInputChange}
            size="small"
            placeholder="Select time"
          />
        </div>
      {/if}
    </div>

    <!-- Date Preview -->
    {#if selectedDate}
      <div class="date-preview">
        <span class="preview-label">Selected:</span>
        <span class="preview-value">
          {formatDisplayDate(
            includeTime && selectedTime
              ? combineDateAndTime(selectedDate, selectedTime)
              : selectedDate
          )}
        </span>
      </div>
    {/if}

    <!-- Actions -->
    <div class="datetime-actions">
      <button type="button" class="action-button action-cancel" onclick={onCancel}> Cancel </button>
      <button type="button" class="action-button action-save" onclick={handleSave}> Save </button>
    </div>
  </div>
</div>

<style>
  .datetime-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .datetime-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-primary);
    background: var(--bg-primary);
  }

  .toolbar-back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: default;
    transition: all 0.15s ease;
  }

  .toolbar-back-button:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .toolbar-title {
    font-size: 17px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    flex: 1;
    text-align: center;
  }

  .toolbar-remove-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    color: var(--accent-red);
    cursor: default;
    transition: all 0.15s ease;
  }

  .toolbar-remove-button:hover {
    background: rgba(255, 69, 58, 0.1);
  }

  .toolbar-spacer {
    width: 32px;
  }

  .datetime-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .calendar-section {
    display: flex;
    justify-content: center;
  }

  .time-input-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .input-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .time-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .time-checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .time-checkbox {
    width: 18px;
    height: 18px;
    accent-color: var(--accent-blue);
  }

  .time-checkbox-label {
    font-size: 14px;
    color: var(--text-primary);
    cursor: default;
  }

  .date-preview {
    padding: 12px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .preview-label {
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .preview-value {
    font-size: 14px;
    color: var(--text-primary);
    font-weight: 500;
  }

  .datetime-actions {
    display: flex;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-primary);
  }

  .action-button {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 500;
    cursor: default;
    transition: all 0.15s ease;
  }

  .action-cancel {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .action-cancel:hover {
    background: var(--bg-quaternary, #4a4a4c);
  }

  .action-save {
    background: var(--accent-blue);
    color: white;
  }

  .action-save:hover {
    background: var(--accent-blue-hover);
  }

  /* Responsive adjustments */
  @media (max-width: 480px) {
    .datetime-content {
      padding: 16px;
      gap: 16px;
    }

    .datetime-toolbar {
      padding: 12px 16px;
    }

    .toolbar-title {
      font-size: 16px;
    }
  }

  /* Accessibility improvements */
  @media (prefers-reduced-motion: reduce) {
    .toolbar-back-button,
    .toolbar-remove-button,
    .action-button {
      transition: none;
    }
  }

  /* Custom calendar styles */
  :global(.custom-calendar) {
    border: none !important;
    padding: 8px !important;
  }

  /* Reduce spacing between dates */
  :global(.custom-calendar [data-bits-calendar-grid]) {
    gap: 0 !important;
    margin-top: 8px !important;
  }

  :global(.custom-calendar [data-bits-calendar-grid-row]) {
    gap: 2px !important;
    margin-top: 2px !important;
  }

  /* Smaller cell size */
  :global(.custom-calendar [data-bits-calendar-cell]) {
    width: 32px !important;
    height: 32px !important;
  }

  :global(.custom-calendar [data-bits-calendar-day]) {
    width: 32px !important;
    height: 32px !important;
    font-size: 13px !important;
  }

  /* Today's date in red */
  :global(.custom-calendar [data-today]:not([data-selected])) {
    color: var(--accent-red, #ff453a) !important;
    background: transparent !important;
    font-weight: 600 !important;
  }

  /* Selected date with gray background */
  :global(.custom-calendar [data-selected]) {
    background: var(--bg-tertiary, #48484a) !important;
    color: var(--text-primary, #f2f2f7) !important;
  }

  :global(.custom-calendar [data-selected]:hover) {
    background: var(--bg-quaternary, #5a5a5c) !important;
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
    height: 28px !important;
    font-size: 14px !important;
  }

  /* Navigation buttons smaller */
  :global(.custom-calendar [data-bits-calendar-prev-button]),
  :global(.custom-calendar [data-bits-calendar-next-button]) {
    width: 28px !important;
    height: 28px !important;
  }

  /* Weekday headers smaller */
  :global(.custom-calendar [data-bits-calendar-head-cell]) {
    width: 32px !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    color: var(--text-secondary, #a1a1a6) !important;
  }
</style>
