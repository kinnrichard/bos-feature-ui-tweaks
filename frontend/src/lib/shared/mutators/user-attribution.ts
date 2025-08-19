/**
 * User attribution mutators for tracking user changes
 * Adds user_id and timestamps to records
 */

import type { MutatorFunction, MutatorContext } from './base-mutator';

export interface UserTrackable {
  user_id?: string;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

/**
 * Add user attribution to a record (generic version)
 * Sets user_id, created_by, updated_by based on context
 */
export const addUserAttribution: MutatorFunction<UserTrackable> = (
  data: UserTrackable,
  context?: MutatorContext
): UserTrackable => {
  if (!context?.user?.id) {
    return data;
  }

  const userId = context.user.id;
  const now = new Date().toISOString();

  const result = { ...data };

  // Set user_id if not already set
  if (!result.user_id) {
    result.user_id = userId;
  }

  // Handle creation vs update
  if (context.action === 'create' || !result.created_by) {
    result.created_by = userId;
    if (!result.created_at) {
      result.created_at = now;
    }
  }

  // Always update the updated_by field
  result.updated_by = userId;
  result.updated_at = now;

  return result;
};

/**
 * Type-safe version of addUserAttribution
 * Provides better TypeScript support for specific model types
 */
export const addUserAttributionTyped = <T extends UserTrackable>(
  data: T,
  context?: MutatorContext
): T => {
  return addUserAttribution(data, context) as T;
};

/**
 * Add user attribution for creation only
 * Only sets created_by and created_at fields
 */
export const addUserAttributionCreate: MutatorFunction<UserTrackable> = (
  data: UserTrackable,
  context?: MutatorContext
): UserTrackable => {
  if (!context?.user?.id) {
    return data;
  }

  const userId = context.user.id;
  const now = new Date().toISOString();

  return {
    ...data,
    created_by: data.created_by || userId,
    created_at: data.created_at || now,
    user_id: data.user_id || userId,
  };
};

/**
 * Add user attribution for updates only
 * Only sets updated_by and updated_at fields
 */
export const addUserAttributionUpdate: MutatorFunction<UserTrackable> = (
  data: UserTrackable,
  context?: MutatorContext
): UserTrackable => {
  if (!context?.user?.id) {
    return data;
  }

  const userId = context.user.id;
  const now = new Date().toISOString();

  return {
    ...data,
    updated_by: userId,
    updated_at: now,
  };
};

/**
 * Type guard to check if an object is user trackable
 */
export function isUserTrackable(obj: any): obj is UserTrackable {
  return obj && typeof obj === 'object';
}

export type { UserTrackable };
