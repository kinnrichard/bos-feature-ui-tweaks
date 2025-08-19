<script lang="ts">
  import FormInput from '$lib/components/ui/FormInput.svelte';
  import { formatTimeForInput, parseTimeFromInput } from '$lib/utils/date-formatting';
  import { Trash2 } from 'lucide-svelte';

  interface Props {
    title: string;
    baseDate: Date; // The date that this time is for
    value?: Date | null; // Date with time set
    onSave: (timeDate: Date | null) => void;
    onCancel: () => void;
    onRemove?: () => void;
    canRemove?: boolean;
  }

  let {
    title,
    baseDate,
    value = null,
    onSave,
    onCancel,
    onRemove,
    canRemove = false,
  }: Props = $props();

  // Time input value
  let timeInputValue = $state('');
  let selectedTime = $state<Date | null>(null);

  // Initialize from prop value
  $effect(() => {
    if (value && !isNaN(value.getTime())) {
      timeInputValue = formatTimeForInput(value);
      selectedTime = value;
    } else {
      // Default to 9:00 AM
      const defaultTime = new Date(baseDate);
      defaultTime.setHours(9, 0, 0, 0);
      timeInputValue = formatTimeForInput(defaultTime);
      selectedTime = defaultTime;
    }
  });

  // Handle time input change
  function handleTimeInputChange() {
    selectedTime = parseTimeFromInput(timeInputValue, baseDate);
  }

  // Save the time
  function handleSave() {
    if (selectedTime) {
      // Combine the base date with the selected time
      const finalDate = new Date(baseDate);
      finalDate.setHours(
        selectedTime.getHours(),
        selectedTime.getMinutes(),
        selectedTime.getSeconds(),
        0
      );
      onSave(finalDate);
    } else {
      onSave(null);
    }
  }

  // Handle remove
  function handleRemove() {
    // Set the date back to just the date without time
    const dateOnly = new Date(baseDate);
    dateOnly.setHours(0, 0, 0, 0);
    onSave(dateOnly);
    onRemove?.();
  }
</script>

<div class="time-editor">
  <!-- Toolbar -->
  <div class="time-toolbar">
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
  <div class="time-content">
    <!-- Time Input -->
    <div class="time-input-section">
      <label for="time-input" class="input-label">Select Time</label>
      <FormInput
        id="time-input"
        type="time"
        bind:value={timeInputValue}
        onchange={handleTimeInputChange}
        size="large"
        placeholder="Select time"
      />
    </div>

    <!-- Remove button if time is set -->
    {#if canRemove}
      <div class="remove-section">
        <button class="remove-button" onclick={handleRemove} type="button" aria-label="Remove time">
          <Trash2 size={18} />
          <span>Remove Time</span>
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .time-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .time-toolbar {
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

  .time-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
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

  .remove-section {
    padding-top: 12px;
    margin-top: auto;
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

  /* Responsive adjustments */
  @media (max-width: 480px) {
    .time-content {
      padding: 16px;
      gap: 16px;
    }

    .time-toolbar {
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
