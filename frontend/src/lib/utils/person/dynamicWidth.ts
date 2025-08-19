/**
 * Dynamic Width Calculation Utility
 *
 * Provides utilities for calculating and applying dynamic widths to input fields
 * based on their content. This ensures all inputs have a consistent width while
 * being responsive to the content they contain.
 */

// Reusable measuring element for better performance
let measuringSpan: HTMLSpanElement | null = null;

/**
 * Gets or creates a measuring span element for width calculations
 * @returns HTMLSpanElement for measuring text width
 */
function getMeasuringSpan(): HTMLSpanElement {
  if (!measuringSpan) {
    measuringSpan = document.createElement('span');
    measuringSpan.style.visibility = 'hidden';
    measuringSpan.style.position = 'absolute';
    measuringSpan.style.whiteSpace = 'nowrap';
    measuringSpan.style.pointerEvents = 'none';
    measuringSpan.setAttribute('aria-hidden', 'true');
    document.body.appendChild(measuringSpan);
  }
  return measuringSpan;
}

/**
 * Calculates the width needed for text based on input styling
 * @param input - Input element to measure
 * @param text - Text to measure (defaults to input value or placeholder)
 * @returns Width in pixels needed for the text
 */
export function calculateTextWidth(input: HTMLInputElement, text?: string): number {
  const span = getMeasuringSpan();

  // Apply the input's font styles to the measuring span
  const styles = window.getComputedStyle(input);
  span.style.font = styles.font;
  span.style.padding = styles.padding;
  span.style.letterSpacing = styles.letterSpacing;

  // Measure the specified text or fall back to input content
  const textToMeasure = text || input.value || input.placeholder || '';
  span.textContent = textToMeasure;

  return span.getBoundingClientRect().width;
}

/**
 * Configuration for dynamic width calculation
 */
export interface DynamicWidthConfig {
  /** Selectors for inputs to include in width calculation */
  inputSelectors: string[];
  /** Minimum width for usability (default: 180px) */
  minWidth?: number;
  /** Maximum width as percentage of viewport (default: 0.8) */
  maxViewportPercentage?: number;
  /** Extra padding to add to calculated width (default: 30px) */
  extraPadding?: number;
}

/**
 * Calculate and apply appropriate width for all specified inputs based on the widest content
 * @param config - Configuration for width calculation
 * @param targetInput - Optional specific input that triggered the calculation
 */
export function resizeInputs(config: DynamicWidthConfig, _targetInput?: HTMLInputElement) {
  const { inputSelectors, minWidth = 180, maxViewportPercentage = 0.8, extraPadding = 30 } = config;

  // Get all inputs matching the selectors
  const inputs = document.querySelectorAll(inputSelectors.join(', '));
  let maxWidth = 0;

  // Find the widest required width among all inputs
  inputs.forEach((inp) => {
    if (inp instanceof HTMLInputElement) {
      const textWidth = calculateTextWidth(inp);
      const requiredWidth = textWidth + extraPadding;

      if (requiredWidth > maxWidth) {
        maxWidth = requiredWidth;
      }
    }
  });

  // Apply constraints
  const maxAllowedWidth = window.innerWidth * maxViewportPercentage;
  const finalWidth = Math.max(minWidth, Math.min(maxWidth, maxAllowedWidth));

  // Set all inputs to the same width
  inputs.forEach((inp) => {
    if (inp instanceof HTMLInputElement) {
      inp.style.width = `${finalWidth}px`;
    }
  });
}

/**
 * Initialize input widths after DOM is ready
 * @param config - Configuration for width calculation
 */
export function initializeInputWidths(config: DynamicWidthConfig) {
  // Wait for DOM to be ready
  setTimeout(() => {
    resizeInputs(config);
  }, 0);
}

/**
 * Clean up the measuring span when no longer needed
 */
export function cleanupMeasuringSpan() {
  if (measuringSpan && measuringSpan.parentNode) {
    document.body.removeChild(measuringSpan);
    measuringSpan = null;
  }
}

/**
 * Default configuration for person form inputs
 */
export const PERSON_FORM_WIDTH_CONFIG: DynamicWidthConfig = {
  inputSelectors: ['.name-input', '.title-input', '.contact-input'],
  minWidth: 180,
  maxViewportPercentage: 0.8,
  extraPadding: 30,
};
