/**
 * Name normalizer for client names and other business names
 * Matches the Ruby implementation for data consistency
 */

/**
 * Normalize a string value by removing accents, converting to lowercase,
 * and removing non-alphanumeric characters
 */
export function normalizeString(value: string | null | undefined): string | null {
  if (!value) return null;
  
  // Remove accents using normalize and regex
  // NFD = Canonical Decomposition (separates base chars from combining marks)
  let normalized = value.normalize('NFD');
  
  // Remove combining marks (accents)
  // \u0300-\u036f matches Unicode combining diacritical marks
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');
  
  // Convert to lowercase
  normalized = normalized.toLowerCase();
  
  // Remove all non-alphanumeric characters
  normalized = normalized.replace(/[^a-z0-9]/g, '');
  
  // Return null if result is empty
  return normalized || null;
}

/**
 * Normalize a client name - can accept either a string or an object with a name field
 * If object is provided, returns object with normalized_name field added
 */
export function normalizeClientName(input: string): string | null;
export function normalizeClientName<T extends { name?: string }>(input: T): T & { normalized_name?: string | null };
export function normalizeClientName(input: string | { name?: string }): any {
  // Handle null/undefined
  if (input === null || input === undefined) {
    return null;
  }
  
  // Handle string input
  if (typeof input === 'string') {
    return normalizeString(input);
  }
  
  // Handle object input
  if (typeof input !== 'object') {
    return input;
  }
  
  // If no name field, return unchanged
  if (!('name' in input)) {
    return input;
  }
  
  // Normalize the name and add normalized_name field
  const normalized = normalizeString(input.name);
  
  return {
    ...input,
    normalized_name: normalized
  };
}

/**
 * Mutator function for use with ReactiveRecord/ActiveRecord
 * Automatically adds normalized_name when creating/updating records
 */
export function normalizeNameMutator<T extends { name?: string; normalized_name?: string }>(
  data: Partial<T>
): Partial<T> {
  if (!data.name) {
    return data;
  }
  
  return {
    ...data,
    normalized_name: normalizeString(data.name) as any
  };
}