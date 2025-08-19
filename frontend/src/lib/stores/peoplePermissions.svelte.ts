import { getCurrentUser } from '$lib/auth/current-user';
import type { PersonData } from '$lib/types/models';

// Permission types for people management
export type PeoplePermission = 'create' | 'edit' | 'delete' | 'view';

// Centralized permission system for people operations
class PeoplePermissionSystem {
  // Check if the current user can delete people
  private canDeletePeople(): boolean {
    const user = getCurrentUser();
    if (!user) return false;

    // Only owners and admins can delete people
    return user.role === 'owner' || user.role === 'admin';
  }

  // Check if a specific permission is allowed
  hasPermission(permission: PeoplePermission, _person?: PersonData): boolean {
    const user = getCurrentUser();
    if (!user) return false;

    switch (permission) {
      case 'view':
        // All authenticated users can view people
        return true;

      case 'create':
      case 'edit':
        // All authenticated users can create/edit people
        return true;

      case 'delete':
        // Only owners and admins can delete
        return this.canDeletePeople();

      default:
        // Default to denying unknown permissions
        return false;
    }
  }

  // Get all permissions for the current user
  getAllPermissions(_person?: PersonData): Record<PeoplePermission, boolean> {
    const permissions: PeoplePermission[] = ['create', 'edit', 'delete', 'view'];
    const result: Record<PeoplePermission, boolean> = {} as any;

    for (const permission of permissions) {
      result[permission] = this.hasPermission(permission, _person);
    }

    return result;
  }

  // Get a human-readable reason why a permission is denied
  getPermissionDenialReason(permission: PeoplePermission): string | null {
    // Check if permission is allowed first
    if (this.hasPermission(permission)) {
      return null;
    }

    const user = getCurrentUser();
    if (!user) {
      return 'You must be logged in to perform this action';
    }

    // Provide specific denial reasons
    switch (permission) {
      case 'delete':
        return 'Only owners and administrators can delete people';
      default:
        return "You don't have permission to perform this action";
    }
  }
}

// Export singleton instance
export const peoplePermissions = new PeoplePermissionSystem();

// Reactive helpers for Svelte components
export const peoplePermissionHelpers = {
  // Check if user can create people
  get canCreatePeople(): boolean {
    return peoplePermissions.hasPermission('create');
  },

  // Check if user can edit people
  get canEditPeople(): boolean {
    return peoplePermissions.hasPermission('edit');
  },

  // Check if user can delete people
  get canDeletePeople(): boolean {
    return peoplePermissions.hasPermission('delete');
  },

  // Check if a specific person can be edited
  canEditPerson(person: PersonData): boolean {
    return peoplePermissions.hasPermission('edit', person);
  },

  // Check if a specific person can be deleted
  canDeletePerson(person: PersonData): boolean {
    return peoplePermissions.hasPermission('delete', person);
  },

  // Get permissions for a specific person
  getPersonPermissions(person: PersonData): Record<PeoplePermission, boolean> {
    return peoplePermissions.getAllPermissions(person);
  },
};
