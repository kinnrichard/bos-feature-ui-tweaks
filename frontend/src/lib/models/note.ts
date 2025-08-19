/**
 * Note - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for notes table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveNote instead:
 * ```typescript
 * import { ReactiveNote as Note } from './reactive-note';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type { NoteData, CreateNoteData, UpdateNoteData } from './types/note-data';
import { registerModelRelationships } from './base/scoped-query-base';
import { declarePolymorphicRelationships } from '../zero/polymorphic';

/**
 * ActiveRecord configuration for Note
 */
const NoteConfig = {
  tableName: 'notes',
  className: 'Note',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * Note ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const note = await Note.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const note = await Note.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newNote = await Note.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedNote = await Note.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await Note.discard('123');
 *
 * // Restore discarded
 * await Note.undiscard('123');
 *
 * // Query with scopes
 * const allNotes = await Note.all().all();
 * const activeNotes = await Note.kept().all();
 * ```
 */
export const Note = createActiveRecord<NoteData>(NoteConfig);

// EP-0036: Polymorphic relationship declarations
declarePolymorphicRelationships({
  tableName: 'notes',
  belongsTo: {
    notable: {
      typeField: 'notable_type',
      idField: 'notable_id',
      allowedTypes: ['job', 'person', 'task'],
    },
  },
});

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('notes', {
  user: { type: 'belongsTo', model: 'User' },
});

// Export types for convenience
export type { NoteData, CreateNoteData, UpdateNoteData };

// Default export
export default Note;
