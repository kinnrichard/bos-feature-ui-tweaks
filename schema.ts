// Zero Schema with Development Permissions
// This file defines the schema and permissions for Zero database access

import { ANYONE_CAN, definePermissions } from '@rocicorp/zero';

// Import the generated schema definition
import { schema as generatedSchema } from './frontend/src/lib/zero/generated-schema.ts';

// Export the schema for Zero deployment
export const schema = generatedSchema;

// Export development permissions configuration - simplified for debugging
export const permissions = definePermissions(generatedSchema, () => {
  // Create a simple permission that allows everything
  const allowAll = ANYONE_CAN;
  
  return {
    // Grant unrestricted access to all tables for development
    clients: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    users: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    people: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    contact_methods: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    devices: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    jobs: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    tasks: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    notes: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    activity_logs: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    scheduled_date_times: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    scheduled_date_time_users: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    job_assignments: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    job_people: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    job_targets: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    people_groups: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    people_group_memberships: { row: { select: allowAll, insert: allowAll, update: { preMutation: allowAll, postMutation: allowAll }, delete: allowAll } },
    
    // Front tables - READ ONLY (synced from Front API)
    front_conversations: { row: { select: allowAll } },
    front_messages: { row: { select: allowAll } },
    front_contacts: { row: { select: allowAll } },
    front_tags: { row: { select: allowAll } },
    front_inboxes: { row: { select: allowAll } },
    front_attachments: { row: { select: allowAll } },
    front_conversation_tags: { row: { select: allowAll } },
    front_message_recipients: { row: { select: allowAll } },
    front_conversation_inboxes: { row: { select: allowAll } },
    front_sync_logs: { row: { select: allowAll } },
    front_teammates: { row: { select: allowAll } },
    front_tickets: { row: { select: allowAll } },
    front_conversation_tickets: { row: { select: allowAll } },
    
    // Join tables
    clients_front_conversations: { row: { select: allowAll } },
    people_front_conversations: { row: { select: allowAll } },
  };
});