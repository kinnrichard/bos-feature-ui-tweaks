/**
 * Date formatting utilities for absolute dates
 * Used by JobSchedulePopover and related components
 */

import { format, parseISO, isValid, startOfDay } from 'date-fns';

/**
 * Format a date for display in UI components
 */
export function formatDisplayDate(date: Date | string | number | null | undefined): string {
  if (!date) return '';

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (!isValid(dateObj)) return '';

    return format(dateObj, 'MMM d, yyyy');
  } catch (error) {
    console.warn('Invalid date for formatting:', date, error);
    return '';
  }
}

/**
 * Format a time for display in UI components
 */
export function formatDisplayTime(date: Date | string | number | null | undefined): string {
  if (!date) return '';

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (!isValid(dateObj)) return '';

    return format(dateObj, 'h:mm a');
  } catch (error) {
    console.warn('Invalid date for time formatting:', date, error);
    return '';
  }
}

/**
 * Format both date and time for display
 */
export function formatDisplayDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return '';

  const dateStr = formatDisplayDate(date);
  const timeStr = formatDisplayTime(date);

  if (!dateStr) return '';
  if (!timeStr) return dateStr;

  return `${dateStr} at ${timeStr}`;
}

/**
 * Format date for HTML input[type="date"] value
 */
export function formatDateForInput(date: Date | string | number | null | undefined): string {
  if (!date) return '';

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (!isValid(dateObj)) return '';

    return format(dateObj, 'yyyy-MM-dd');
  } catch (error) {
    console.warn('Invalid date for input formatting:', date, error);
    return '';
  }
}

/**
 * Format time for HTML input[type="time"] value
 */
export function formatTimeForInput(date: Date | string | number | null | undefined): string {
  if (!date) return '';

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (!isValid(dateObj)) return '';

    return format(dateObj, 'HH:mm');
  } catch (error) {
    console.warn('Invalid date for time input formatting:', date, error);
    return '';
  }
}

/**
 * Parse date from HTML input[type="date"] value
 */
export function parseDateFromInput(dateString: string): Date | null {
  if (!dateString) return null;

  try {
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
  } catch (error) {
    console.warn('Invalid date string for parsing:', dateString, error);
    return null;
  }
}

/**
 * Parse time from HTML input[type="time"] value and combine with date
 */
export function parseTimeFromInput(timeString: string, baseDate?: Date): Date | null {
  if (!timeString) return null;

  try {
    const base = baseDate || new Date();
    const [hours, minutes] = timeString.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) return null;

    const result = new Date(base);
    result.setHours(hours, minutes, 0, 0);

    return isValid(result) ? result : null;
  } catch (error) {
    console.warn('Invalid time string for parsing:', timeString, error);
    return null;
  }
}

/**
 * Combine date and time into a single Date object
 */
export function combineDateAndTime(
  date: Date | string | null | undefined,
  time: Date | string | null | undefined
): Date | null {
  if (!date) return null;

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else {
      dateObj = date;
    }

    if (!isValid(dateObj)) return null;

    // If no time provided, use start of day
    if (!time) {
      return startOfDay(dateObj);
    }

    let timeObj: Date;

    if (typeof time === 'string') {
      timeObj = parseISO(time);
    } else {
      timeObj = time;
    }

    if (!isValid(timeObj)) {
      return startOfDay(dateObj);
    }

    // Combine date from dateObj with time from timeObj
    const combined = new Date(dateObj);
    combined.setHours(
      timeObj.getHours(),
      timeObj.getMinutes(),
      timeObj.getSeconds(),
      timeObj.getMilliseconds()
    );

    return combined;
  } catch (error) {
    console.warn('Error combining date and time:', date, time, error);
    return null;
  }
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string | number | null | undefined): boolean {
  if (!date) return false;

  try {
    let dateObj: Date;

    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (!isValid(dateObj)) return false;

    const today = new Date();
    return dateObj.toDateString() === today.toDateString();
  } catch {
    return false;
  }
}

/**
 * Validate that start date is not after due date
 */
export function validateDateRange(
  startDate: Date | string | null | undefined,
  dueDate: Date | string | null | undefined
): { isValid: boolean; error?: string } {
  if (!startDate && !dueDate) {
    return { isValid: true };
  }

  if (!startDate || !dueDate) {
    return { isValid: true };
  }

  try {
    let startObj: Date, dueObj: Date;

    if (typeof startDate === 'string') {
      startObj = parseISO(startDate);
    } else {
      startObj = startDate;
    }

    if (typeof dueDate === 'string') {
      dueObj = parseISO(dueDate);
    } else {
      dueObj = dueDate;
    }

    if (!isValid(startObj) || !isValid(dueObj)) {
      return { isValid: false, error: 'Invalid date format' };
    }

    if (startObj > dueObj) {
      return { isValid: false, error: 'Start date cannot be after due date' };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Error validating date range' };
  }
}
