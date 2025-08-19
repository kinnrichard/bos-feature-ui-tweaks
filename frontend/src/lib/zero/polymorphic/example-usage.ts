/**
 * Example Usage of Polymorphic Model Integration
 * 
 * This file demonstrates how to use the polymorphic tracking system
 * with the existing model architecture. It shows the migration from
 * hardcoded polymorphic relationships to the dynamic system.
 * 
 * Created: 2025-08-06
 */

import { 
  declarePolymorphicRelationships,
  polymorphicMigration,
  polymorphicSchemaGenerator,
  type ModelPolymorphicConfig
} from './index';

/**
 * Example 1: Declare polymorphic relationships for existing models
 */

// Notes table with polymorphic notable relationship
declarePolymorphicRelationships({
  tableName: 'notes',
  belongsTo: {
    notable: {
      typeField: 'notable_type',
      idField: 'notable_id',
      allowedTypes: ['job', 'task', 'client']
    }
  }
});

// Activity logs table with polymorphic loggable relationship
declarePolymorphicRelationships({
  tableName: 'activity_logs',
  belongsTo: {
    loggable: {
      typeField: 'loggable_type',
      idField: 'loggable_id',
      allowedTypes: ['job', 'task', 'client', 'person', 'device']
    }
  }
});

// Scheduled date times with polymorphic schedulable relationship
declarePolymorphicRelationships({
  tableName: 'scheduled_date_times',
  belongsTo: {
    schedulable: {
      typeField: 'schedulable_type',
      idField: 'schedulable_id',
      allowedTypes: ['job', 'task']
    }
  }
});

/**
 * Example 2: Migration from hardcoded relationships
 */
export async function migrateExistingPolymorphicRelationships() {
  console.warn('🔄 Analyzing existing polymorphic patterns...');
  
  const analysis = polymorphicMigration.generateMigrationConfiguration({
    validateOnly: true,
    includeSchemaGeneration: true
  });

  console.warn('📊 Migration Analysis:');
  console.warn(`- Tables with polymorphic patterns: ${analysis.tablesWithPolymorphicPatterns.length}`);
  console.warn(`- Detected patterns: ${analysis.detectedPatterns.length}`);
  console.warn(`- Validation errors: ${analysis.validationErrors.length}`);

  if (analysis.validationErrors.length > 0) {
    console.error('❌ Validation errors found:');
    analysis.validationErrors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  // Generate migration code
  console.warn('📝 Generated migration code:');
  const migrationCode = polymorphicMigration.generateMigrationCode(analysis.suggestedConfigurations);
  console.warn(migrationCode);

  // Execute migration (dry run)
  const migrationResult = polymorphicMigration.executeMigration(analysis.suggestedConfigurations, {
    dryRun: true
  });

  console.warn('🏃 Migration dry run results:');
  migrationResult.results.forEach(result => console.warn(`  ✅ ${result}`));
  
  if (migrationResult.errors.length > 0) {
    console.error('❌ Migration errors:');
    migrationResult.errors.forEach(error => console.error(`  - ${error}`));
    return false;
  }

  return true;
}

/**
 * Example 3: Schema generation for Zero.js
 */
export function generatePolymorphicSchema() {
  console.warn('🏗️  Generating polymorphic schema relationships...');
  
  const schemaCode = polymorphicSchemaGenerator.generateSchemaCompositionCode();
  console.warn('Generated schema code:');
  console.warn(schemaCode);

  const migrationInstructions = polymorphicSchemaGenerator.generateMigrationInstructions();
  console.warn('\nMigration instructions:');
  console.warn(migrationInstructions);

  return {
    schemaCode,
    migrationInstructions
  };
}

/**
 * Example 4: Using polymorphic relationships in queries
 */
export function examplePolymorphicQueries() {
  // These are examples of how the relationships would be used
  // after the integration is complete:

  /*
  // Before (hardcoded relationships):
  const notes = await Note.includes('notableJob', 'notableTask', 'notableClient').all();
  
  // After (polymorphic system):
  const notes = await Note.includes('notable').all(); // Loads all polymorphic types
  
  // Or specific types:
  const jobNotes = await Note.includes('notableJob').all();
  const taskNotes = await Note.includes('notableTask').all();
  
  // Activity logs with polymorphic loggable:
  const logs = await ActivityLog.includes('loggable').all();
  const jobLogs = await ActivityLog.includes('loggableJob').all();
  
  // Scheduled date times:
  const schedules = await ScheduledDateTime.includes('schedulable').all();
  const jobSchedules = await ScheduledDateTime.includes('schedulableJob').all();
  */
}

/**
 * Example 5: Runtime polymorphic helpers
 */
export async function examplePolymorphicHelpers() {
  const { createPolymorphicIncludes } = await import('./model-helpers');

  // Create helpers for specific models
  const noteHelpers = createPolymorphicIncludes('notes');
  
  // Get available polymorphic types
  const notableTypes = noteHelpers.getPolymorphicTypes('notable');
  console.warn('Available notable types:', notableTypes); // ['job', 'task', 'client']
  
  // Validate polymorphic relationship
  const isValidJobNotable = noteHelpers.isValidPolymorphicRelationship('notable', 'job');
  console.warn('Is job a valid notable type?', isValidJobNotable); // true
  
  // Get typed relationship name
  const jobRelationshipName = noteHelpers.includePolymorphicBelongsTo('notable', 'job');
  console.warn('Job relationship name:', jobRelationshipName); // 'notableJob'
}

/**
 * Example 6: Integration with existing models
 */
export function integrateWithExistingModels() {
  // This shows how existing models would be updated to use the polymorphic system.
  // The actual integration would happen in the model files themselves.

  /*
  // In src/lib/models/note.ts:
  import { declarePolymorphicRelationships } from '@/lib/zero/polymorphic';

  // Declare polymorphic relationships
  declarePolymorphicRelationships({
    tableName: 'notes',
    belongsTo: {
      notable: {
        typeField: 'notable_type',
        idField: 'notable_id',
        allowedTypes: ['job', 'task', 'client']
      }
    }
  });

  // The existing registerModelRelationships call could be removed or kept for non-polymorphic relationships
  registerModelRelationships('notes', {
    user: { type: 'belongsTo', model: 'User' },
    // notable relationships are now handled by polymorphic system
  });
  */

  /*
  // In src/lib/models/activity-log.ts:
  import { declarePolymorphicRelationships } from '@/lib/zero/polymorphic';

  declarePolymorphicRelationships({
    tableName: 'activity_logs',
    belongsTo: {
      loggable: {
        typeField: 'loggable_type',
        idField: 'loggable_id',
        allowedTypes: ['job', 'task', 'client', 'person', 'device']
      }
    }
  });

  registerModelRelationships('activity_logs', {
    user: { type: 'belongsTo', model: 'User' },
    // loggable relationships are now handled by polymorphic system
  });
  */
}

/**
 * Initialization function for the complete system
 */
export async function initializePolymorphicIntegration() {
  console.warn('🚀 Initializing polymorphic model integration...');
  
  try {
    // 1. Declare all polymorphic relationships
    console.warn('📋 Declaring polymorphic relationships...');
    // (The declarations above are already executed when this module loads)
    
    // 2. Analyze migration needs
    console.warn('🔍 Analyzing migration requirements...');
    const migrationValid = await migrateExistingPolymorphicRelationships();
    
    if (!migrationValid) {
      throw new Error('Migration validation failed');
    }
    
    // 3. Generate schema integration
    console.warn('🏗️  Generating schema integration...');
    generatePolymorphicSchema();
    
    // 4. Test polymorphic helpers
    console.warn('🧪 Testing polymorphic helpers...');
    await examplePolymorphicHelpers();
    
    console.warn('✅ Polymorphic model integration initialized successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to initialize polymorphic integration:', error);
    return false;
  }
}

// Export configuration for easy reuse
export const EXAMPLE_POLYMORPHIC_CONFIGS: Record<string, ModelPolymorphicConfig> = {
  notes: {
    tableName: 'notes',
    belongsTo: {
      notable: {
        typeField: 'notable_type',
        idField: 'notable_id',
        allowedTypes: ['job', 'task', 'client']
      }
    }
  },
  
  activity_logs: {
    tableName: 'activity_logs',
    belongsTo: {
      loggable: {
        typeField: 'loggable_type',
        idField: 'loggable_id',
        allowedTypes: ['job', 'task', 'client', 'person', 'device']
      }
    }
  },
  
  scheduled_date_times: {
    tableName: 'scheduled_date_times',
    belongsTo: {
      schedulable: {
        typeField: 'schedulable_type',
        idField: 'schedulable_id',
        allowedTypes: ['job', 'task']
      }
    }
  }
};