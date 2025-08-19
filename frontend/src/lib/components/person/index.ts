/**
 * Person Components - Unified Person Form Architecture
 *
 * This module exports all person-related components that work together to provide
 * a unified form experience for creating, editing, and viewing person data.
 *
 * Main Components:
 * - PersonForm: Main unified form component
 * - PersonHeader: Name, title, and avatar display/editing
 * - ContactMethodsSection: Contact methods management
 * - ContactItem: Individual contact method display/editing
 *
 * Supporting Utilities:
 * - Dynamic width calculation
 * - Contact validation
 * - Contact normalization (re-exported from existing utils)
 */

export { default as PersonForm } from './PersonForm.svelte';
export { default as PersonHeader } from './PersonHeader.svelte';
export { default as ContactMethodsSection } from './ContactMethodsSection.svelte';
export { default as ContactItem } from './ContactItem.svelte';

// Re-export utilities for convenience
export * from '$lib/utils/person/dynamicWidth';
export * from '$lib/utils/person/contactValidation';
export * from '$lib/utils/shared/contactNormalizer';
