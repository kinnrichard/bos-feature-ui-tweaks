/**
 * Sync Manager for Polymorphic Configuration
 * 
 * Handles synchronization of polymorphic configurations between client and server,
 * manages conflicts, and implements merge strategies for distributed updates.
 */

import type { PolymorphicConfig, PolymorphicAssociation } from './types';
import { polymorphicPersistence } from './persistence';
import { schemaEvolution } from './schema-evolution';

export interface SyncStatus {
  lastSync: number;
  localVersion: string;
  remoteVersion: string | null;
  hasPendingChanges: boolean;
  conflictCount: number;
  syncState: 'synced' | 'pending' | 'conflict' | 'error' | 'offline';
}

export interface SyncConflict {
  id: string;
  type: 'association_modified' | 'association_added' | 'association_removed' | 'config_diverged';
  local: any;
  remote: any;
  timestamp: number;
  resolved: boolean;
}

export interface MergeStrategy {
  associationConflicts: 'local_wins' | 'remote_wins' | 'merge' | 'manual';
  typeConflicts: 'local_wins' | 'remote_wins' | 'merge' | 'manual';
  autoResolve: boolean;
  preserveLocalTypes: boolean;
}

export interface SyncOptions {
  strategy: MergeStrategy;
  forceSync: boolean;
  createBackup: boolean;
  notifyConflicts: boolean;
}

export class PolymorphicSyncManager {
  private syncEndpoint: string | null = null;
  private apiKey: string | null = null;
  private conflictHandlers: Map<string, (conflict: SyncConflict) => Promise<any>> = new Map();
  private syncListeners: Set<(status: SyncStatus) => void> = new Set();
  
  private currentStatus: SyncStatus = {
    lastSync: 0,
    localVersion: '',
    remoteVersion: null,
    hasPendingChanges: false,
    conflictCount: 0,
    syncState: 'offline'
  };

  private defaultMergeStrategy: MergeStrategy = {
    associationConflicts: 'merge',
    typeConflicts: 'merge',
    autoResolve: true,
    preserveLocalTypes: true
  };

  /**
   * Configure sync endpoint and authentication
   */
  configure(endpoint: string, apiKey?: string): void {
    this.syncEndpoint = endpoint;
    this.apiKey = apiKey;
    this.updateSyncState('offline');
  }

  /**
   * Sync local configuration with remote server
   */
  async sync(config: PolymorphicConfig, options?: Partial<SyncOptions>): Promise<{
    success: boolean;
    conflicts: SyncConflict[];
    mergedConfig?: PolymorphicConfig;
  }> {
    if (!this.syncEndpoint) {
      throw new Error('Sync endpoint not configured');
    }

    const syncOptions: SyncOptions = {
      strategy: this.defaultMergeStrategy,
      forceSync: false,
      createBackup: true,
      notifyConflicts: true,
      ...options
    };

    this.updateSyncState('pending');

    try {
      // Create backup before sync
      if (syncOptions.createBackup) {
        await polymorphicPersistence.createBackup(config, 'manual', 'Pre-sync backup');
      }

      // Get remote configuration
      const remoteConfig = await this.fetchRemoteConfig();
      
      if (!remoteConfig) {
        // No remote config, push local config
        await this.pushConfig(config);
        this.updateSyncState('synced');
        return { success: true, conflicts: [] };
      }

      // Compare configurations and detect conflicts
      const conflicts = this.detectConflicts(config, remoteConfig);
      
      if (conflicts.length === 0 || syncOptions.forceSync) {
        // No conflicts or force sync - merge and push
        const mergedConfig = await this.mergeConfigurations(
          config, 
          remoteConfig, 
          syncOptions.strategy
        );
        
        await this.pushConfig(mergedConfig);
        await polymorphicPersistence.saveConfig(mergedConfig);
        
        this.updateSyncState('synced');
        return { success: true, conflicts: [], mergedConfig };
      }

      // Handle conflicts
      if (syncOptions.strategy.autoResolve) {
        const resolvedConfig = await this.autoResolveConflicts(
          config, 
          remoteConfig, 
          conflicts, 
          syncOptions.strategy
        );
        
        await this.pushConfig(resolvedConfig);
        await polymorphicPersistence.saveConfig(resolvedConfig);
        
        this.updateSyncState('synced');
        return { success: true, conflicts: [], mergedConfig: resolvedConfig };
      }

      // Manual conflict resolution required
      this.updateSyncState('conflict');
      return { success: false, conflicts };

    } catch (error) {
      console.error('Sync failed:', error);
      this.updateSyncState('error');
      return { success: false, conflicts: [] };
    }
  }

  /**
   * Push local configuration to remote server
   */
  async pushConfig(config: PolymorphicConfig): Promise<void> {
    if (!this.syncEndpoint || !this.apiKey) {
      throw new Error('Sync not properly configured');
    }

    const response = await fetch(`${this.syncEndpoint}/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        config,
        timestamp: Date.now(),
        version: schemaEvolution.getCurrentVersion()
      })
    });

    if (!response.ok) {
      throw new Error(`Push failed: ${response.statusText}`);
    }

    this.currentStatus.lastSync = Date.now();
    this.currentStatus.hasPendingChanges = false;
  }

  /**
   * Fetch configuration from remote server
   */
  async fetchRemoteConfig(): Promise<PolymorphicConfig | null> {
    if (!this.syncEndpoint || !this.apiKey) {
      throw new Error('Sync not properly configured');
    }

    const response = await fetch(`${this.syncEndpoint}/config`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (response.status === 404) {
      return null; // No remote config exists
    }

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.config;
  }

  /**
   * Detect conflicts between local and remote configurations
   */
  detectConflicts(local: PolymorphicConfig, remote: PolymorphicConfig): SyncConflict[] {
    const conflicts: SyncConflict[] = [];
    
    // Create maps for easier comparison
    const localAssociations = new Map(local.associations.map(a => [a.id, a]));
    const remoteAssociations = new Map(remote.associations.map(a => [a.id, a]));

    // Check for modified associations
    for (const [id, localAssoc] of localAssociations) {
      const remoteAssoc = remoteAssociations.get(id);
      
      if (remoteAssoc && !this.associationsEqual(localAssoc, remoteAssoc)) {
        conflicts.push({
          id: `association_${id}`,
          type: 'association_modified',
          local: localAssoc,
          remote: remoteAssoc,
          timestamp: Date.now(),
          resolved: false
        });
      }
    }

    // Check for added/removed associations
    for (const [id, localAssoc] of localAssociations) {
      if (!remoteAssociations.has(id)) {
        conflicts.push({
          id: `association_added_${id}`,
          type: 'association_added',
          local: localAssoc,
          remote: null,
          timestamp: Date.now(),
          resolved: false
        });
      }
    }

    for (const [id, remoteAssoc] of remoteAssociations) {
      if (!localAssociations.has(id)) {
        conflicts.push({
          id: `association_removed_${id}`,
          type: 'association_removed',
          local: null,
          remote: remoteAssoc,
          timestamp: Date.now(),
          resolved: false
        });
      }
    }

    return conflicts;
  }

  /**
   * Merge two configurations using specified strategy
   */
  async mergeConfigurations(
    local: PolymorphicConfig, 
    remote: PolymorphicConfig, 
    strategy: MergeStrategy
  ): Promise<PolymorphicConfig> {
    const merged: PolymorphicConfig = {
      version: Math.max(
        parseInt(local.version.replace(/\D/g, '') || '0'), 
        parseInt(remote.version.replace(/\D/g, '') || '0')
      ).toString(),
      associations: []
    };

    const localAssociations = new Map(local.associations.map(a => [a.id, a]));
    const remoteAssociations = new Map(remote.associations.map(a => [a.id, a]));
    const processedIds = new Set<string>();

    // Merge associations
    for (const [id, localAssoc] of localAssociations) {
      const remoteAssoc = remoteAssociations.get(id);
      
      if (!remoteAssoc) {
        // Local only - keep if strategy allows
        if (strategy.associationConflicts !== 'remote_wins') {
          merged.associations.push(localAssoc);
        }
      } else {
        // Both exist - merge based on strategy
        const mergedAssoc = await this.mergeAssociation(localAssoc, remoteAssoc, strategy);
        merged.associations.push(mergedAssoc);
      }
      
      processedIds.add(id);
    }

    // Add remote-only associations
    for (const [id, remoteAssoc] of remoteAssociations) {
      if (!processedIds.has(id) && strategy.associationConflicts !== 'local_wins') {
        merged.associations.push(remoteAssoc);
      }
    }

    return merged;
  }

  /**
   * Auto-resolve conflicts based on strategy
   */
  async autoResolveConflicts(
    local: PolymorphicConfig,
    remote: PolymorphicConfig,
    conflicts: SyncConflict[],
    strategy: MergeStrategy
  ): Promise<PolymorphicConfig> {
    // For auto-resolve, we'll use the merge strategy
    return this.mergeConfigurations(local, remote, strategy);
  }

  /**
   * Register conflict handler for specific conflict types
   */
  registerConflictHandler(
    conflictType: SyncConflict['type'], 
    handler: (conflict: SyncConflict) => Promise<any>
  ): void {
    this.conflictHandlers.set(conflictType, handler);
  }

  /**
   * Resolve specific conflict manually
   */
  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge' | any): Promise<void> {
    // Implementation would depend on how conflicts are stored and managed
    // This is a placeholder for the conflict resolution logic
    console.warn(`Resolving conflict ${conflictId} with resolution:`, resolution);
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.currentStatus };
  }

  /**
   * Add sync status listener
   */
  onSyncStatusChange(listener: (status: SyncStatus) => void): void {
    this.syncListeners.add(listener);
  }

  /**
   * Remove sync status listener
   */
  offSyncStatusChange(listener: (status: SyncStatus) => void): void {
    this.syncListeners.delete(listener);
  }

  /**
   * Set merge strategy
   */
  setMergeStrategy(strategy: Partial<MergeStrategy>): void {
    this.defaultMergeStrategy = { ...this.defaultMergeStrategy, ...strategy };
  }

  /**
   * Check if remote server is available
   */
  async checkConnectivity(): Promise<boolean> {
    if (!this.syncEndpoint) return false;

    try {
      const response = await fetch(`${this.syncEndpoint}/health`, { 
        method: 'HEAD',
        timeout: 5000 
      } as any);
      
      const isConnected = response.ok;
      this.updateSyncState(isConnected ? 'synced' : 'error');
      return isConnected;
    } catch {
      this.updateSyncState('offline');
      return false;
    }
  }

  /**
   * Enable automatic sync at intervals
   */
  enableAutoSync(intervalMs: number = 5 * 60 * 1000): void {
    setInterval(async () => {
      const config = await polymorphicPersistence.loadConfig();
      if (config && this.currentStatus.hasPendingChanges) {
        await this.sync(config, { 
          strategy: this.defaultMergeStrategy,
          forceSync: false,
          createBackup: false,
          notifyConflicts: false 
        });
      }
    }, intervalMs);
  }

  private async mergeAssociation(
    local: PolymorphicAssociation,
    remote: PolymorphicAssociation,
    strategy: MergeStrategy
  ): Promise<PolymorphicAssociation> {
    const merged: PolymorphicAssociation = { ...local };

    // Merge types based on strategy
    if (strategy.typeConflicts === 'merge') {
      merged.types = { ...remote.types, ...local.types };
    } else if (strategy.typeConflicts === 'remote_wins') {
      merged.types = remote.types;
    }
    // local_wins uses the existing local types

    // Always use the most recent field mappings
    if (remote.typeField !== local.typeField || remote.idField !== local.idField) {
      if (strategy.associationConflicts === 'remote_wins') {
        merged.typeField = remote.typeField;
        merged.idField = remote.idField;
      } else if (strategy.associationConflicts === 'merge') {
        // For field conflicts, prefer the one with more types defined
        if (Object.keys(remote.types).length > Object.keys(local.types).length) {
          merged.typeField = remote.typeField;
          merged.idField = remote.idField;
        }
      }
    }

    return merged;
  }

  private associationsEqual(a: PolymorphicAssociation, b: PolymorphicAssociation): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private updateSyncState(state: SyncStatus['syncState']): void {
    this.currentStatus.syncState = state;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(this.currentStatus);
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    });
  }
}

/**
 * Global sync manager instance
 */
export const polymorphicSyncManager = new PolymorphicSyncManager();