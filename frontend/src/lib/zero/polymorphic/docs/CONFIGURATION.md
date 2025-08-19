# Configuration Guide

## Overview

The Polymorphic Tracking System uses JSON configuration to manage polymorphic relationships. This guide covers the configuration format, options, and best practices for managing your polymorphic relationships.

## Table of Contents

- [Configuration Structure](#configuration-structure)
- [Creating Configuration](#creating-configuration)
- [Loading and Saving](#loading-and-saving)
- [Validation](#validation)
- [Configuration Management](#configuration-management)
- [Environment-Specific Configurations](#environment-specific-configurations)
- [Best Practices](#best-practices)

## Configuration Structure

### Full Configuration Format

```json
{
  "associations": {
    "loggable": {
      "type": "loggable",
      "description": "Activity logs track changes to various models",
      "validTargets": {
        "jobs": {
          "modelName": "Job",
          "tableName": "jobs",
          "discoveredAt": "2025-08-06T10:30:00.000Z",
          "lastVerifiedAt": "2025-08-06T10:30:00.000Z",
          "active": true,
          "source": "generated-schema"
        },
        "tasks": {
          "modelName": "Task",
          "tableName": "tasks",
          "discoveredAt": "2025-08-06T10:30:00.000Z",
          "lastVerifiedAt": "2025-08-06T10:30:00.000Z",
          "active": true,
          "source": "generated-schema"
        },
        "clients": {
          "modelName": "Client",
          "tableName": "clients",
          "discoveredAt": "2025-08-06T10:30:00.000Z",
          "lastVerifiedAt": "2025-08-06T10:30:00.000Z",
          "active": true,
          "source": "manual"
        }
      },
      "metadata": {
        "createdAt": "2025-08-06T10:30:00.000Z",
        "updatedAt": "2025-08-06T10:30:00.000Z",
        "configVersion": "1.0.0",
        "generatedBy": "PolymorphicTracker"
      }
    },
    "notable": {
      "type": "notable",
      "description": "Notes belong to jobs, tasks, clients",
      "validTargets": {
        "jobs": {
          "modelName": "Job",
          "tableName": "jobs",
          "discoveredAt": "2025-08-06T10:30:00.000Z",
          "lastVerifiedAt": "2025-08-06T10:30:00.000Z",
          "active": true,
          "source": "generated-schema"
        },
        "tasks": {
          "modelName": "Task",
          "tableName": "tasks",
          "discoveredAt": "2025-08-06T10:30:00.000Z",
          "lastVerifiedAt": "2025-08-06T10:30:00.000Z",
          "active": true,
          "source": "generated-schema"
        },
        "clients": {
          "modelName": "Client",
          "tableName": "clients",
          "discoveredAt": "2025-08-06T10:30:00.000Z",
          "lastVerifiedAt": "2025-08-06T10:30:00.000Z",
          "active": true,
          "source": "generated-schema"
        }
      },
      "metadata": {
        "createdAt": "2025-08-06T10:30:00.000Z",
        "updatedAt": "2025-08-06T10:30:00.000Z",
        "configVersion": "1.0.0",
        "generatedBy": "PolymorphicTracker"
      }
    }
  },
  "metadata": {
    "createdAt": "2025-08-06T10:30:00.000Z",
    "updatedAt": "2025-08-06T10:30:00.000Z",
    "configVersion": "1.0.0",
    "totalAssociations": 5,
    "totalTargets": 20,
    "generatedBy": "PolymorphicTracker"
  }
}
```

### Configuration Fields

#### Global Metadata
```json
{
  "metadata": {
    "createdAt": "2025-08-06T10:30:00.000Z",     // When config was created
    "updatedAt": "2025-08-06T10:30:00.000Z",     // Last modification time
    "configVersion": "1.0.0",                    // Configuration format version
    "totalAssociations": 5,                      // Number of polymorphic types
    "totalTargets": 20,                          // Total number of targets
    "generatedBy": "PolymorphicTracker"          // What created this config
  }
}
```

#### Association Configuration
```json
{
  "type": "loggable",                            // Polymorphic type
  "description": "Activity logs track changes",  // Human-readable description
  "validTargets": { /* target definitions */ }, // Valid target models
  "metadata": {
    "createdAt": "2025-08-06T10:30:00.000Z",   // When association was created
    "updatedAt": "2025-08-06T10:30:00.000Z",   // Last modification time
    "configVersion": "1.0.0",                  // Config format version
    "generatedBy": "PolymorphicTracker"        // Source of this association
  }
}
```

#### Target Metadata
```json
{
  "modelName": "Job",                           // Model class name (PascalCase)
  "tableName": "jobs",                          // Database table name (snake_case)
  "discoveredAt": "2025-08-06T10:30:00.000Z",  // When target was first found
  "lastVerifiedAt": "2025-08-06T10:30:00.000Z", // Last verification time
  "active": true,                               // Whether target is currently active
  "source": "generated-schema"                  // How this target was discovered
}
```

### Source Types

Targets can have different sources indicating how they were discovered:

- **`generated-schema`**: Discovered from hardcoded schema relationships
- **`manual`**: Manually added by developer
- **`runtime`**: Discovered at runtime through database introspection
- **`migration`**: Added during a migration process
- **`auto-discovery`**: Found through automatic pattern analysis

## Creating Configuration

### Empty Configuration

Create a minimal configuration structure:

```typescript
import { ConfigUtils } from '@/lib/zero/polymorphic';

const emptyConfig = ConfigUtils.createDefaultConfig();
```

### From Discovery Results

Create configuration from auto-discovery:

```typescript
import { 
  discoverPolymorphicRelationships,
  ConfigUtils 
} from '@/lib/zero/polymorphic';

// Run discovery
const discoveryResults = await discoverPolymorphicRelationships();

// Create configuration from results
const config = ConfigUtils.createConfigFromDiscovery(discoveryResults);
```

### Manual Configuration

Create configuration manually:

```typescript
import { ConfigUtils, getPolymorphicTracker } from '@/lib/zero/polymorphic';

const tracker = getPolymorphicTracker();

// Add associations manually
await tracker.addTarget('loggable', 'projects', 'Project', {
  source: 'manual',
  description: 'Projects can be tracked in activity logs'
});

await tracker.addTarget('loggable', 'contracts', 'Contract', {
  source: 'manual',
  description: 'Contracts can be tracked in activity logs'  
});

// Add a new polymorphic type
const config = tracker.getConfig();
ConfigUtils.addAssociation(config, {
  type: 'trackable',
  description: 'General tracking relationships',
  validTargets: {
    'events': {
      modelName: 'Event',
      tableName: 'events',
      discoveredAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      active: true,
      source: 'manual'
    }
  }
});
```

### Hybrid Configuration

Combine discovered and manual configuration:

```typescript
import { 
  autoDiscoverAndConfigure,
  getPolymorphicTracker 
} from '@/lib/zero/polymorphic';

// Start with auto-discovery
await autoDiscoverAndConfigure({
  autoDiscover: true,
  source: 'initial-discovery'
});

// Add manual targets
const tracker = getPolymorphicTracker();

// Add new target to existing type
await tracker.addTarget('loggable', 'custom_events', 'CustomEvent', {
  source: 'manual'
});

// Add entirely new polymorphic type
await tracker.addTarget('trackable', 'user_actions', 'UserAction', {
  source: 'manual'
});
```

## Loading and Saving

### Loading Configuration

#### From Default Location

```typescript
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';

const tracker = getPolymorphicTracker();
await tracker.loadConfig(); // Loads from default location or discovers
```

#### From Specific File

```typescript
await tracker.loadConfig('./config/polymorphic-config.json');
```

#### With Validation

```typescript
await tracker.loadConfig('./config.json', { validate: true });
```

#### From Environment Variable

```typescript
const configPath = process.env.POLYMORPHIC_CONFIG_PATH;
if (configPath) {
  await tracker.loadConfig(configPath);
}
```

### Saving Configuration

#### To Default Location

```typescript
await tracker.saveConfig(); // Saves to default location
```

#### To Specific File

```typescript
await tracker.saveConfig('./config/production-config.json');
```

#### Export for Backup

```typescript
const config = tracker.getConfig();
const configJson = JSON.stringify(config, null, 2);

// Save to backup location
import fs from 'fs';
fs.writeFileSync('./backups/polymorphic-backup.json', configJson);
```

### Configuration Locations

Default configuration search order:

1. `./polymorphic-config.json` (project root)
2. `./config/polymorphic.json` (config directory)
3. `./src/lib/zero/polymorphic/config.json` (embedded config)
4. Auto-discovery if no config found

## Validation

### Validating Configuration

```typescript
import { getPolymorphicTracker, PolymorphicValidator } from '@/lib/zero/polymorphic';

// Using tracker validation
const tracker = getPolymorphicTracker();
const result = tracker.validate();

console.log('Valid:', result.valid);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);

// Using validator directly
const validator = new PolymorphicValidator();
const config = tracker.getConfig();
const validationResult = validator.validateConfig(config);
```

### Validation Rules

The system validates:

1. **Structure**: Proper JSON structure and required fields
2. **Types**: Correct polymorphic types and field types
3. **Relationships**: Valid model and table name relationships
4. **Consistency**: Consistent naming conventions
5. **Completeness**: All required metadata present
6. **Timestamps**: Valid ISO date strings

### Custom Validation

Add custom validation rules:

```typescript
import { PolymorphicValidator } from '@/lib/zero/polymorphic';

class CustomValidator extends PolymorphicValidator {
  validateCustomRules(config) {
    const errors = [];
    
    // Custom rule: All active targets must have recent verification
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    Object.values(config.associations).forEach(association => {
      Object.entries(association.validTargets).forEach(([targetName, metadata]) => {
        if (metadata.active && new Date(metadata.lastVerifiedAt) < oneWeekAgo) {
          errors.push({
            type: association.type,
            target: targetName,
            message: `Target ${targetName} needs verification (last verified > 1 week ago)`,
            severity: 'warning'
          });
        }
      });
    });
    
    return errors;
  }
}

const validator = new CustomValidator();
const result = validator.validateConfig(config);
```

## Configuration Management

### Versioning

Track configuration versions:

```typescript
import { ConfigUtils } from '@/lib/zero/polymorphic';

// Get current version
const config = tracker.getConfig();
console.log('Config version:', config.metadata.configVersion);

// Upgrade configuration
const upgradedConfig = ConfigUtils.upgradeConfig(config, '2.0.0');
```

### Merging Configurations

Combine multiple configurations:

```typescript
import { ConfigUtils } from '@/lib/zero/polymorphic';

const baseConfig = await loadConfigFromFile('./base-config.json');
const customConfig = await loadConfigFromFile('./custom-config.json');

const mergedConfig = ConfigUtils.mergeConfigurations(baseConfig, customConfig, {
  strategy: 'merge', // 'merge' | 'replace' | 'append'
  conflictResolution: 'custom' // How to handle conflicts
});

tracker.setConfig(mergedConfig);
```

### Configuration Diff

Compare configurations:

```typescript
import { ConfigUtils } from '@/lib/zero/polymorphic';

const oldConfig = await loadConfigFromFile('./old-config.json');
const newConfig = tracker.getConfig();

const diff = ConfigUtils.diffConfigurations(oldConfig, newConfig);

console.log('Added associations:', diff.added.associations);
console.log('Removed associations:', diff.removed.associations);
console.log('Modified targets:', diff.modified.targets);
```

### Configuration Templates

Create reusable configuration templates:

```typescript
// config-templates.ts
export const STANDARD_BOS_CONFIG = {
  associations: {
    loggable: {
      type: 'loggable',
      description: 'Activity logs track changes to various models',
      validTargets: {
        jobs: { modelName: 'Job', tableName: 'jobs', source: 'standard', active: true },
        tasks: { modelName: 'Task', tableName: 'tasks', source: 'standard', active: true },
        clients: { modelName: 'Client', tableName: 'clients', source: 'standard', active: true }
      }
    },
    notable: {
      type: 'notable',
      description: 'Notes belong to jobs, tasks, clients',
      validTargets: {
        jobs: { modelName: 'Job', tableName: 'jobs', source: 'standard', active: true },
        tasks: { modelName: 'Task', tableName: 'tasks', source: 'standard', active: true },
        clients: { modelName: 'Client', tableName: 'clients', source: 'standard', active: true }
      }
    }
  }
};

// Use template
const config = ConfigUtils.createFromTemplate(STANDARD_BOS_CONFIG);
```

## Environment-Specific Configurations

### Development Configuration

```json
{
  "associations": {
    "loggable": {
      "type": "loggable",
      "description": "Development - includes test models",
      "validTargets": {
        "jobs": { /* standard config */ },
        "tasks": { /* standard config */ },
        "test_models": {
          "modelName": "TestModel",
          "tableName": "test_models",
          "source": "development",
          "active": true
        }
      }
    }
  }
}
```

### Production Configuration

```json
{
  "associations": {
    "loggable": {
      "type": "loggable",
      "description": "Production - stable targets only",
      "validTargets": {
        "jobs": { /* standard config */ },
        "tasks": { /* standard config */ },
        "clients": { /* standard config */ }
      }
    }
  }
}
```

### Loading Environment-Specific Configuration

```typescript
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';

const tracker = getPolymorphicTracker();
const environment = process.env.NODE_ENV || 'development';

// Load environment-specific configuration
const configPath = `./config/polymorphic-${environment}.json`;

try {
  await tracker.loadConfig(configPath);
  console.log(`✅ Loaded ${environment} configuration`);
} catch (error) {
  console.warn(`⚠️ Failed to load ${environment} config, falling back to default`);
  await tracker.loadConfig(); // Fallback to default
}
```

### Configuration Overrides

Override specific settings per environment:

```typescript
import { ConfigUtils } from '@/lib/zero/polymorphic';

// Load base configuration
await tracker.loadConfig('./config/base-config.json');
const baseConfig = tracker.getConfig();

// Apply environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  // Add debug targets in development
  ConfigUtils.addTarget(baseConfig, 'loggable', 'debug_logs', {
    modelName: 'DebugLog',
    tableName: 'debug_logs',
    source: 'development',
    active: true
  });
} else if (process.env.NODE_ENV === 'production') {
  // Remove experimental targets in production
  ConfigUtils.removeTarget(baseConfig, 'loggable', 'experimental_models');
}

tracker.setConfig(baseConfig);
```

## Best Practices

### 1. Version Control

Always version control your configuration files:

```bash
# Include in git
git add config/polymorphic-*.json

# Use .gitignore for generated configs
echo "polymorphic-config.generated.json" >> .gitignore
```

### 2. Configuration Validation in CI

Add validation to your CI pipeline:

```typescript
// scripts/validate-config.ts
import { validatePolymorphicSystem } from '@/lib/zero/polymorphic';

async function validateInCI() {
  try {
    await initializePolymorphicSystem();
    const health = await validatePolymorphicSystem();
    
    if (!health.healthy) {
      console.error('❌ Polymorphic configuration validation failed');
      health.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
    
    console.log('✅ Polymorphic configuration is valid');
  } catch (error) {
    console.error('❌ Configuration validation error:', error);
    process.exit(1);
  }
}

validateInCI();
```

### 3. Regular Configuration Updates

Keep configuration synchronized with schema changes:

```typescript
// scripts/update-config.ts
import { 
  getPolymorphicTracker,
  autoDiscoverAndConfigure 
} from '@/lib/zero/polymorphic';

async function updateConfiguration() {
  console.log('🔄 Updating polymorphic configuration...');
  
  // Backup current config
  const tracker = getPolymorphicTracker();
  await tracker.saveConfig('./backups/config-backup.json');
  
  // Run discovery to find new relationships
  await autoDiscoverAndConfigure({
    autoDiscover: true,
    source: 'scheduled-update',
    validateTargets: true
  });
  
  // Validate updated config
  const validation = tracker.validate();
  if (!validation.valid) {
    console.error('❌ Updated configuration is invalid');
    // Restore backup
    await tracker.loadConfig('./backups/config-backup.json');
    return false;
  }
  
  // Save updated config
  await tracker.saveConfig();
  console.log('✅ Configuration updated successfully');
  
  return true;
}

updateConfiguration();
```

### 4. Configuration Documentation

Document your polymorphic relationships:

```typescript
// config-documentation.ts
export const POLYMORPHIC_RELATIONSHIP_DOCS = {
  loggable: {
    purpose: 'Track activity logs for various business entities',
    usage: 'Used in audit trails, change history, and activity feeds',
    targets: {
      jobs: 'Track job-related activities like status changes, assignments',
      tasks: 'Track task completion, updates, and progress',
      clients: 'Track client interactions, contact updates, notes'
    },
    examples: [
      'Job status changed from pending to in-progress',
      'Task assigned to technician',
      'Client contact information updated'
    ]
  },
  notable: {
    purpose: 'Attach notes to various business entities',
    usage: 'Used for adding contextual information and comments',
    targets: {
      jobs: 'Job-specific notes and instructions',
      tasks: 'Task completion notes and observations',
      clients: 'Client service history and preferences'
    }
  }
};
```

### 5. Configuration Monitoring

Monitor configuration health:

```typescript
// config-monitoring.ts
import { 
  getPolymorphicTracker,
  validatePolymorphicSystem 
} from '@/lib/zero/polymorphic';

async function monitorConfiguration() {
  const tracker = getPolymorphicTracker();
  const config = tracker.getConfig();
  
  // Check for stale targets (not verified recently)
  const staleTargets = ConfigUtils.findStaleTargets(config, {
    maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
  });
  
  if (staleTargets.length > 0) {
    console.warn('⚠️ Found stale targets:', staleTargets);
    // Alert or update verification timestamps
  }
  
  // Check system health
  const health = await validatePolymorphicSystem();
  if (!health.healthy) {
    console.error('❌ Polymorphic system health check failed');
    // Send alerts, log issues, etc.
  }
  
  // Log configuration metrics
  const summary = await getPolymorphicSystemSummary();
  console.log('📊 Configuration Metrics:', summary);
}

// Run monitoring periodically
setInterval(monitorConfiguration, 60 * 60 * 1000); // Every hour
```

### 6. Testing Configuration Changes

Always test configuration changes:

```typescript
// test-config-changes.ts
import { describe, it, expect } from 'vitest';

describe('Configuration Changes', () => {
  it('should maintain backwards compatibility', async () => {
    const tracker = getPolymorphicTracker();
    
    // Test that existing relationships still work
    expect(tracker.isValidTarget('loggable', 'jobs')).toBe(true);
    expect(tracker.isValidTarget('notable', 'tasks')).toBe(true);
  });
  
  it('should handle new targets correctly', async () => {
    // Test new target addition
    await tracker.addTarget('loggable', 'new_model', 'NewModel', {
      source: 'test'
    });
    
    expect(tracker.isValidTarget('loggable', 'new_model')).toBe(true);
  });
});
```