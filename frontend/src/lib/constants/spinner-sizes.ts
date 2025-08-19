/**
 * Shared spinner size constants
 *
 * Defines consistent spinner sizes across ProgressSpinner and LoadingIndicator components
 * to eliminate duplication and ensure consistency.
 */

export type SpinnerSize = 'small' | 'normal' | 'large';

/**
 * Standard spinner size mappings
 */
export const SPINNER_SIZES: Record<SpinnerSize, string> = {
  small: '16px',
  normal: '20px',
  large: '24px',
} as const;
