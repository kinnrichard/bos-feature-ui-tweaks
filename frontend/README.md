# BOS Frontend

The frontend application for the BOS (Business Operations System), featuring a comprehensive polymorphic tracking system for managing dynamic relationships.

## Table of Contents

- [Quick Start](#quick-start)
- [Polymorphic Tracking System](#polymorphic-tracking-system)
- [Architecture](#architecture)
- [Development](#development)
- [Documentation](#documentation)

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database

### Installation

```bash
# Clone and install dependencies
npm install

# Start development server
npm run dev
```

### Basic Usage

```typescript
// Initialize the polymorphic system
import { initializePolymorphicSystem } from '@/lib/zero/polymorphic';

await initializePolymorphicSystem();

// Query activity logs
import { createLoggableQuery } from '@/lib/zero/polymorphic';

const logs = await createLoggableQuery({
  targetTypes: ['jobs', 'tasks'],
  limit: 20
}).execute();
```

## Polymorphic Tracking System

The BOS frontend features a sophisticated polymorphic tracking system that manages dynamic relationships between entities. This system replaces hardcoded polymorphic relationships with a configurable, type-safe solution.

### Key Features

- **🔧 Dynamic Configuration**: JSON-based configuration management
- **🚀 Type Safety**: Full TypeScript support with compile-time validation  
- **⚡ High Performance**: Built-in caching and query optimization
- **🔍 Auto-Discovery**: Automatic detection of polymorphic patterns
- **📊 Query System**: Advanced querying with reactive updates
- **🛠️ Easy Integration**: Seamless integration with existing Zero.js models

### Polymorphic Types

The system manages these polymorphic relationships:

| Type | Description | Tables | Targets |
|------|-------------|--------|---------|
| **loggable** | Activity logs track changes | `activity_logs` | jobs, tasks, clients, users, people |
| **notable** | Notes attached to entities | `notes` | jobs, tasks, clients |
| **schedulable** | Scheduled date/times | `scheduled_date_times` | jobs, tasks |
| **target** | Job target relationships | `job_targets` | clients, people, people_groups |
| **parseable** | Parsed email associations | `parsed_emails` | jobs, tasks |

### Quick Examples

#### Activity Logs

```typescript
// Get recent activity for a job
const jobActivity = await createLoggableQuery({
  targetTypes: ['jobs'],
  conditions: {
    loggable_id: 'job-123',
    loggable_type: 'Job'
  },
  orderBy: 'created_at DESC',
  limit: 10
}).execute();

// Get activity across multiple entity types
const recentActivity = await createLoggableQuery({
  targetTypes: ['jobs', 'tasks', 'clients'],
  conditions: {
    created_at: { gte: '2025-08-01' }
  }
}).execute();
```

#### Notes Management

```typescript
// Get notes for an entity
const entityNotes = await createNotableQuery({
  targetTypes: ['jobs'],
  conditions: {
    notable_id: 'job-456',
    notable_type: 'Job'
  }
}).execute();

// Search across all notes
const searchResults = await createNotableQuery({
  targetTypes: ['jobs', 'tasks', 'clients'],
  conditions: {
    content: { contains: 'urgent' }
  }
}).execute();
```

#### Reactive Queries

```typescript
// Create reactive query for real-time updates
const reactiveQuery = createReactiveLoggableQuery({
  targetTypes: ['jobs'],
  conditions: { loggable_id: jobId },
  autoRefresh: true
});

// Subscribe to updates
reactiveQuery.subscribe((result) => {
  console.log('Updated activity logs:', result.data);
});

// Cleanup when done
reactiveQuery.cleanup();
```

## Architecture

### System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Configuration  │    │    Discovery    │    │    Registry     │
│     System      │    │     System      │    │  Integration    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Query System   │
                    │   (Core API)    │
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │   Utilities &   │
                    │    Helpers      │
                    └─────────────────┘
```

### Core Components

1. **PolymorphicTracker** - Main orchestrator for configuration and tracking
2. **PolymorphicRegistry** - Integration with existing RelationshipRegistry
3. **Query System** - Advanced querying with caching and reactivity
4. **Discovery System** - Automatic pattern detection and migration
5. **Type System** - Full TypeScript support for type safety

### Integration Points

- **Zero.js Schema**: Dynamic relationship generation
- **RelationshipRegistry**: Seamless integration with existing patterns
- **Svelte Components**: Reactive UI components with automatic updates
- **Database Layer**: Optimized queries with proper indexing

## Development

### Project Structure

```
src/lib/zero/polymorphic/
├── docs/                       # Comprehensive documentation
│   ├── API.md                 # Complete API reference
│   ├── MIGRATION_GUIDE.md     # Migration from hardcoded relationships
│   ├── CONFIGURATION.md       # Configuration management guide
│   ├── EXAMPLES.md           # Real-world usage examples
│   ├── DEVELOPER_GUIDE.md    # Extension and development guide
│   ├── TROUBLESHOOTING.md    # Common issues and solutions
│   └── PERFORMANCE.md        # Performance optimization guide
├── core/                      # Core system components
├── query/                     # Query system and builders
├── discovery/                 # Auto-discovery utilities
├── integration/               # Zero.js and model integration
├── types.ts                   # TypeScript definitions
└── index.ts                   # Main entry point
```

### Development Scripts

```bash
# Development
npm run dev                    # Start development server
npm run build                  # Build for production
npm run preview               # Preview production build

# Testing
npm run test                  # Run all tests
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests only
npm run test:e2e             # End-to-end tests

# Linting and formatting
npm run lint                 # Run ESLint
npm run format               # Format with Prettier
npm run type-check           # TypeScript type checking

# Polymorphic system specific
npm run polymorphic:health   # Check system health
npm run polymorphic:discover # Run auto-discovery
npm run polymorphic:migrate  # Run migration scripts
```

### Environment Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Initialize polymorphic system
npm run polymorphic:init
```

## Documentation

### Comprehensive Guides

The polymorphic system includes extensive documentation:

- **[API Reference](src/lib/zero/polymorphic/docs/API.md)** - Complete API documentation
- **[Migration Guide](src/lib/zero/polymorphic/docs/MIGRATION_GUIDE.md)** - Step-by-step migration from hardcoded relationships
- **[Configuration Guide](src/lib/zero/polymorphic/docs/CONFIGURATION.md)** - Configuration format and management
- **[Examples](src/lib/zero/polymorphic/docs/EXAMPLES.md)** - Real-world usage examples and patterns
- **[Developer Guide](src/lib/zero/polymorphic/docs/DEVELOPER_GUIDE.md)** - Extension points and development
- **[Troubleshooting](src/lib/zero/polymorphic/docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Performance](src/lib/zero/polymorphic/docs/PERFORMANCE.md)** - Optimization strategies and monitoring

### Quick Reference

#### System Initialization

```typescript
import { initializePolymorphicSystem } from '@/lib/zero/polymorphic';

// Initialize at app startup
await initializePolymorphicSystem();
```

#### Basic Queries

```typescript
import { 
  createLoggableQuery,
  createNotableQuery,
  createSchedulableQuery 
} from '@/lib/zero/polymorphic';

// Activity logs
const logs = await createLoggableQuery({ targetTypes: ['jobs'] }).execute();

// Notes
const notes = await createNotableQuery({ targetTypes: ['clients'] }).execute();

// Schedules  
const schedules = await createSchedulableQuery({ 
  targetTypes: ['jobs', 'tasks'] 
}).execute();
```

#### Configuration Management

```typescript
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';

const tracker = getPolymorphicTracker();

// Check valid targets
const targets = tracker.getValidTargets('loggable');

// Add new target
await tracker.addTarget('loggable', 'projects', 'Project', {
  source: 'manual'
});

// Validate configuration
const validation = tracker.validate();
```

#### Caching and Performance

```typescript
import { executeCachedQuery } from '@/lib/zero/polymorphic';

// Execute with caching
const result = await executeCachedQuery('loggable', {
  targetTypes: ['jobs'],
  cacheKey: 'recent-job-activity',
  ttl: 300 // 5 minutes
});
```

### Technology Stack

- **Frontend Framework**: SvelteKit
- **Type System**: TypeScript
- **Database**: PostgreSQL with Zero.js ORM
- **Styling**: Tailwind CSS
- **Testing**: Vitest, Playwright
- **Build Tool**: Vite

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Update documentation
6. Submit a pull request

### System Health

Check system health with diagnostic commands:

```typescript
import { 
  validatePolymorphicSystem,
  runFullDiagnostics,
  generateSupportReport 
} from '@/lib/zero/polymorphic';

// Quick health check
const health = await validatePolymorphicSystem();

// Full diagnostic report
const report = await runFullDiagnostics();

// Support information
const supportInfo = generateSupportReport();
```

### License

MIT License - see LICENSE file for details.

### Support

- **Documentation**: Start with the [API Reference](src/lib/zero/polymorphic/docs/API.md)
- **Issues**: Check the [Troubleshooting Guide](src/lib/zero/polymorphic/docs/TROUBLESHOOTING.md)
- **Examples**: Review [real-world examples](src/lib/zero/polymorphic/docs/EXAMPLES.md)
- **Migration**: Follow the [Migration Guide](src/lib/zero/polymorphic/docs/MIGRATION_GUIDE.md)

---

## Polymorphic System Benefits

### Before: Hardcoded Relationships
```typescript
// 20+ hardcoded relationships for each polymorphic type
loggableJob: one({ sourceField: ['loggable_id'], destField: ['id'], destSchema: jobs }),
loggableTask: one({ sourceField: ['loggable_id'], destField: ['id'], destSchema: tasks }),
loggableClient: one({ sourceField: ['loggable_id'], destField: ['id'], destSchema: clients }),
// ... many more hardcoded entries
```

### After: Dynamic System
```typescript
// Single line generates all relationships dynamically
...IntegrationUtils.generateZeroJsRelationships('loggable', 'activity_logs')
```

### Key Improvements

- ✅ **90% Less Code**: Dynamic generation eliminates hardcoded relationships
- ✅ **Type Safety**: Full TypeScript support with compile-time validation
- ✅ **Easy Maintenance**: Add new targets without touching schema code
- ✅ **Better Performance**: Built-in caching and query optimization
- ✅ **Auto-Discovery**: Automatically detect and migrate existing patterns
- ✅ **Comprehensive Testing**: Extensive test suite ensuring reliability