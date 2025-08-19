// Shared constants for popover components

export const POPOVER_CONSTANTS = {
  // Button dimensions
  BUTTON_SIZE: 36,
  
  // Transition durations (in milliseconds)
  FADE_IN_DURATION: 0,
  FADE_OUT_DURATION: 150,
  
  // Panel positioning
  ARROW_SIZE: 12,
  ARROW_INNER_SIZE: 10,
  DEFAULT_TOP_OFFSET: '12px',
  ALTERNATIVE_TOP_OFFSET: '8px',
  
  // Panel sizing
  DEFAULT_PANEL_WIDTH: '250px',
  TECHNICIAN_PANEL_MIN_WIDTH: '200px',
  TECHNICIAN_PANEL_MAX_WIDTH: '320px',
  SCHEDULE_PANEL_WIDTH: '280px',
  
  // Content padding
  DEFAULT_CONTENT_PADDING: '16px',
  COMPACT_CONTENT_PADDING: '12px',
  LARGE_CONTENT_PADDING: '20px',
  
  // Option list constraints
  DEFAULT_MAX_HEIGHT: 'min(400px, 50vh)',
  MOBILE_MAX_HEIGHT: 'min(300px, 40vh)',
  
  // Checkmark dimensions
  CHECKMARK_SIZE: 14,
  CHECKMARK_SPACING: 14,
  
  // Z-index
  POPOVER_Z_INDEX: 'var(--z-popover)',
  
  // Icons
  CHECKMARK_ICON: '/icons/checkmark.svg',
  ADD_PERSON_ICON: '/icons/add-person.svg',
  CALENDAR_ICON: '/icons/calendar-add.svg',
} as const;

// Error message templates
export const POPOVER_ERRORS = {
  CSRF_TOKEN: 'Session expired - please try again',
  GENERIC: 'Failed to update - please try again',
  LOAD_USERS: 'Failed to load users',
  UPDATE_STATUS: 'Failed to update status - please try again',
  UPDATE_ASSIGNMENT: 'Failed to update assignment - please try again',
} as const;

// Responsive breakpoints
export const POPOVER_BREAKPOINTS = {
  MOBILE: '768px',
} as const;

// Avatar sizes for popover contexts
export const POPOVER_AVATAR_SIZES = {
  XS: 'xs' as const,
  SMALL: 'small' as const,
  NORMAL: 'normal' as const,
} as const;