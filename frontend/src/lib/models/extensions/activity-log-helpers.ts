/**
 * Activity Log Helper Functions
 * 
 * Provides helper functions for formatting and displaying activity logs
 * without modifying the prototype.
 */

import type { ActivityLogData } from '../types/activity-log-data';
import type { ClientData } from '../types/client-data';
import { getEntityTypeEmoji } from '$lib/config/emoji';

export function getFormattedMessage(log: ActivityLogData): string {
  const action = log.action || '';
  const loggableType = log.loggable_type || '';
  const metadata = log.metadata || {};
  
  // Custom message if provided
  if (metadata.message) {
    return metadata.message;
  }
  
  // Get the entity name from metadata
  const entityName = metadata.name || `${loggableType} #${log.loggable_id}`;
  
  // Build message based on action type
  switch (action) {
    case 'created':
      return `Created ${loggableType.toLowerCase()} "${entityName}"`;
    case 'updated':
      return `Updated ${loggableType.toLowerCase()} "${entityName}"`;
    case 'deleted':
    case 'discarded':
      return `Deleted ${loggableType.toLowerCase()} "${entityName}"`;
    case 'status_changed':
      if (metadata.new_status_label) {
        return `Changed status to ${metadata.new_status_label} for "${entityName}"`;
      }
      return `Changed status for "${entityName}"`;
    case 'assigned':
      return `Assigned "${entityName}" to someone`;
    case 'unassigned':
      return `Unassigned "${entityName}"`;
    case 'renamed':
      if (metadata.old_name) {
        return `Renamed from "${metadata.old_name}" to "${entityName}"`;
      }
      return `Renamed ${loggableType.toLowerCase()} to "${entityName}"`;
    default:
      // For custom actions, try to humanize the action
      const humanizedAction = action.replace(/_/g, ' ').toLowerCase();
      return `${humanizedAction} ${loggableType.toLowerCase()} "${entityName}"`;
  }
}

export function getEntityEmoji(log: ActivityLogData, client?: ClientData): string {
  return getEntityTypeEmoji(log.loggable_type, client);
}

export function isLinkable(log: ActivityLogData): boolean {
  return log.action !== 'deleted' && !!log.loggable_id;
}

export function getLoggablePath(log: ActivityLogData): string | null {
  if (!isLinkable(log)) return null;
  
  switch (log.loggable_type) {
    case 'Client':
      return `/clients/${log.loggable_id}`;
    case 'Job':
      // If we have both client_id and loggable_id, use the nested route
      return log.client_id && log.loggable_id 
        ? `/clients/${log.client_id}/jobs/${log.loggable_id}`
        : `/jobs/${log.loggable_id}`;
    case 'Task':
      return `/tasks/${log.loggable_id}`;
    case 'Person':
      return `/people/${log.loggable_id}`;
    case 'Device':
      return `/devices/${log.loggable_id}`;
    default:
      return null;
  }
}