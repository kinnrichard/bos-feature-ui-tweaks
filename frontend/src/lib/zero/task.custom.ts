// ✏️ CUSTOM ZERO MUTATIONS
// Add your custom mutation logic here
//
// 💡 This file is safe to edit - it won't be overwritten by generation
//
// 🔗 You can override generated mutations by exporting functions with the same name
// 📚 Docs: https://zero.rocicorp.dev/docs/mutations


import { getZero } from './zero-client';

// Custom mutations for tasks
// Add your custom business logic here

// Example: Hard delete (permanent removal)
// export async function hardDeleteTask(id: string) {
//   const zero = getZero();
//   await zero.mutate.tasks.delete({ id });
//   return { id };
// }


// Example: Status transition with business logic
// export async function transitionTaskStatus(
//   id: string, 
//   newStatus: 'new_task' | 'in_progress' | 'paused' | 'successfully_completed' | 'cancelled'
// ) {
//   // Add validation logic here
//   // Check current status, validate transition
//   
//   return updateTask(id, { status: newStatus });
// }


// Example: Custom validation mutation
// export async function validateAndUpdateTask(id: string, data: any) {
//   // Add custom validation logic
//   // Then call standard update
//   return updateTask(id, data);
// }
