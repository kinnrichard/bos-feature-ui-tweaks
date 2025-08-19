/**
 * Schema Evolution System for Polymorphic Type Tracking
 * 
 * Manages schema versioning, migrations, and type discovery across database changes.
 * Provides persistence and recovery mechanisms for polymorphic configurations.
 */

import type { PolymorphicConfig, PolymorphicAssociation } from './types';

export interface SchemaVersion {
  version: string;
  timestamp: number;
  changes: SchemaChange[];
  polymorphicConfig: PolymorphicConfig;
}

export interface SchemaChange {
  type: 'add_association' | 'remove_association' | 'modify_association' | 'add_type' | 'remove_type';
  target: string; // table.field or association ID
  details: any;
  timestamp: number;
}

export interface SchemaMigration {
  fromVersion: string;
  toVersion: string;
  operations: MigrationOperation[];
}

export interface MigrationOperation {
  type: 'create_association' | 'update_association' | 'delete_association' | 'merge_types';
  data: any;
}

export class SchemaEvolution {
  private storageKey = 'zero_polymorphic_schema_versions';
  private configKey = 'zero_polymorphic_config';
  private versions: Map<string, SchemaVersion> = new Map();
  private currentVersion: string | null = null;

  constructor() {
    this.loadVersionHistory();
  }

  /**
   * Initialize schema evolution with current configuration
   */
  async initialize(config: PolymorphicConfig): Promise<void> {
    const version = this.generateVersionId();
    const schemaVersion: SchemaVersion = {
      version,
      timestamp: Date.now(),
      changes: [],
      polymorphicConfig: config
    };

    this.versions.set(version, schemaVersion);
    this.currentVersion = version;
    await this.saveVersionHistory();
  }

  /**
   * Track a new schema change
   */
  async trackChange(change: Omit<SchemaChange, 'timestamp'>): Promise<void> {
    if (!this.currentVersion) {
      throw new Error('Schema evolution not initialized');
    }

    const currentSchema = this.versions.get(this.currentVersion);
    if (!currentSchema) {
      throw new Error('Current schema version not found');
    }

    const schemaChange: SchemaChange = {
      ...change,
      timestamp: Date.now()
    };

    currentSchema.changes.push(schemaChange);
    await this.saveVersionHistory();
  }

  /**
   * Create a new schema version with updated configuration
   */
  async createNewVersion(config: PolymorphicConfig, changes: SchemaChange[]): Promise<string> {
    const newVersion = this.generateVersionId();
    const schemaVersion: SchemaVersion = {
      version: newVersion,
      timestamp: Date.now(),
      changes,
      polymorphicConfig: config
    };

    this.versions.set(newVersion, schemaVersion);
    this.currentVersion = newVersion;
    await this.saveVersionHistory();

    return newVersion;
  }

  /**
   * Generate migration between two schema versions
   */
  generateMigration(fromVersion: string, toVersion: string): SchemaMigration | null {
    const fromSchema = this.versions.get(fromVersion);
    const toSchema = this.versions.get(toVersion);

    if (!fromSchema || !toSchema) {
      return null;
    }

    const operations: MigrationOperation[] = [];
    
    // Compare associations
    const fromAssociations = new Map(
      fromSchema.polymorphicConfig.associations.map(a => [a.id, a])
    );
    const toAssociations = new Map(
      toSchema.polymorphicConfig.associations.map(a => [a.id, a])
    );

    // Find new associations
    for (const [id, association] of toAssociations) {
      if (!fromAssociations.has(id)) {
        operations.push({
          type: 'create_association',
          data: association
        });
      } else {
        // Check for modifications
        const fromAssoc = fromAssociations.get(id);
        if (fromAssoc && this.associationsEqual(fromAssoc, association)) {
          operations.push({
            type: 'update_association',
            data: { id, changes: this.getAssociationDiff(fromAssoc, association) }
          });
        }
      }
    }

    // Find removed associations
    for (const [id] of fromAssociations) {
      if (!toAssociations.has(id)) {
        operations.push({
          type: 'delete_association',
          data: { id }
        });
      }
    }

    return {
      fromVersion,
      toVersion,
      operations
    };
  }

  /**
   * Apply migration to current configuration
   */
  async applyMigration(migration: SchemaMigration, config: PolymorphicConfig): Promise<PolymorphicConfig> {
    const newConfig = JSON.parse(JSON.stringify(config)) as PolymorphicConfig;

    for (const operation of migration.operations) {
      switch (operation.type) {
        case 'create_association':
          newConfig.associations.push(operation.data);
          break;
        
        case 'update_association': {
          const index = newConfig.associations.findIndex(a => a.id === operation.data.id);
          if (index >= 0) {
            newConfig.associations[index] = { ...newConfig.associations[index], ...operation.data.changes };
          }
          break;
        }
        
        case 'delete_association':
          newConfig.associations = newConfig.associations.filter(a => a.id !== operation.data.id);
          break;
        
        case 'merge_types':
          // Handle type merging logic
          await this.mergeTypes(newConfig, operation.data);
          break;
      }
    }

    return newConfig;
  }

  /**
   * Get schema version history
   */
  getVersionHistory(): SchemaVersion[] {
    return Array.from(this.versions.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): string | null {
    return this.currentVersion;
  }

  /**
   * Get schema version by ID
   */
  getVersion(version: string): SchemaVersion | undefined {
    return this.versions.get(version);
  }

  /**
   * Rollback to previous schema version
   */
  async rollbackToVersion(version: string): Promise<PolymorphicConfig | null> {
    const targetSchema = this.versions.get(version);
    if (!targetSchema) {
      return null;
    }

    this.currentVersion = version;
    await this.saveVersionHistory();
    
    return targetSchema.polymorphicConfig;
  }

  /**
   * Detect schema changes since last version
   */
  detectChanges(currentConfig: PolymorphicConfig): SchemaChange[] {
    if (!this.currentVersion) {
      return [];
    }

    const lastSchema = this.versions.get(this.currentVersion);
    if (!lastSchema) {
      return [];
    }

    const changes: SchemaChange[] = [];
    const lastConfig = lastSchema.polymorphicConfig;

    // Compare associations
    const lastAssociations = new Map(lastConfig.associations.map(a => [a.id, a]));
    const currentAssociations = new Map(currentConfig.associations.map(a => [a.id, a]));

    // New associations
    for (const [id, association] of currentAssociations) {
      if (!lastAssociations.has(id)) {
        changes.push({
          type: 'add_association',
          target: id,
          details: association,
          timestamp: Date.now()
        });
      }
    }

    // Removed associations
    for (const [id] of lastAssociations) {
      if (!currentAssociations.has(id)) {
        changes.push({
          type: 'remove_association',
          target: id,
          details: { id },
          timestamp: Date.now()
        });
      }
    }

    return changes;
  }

  /**
   * Clean up old schema versions (keep last N versions)
   */
  async cleanupVersionHistory(keepVersions: number = 10): Promise<void> {
    const versions = this.getVersionHistory();
    if (versions.length <= keepVersions) {
      return;
    }

    // Keep the most recent versions
    const toKeep = versions.slice(0, keepVersions);
    this.versions.clear();
    
    toKeep.forEach(version => {
      this.versions.set(version.version, version);
    });

    await this.saveVersionHistory();
  }

  private generateVersionId(): string {
    return `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private associationsEqual(a: PolymorphicAssociation, b: PolymorphicAssociation): boolean {
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  private getAssociationDiff(from: PolymorphicAssociation, to: PolymorphicAssociation): Partial<PolymorphicAssociation> {
    const diff: any = {};
    
    for (const key in to) {
      if (to[key as keyof PolymorphicAssociation] !== from[key as keyof PolymorphicAssociation]) {
        diff[key] = to[key as keyof PolymorphicAssociation];
      }
    }

    return diff;
  }

  private async mergeTypes(config: PolymorphicConfig, mergeData: any): Promise<void> {
    // Implementation for merging polymorphic types
    // This would handle complex type consolidation scenarios
    console.warn('Type merging not yet implemented', mergeData);
  }

  private loadVersionHistory(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.versions = new Map(data.versions);
        this.currentVersion = data.currentVersion;
      }
    } catch (error) {
      console.warn('Failed to load schema version history:', error);
    }
  }

  private async saveVersionHistory(): Promise<void> {
    try {
      const data = {
        versions: Array.from(this.versions.entries()),
        currentVersion: this.currentVersion,
        lastUpdated: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save schema version history:', error);
    }
  }
}

/**
 * Global schema evolution instance
 */
export const schemaEvolution = new SchemaEvolution();