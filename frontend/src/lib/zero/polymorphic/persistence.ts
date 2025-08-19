/**
 * Persistence Layer for Polymorphic Configuration
 * 
 * Handles localStorage-based persistence, backup/restore, and configuration sharing
 * for polymorphic type tracking in browser environments.
 */

import type { PolymorphicConfig } from './types';

export interface PersistenceConfig {
  autoBackup: boolean;
  backupInterval: number; // milliseconds
  maxBackups: number;
  compressionEnabled: boolean;
}

export interface ConfigBackup {
  id: string;
  timestamp: number;
  config: PolymorphicConfig;
  metadata: {
    version: string;
    source: 'auto' | 'manual' | 'import';
    description?: string;
  };
}

export interface ExportData {
  version: string;
  timestamp: number;
  config: PolymorphicConfig;
  metadata: {
    exportedBy: string;
    description?: string;
    tags?: string[];
  };
}

export class PolymorphicPersistence {
  private configKey = 'zero_polymorphic_config';
  private backupKey = 'zero_polymorphic_backups';
  private settingsKey = 'zero_polymorphic_persistence_settings';
  private autoBackupTimer: number | null = null;

  private settings: PersistenceConfig = {
    autoBackup: true,
    backupInterval: 5 * 60 * 1000, // 5 minutes
    maxBackups: 20,
    compressionEnabled: true
  };

  constructor() {
    this.loadSettings();
    this.startAutoBackup();
  }

  /**
   * Save polymorphic configuration to localStorage
   */
  async saveConfig(config: PolymorphicConfig): Promise<void> {
    try {
      const serialized = this.settings.compressionEnabled 
        ? this.compress(JSON.stringify(config))
        : JSON.stringify(config);

      localStorage.setItem(this.configKey, serialized);

      // Auto-backup if enabled
      if (this.settings.autoBackup) {
        await this.createBackup(config, 'auto');
      }
    } catch (error) {
      console.error('Failed to save polymorphic config:', error);
      throw new Error('Configuration save failed');
    }
  }

  /**
   * Load polymorphic configuration from localStorage
   */
  async loadConfig(): Promise<PolymorphicConfig | null> {
    try {
      const stored = localStorage.getItem(this.configKey);
      if (!stored) {
        return null;
      }

      const data = this.settings.compressionEnabled 
        ? this.decompress(stored)
        : stored;

      return JSON.parse(data) as PolymorphicConfig;
    } catch (error) {
      console.error('Failed to load polymorphic config:', error);
      
      // Try to restore from backup
      const backup = await this.getLatestBackup();
      if (backup) {
        console.warn('Restoring from latest backup due to corrupted config');
        return backup.config;
      }
      
      return null;
    }
  }

  /**
   * Create a manual backup of the configuration
   */
  async createBackup(config: PolymorphicConfig, source: 'auto' | 'manual' | 'import', description?: string): Promise<string> {
    const backupId = this.generateBackupId();
    const backup: ConfigBackup = {
      id: backupId,
      timestamp: Date.now(),
      config: JSON.parse(JSON.stringify(config)), // Deep clone
      metadata: {
        version: '1.0',
        source,
        description
      }
    };

    const backups = await this.loadBackups();
    backups.push(backup);

    // Clean up old backups
    if (backups.length > this.settings.maxBackups) {
      backups.sort((a, b) => b.timestamp - a.timestamp);
      backups.splice(this.settings.maxBackups);
    }

    await this.saveBackups(backups);
    return backupId;
  }

  /**
   * Restore configuration from backup
   */
  async restoreFromBackup(backupId: string): Promise<PolymorphicConfig | null> {
    const backups = await this.loadBackups();
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) {
      return null;
    }

    // Save the restored config
    await this.saveConfig(backup.config);
    return backup.config;
  }

  /**
   * Get all available backups
   */
  async getBackups(): Promise<ConfigBackup[]> {
    const backups = await this.loadBackups();
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get the latest backup
   */
  async getLatestBackup(): Promise<ConfigBackup | null> {
    const backups = await this.getBackups();
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    const backups = await this.loadBackups();
    const initialLength = backups.length;
    const filteredBackups = backups.filter(b => b.id !== backupId);
    
    if (filteredBackups.length < initialLength) {
      await this.saveBackups(filteredBackups);
      return true;
    }
    
    return false;
  }

  /**
   * Export configuration with metadata
   */
  async exportConfig(config: PolymorphicConfig, description?: string, tags?: string[]): Promise<ExportData> {
    return {
      version: '1.0',
      timestamp: Date.now(),
      config: JSON.parse(JSON.stringify(config)), // Deep clone
      metadata: {
        exportedBy: 'zero-polymorphic-persistence',
        description,
        tags
      }
    };
  }

  /**
   * Import configuration from export data
   */
  async importConfig(exportData: ExportData): Promise<PolymorphicConfig> {
    // Validate export data
    if (!exportData.config || !exportData.version) {
      throw new Error('Invalid export data format');
    }

    // Create backup of current config before import
    const currentConfig = await this.loadConfig();
    if (currentConfig) {
      await this.createBackup(currentConfig, 'manual', 'Pre-import backup');
    }

    // Import and save new config
    const importedConfig = exportData.config;
    await this.saveConfig(importedConfig);
    
    // Create backup of imported config
    await this.createBackup(
      importedConfig, 
      'import', 
      `Imported: ${exportData.metadata.description || 'Unknown'}`
    );

    return importedConfig;
  }

  /**
   * Export configuration as downloadable JSON file
   */
  async downloadConfig(config: PolymorphicConfig, filename?: string): Promise<void> {
    const exportData = await this.exportConfig(config);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `polymorphic-config-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all stored data
   */
  async clearAll(): Promise<void> {
    localStorage.removeItem(this.configKey);
    localStorage.removeItem(this.backupKey);
    
    // Keep settings unless explicitly requested
    console.warn('Cleared all polymorphic configuration data');
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats(): {
    configSize: number;
    backupsSize: number;
    totalSize: number;
    backupCount: number;
  } {
    const configData = localStorage.getItem(this.configKey) || '';
    const backupsData = localStorage.getItem(this.backupKey) || '';
    
    return {
      configSize: new Blob([configData]).size,
      backupsSize: new Blob([backupsData]).size,
      totalSize: new Blob([configData, backupsData]).size,
      backupCount: this.getBackupCount()
    };
  }

  /**
   * Update persistence settings
   */
  updateSettings(newSettings: Partial<PersistenceConfig>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    
    // Restart auto-backup with new settings
    this.stopAutoBackup();
    this.startAutoBackup();
  }

  /**
   * Get current persistence settings
   */
  getSettings(): PersistenceConfig {
    return { ...this.settings };
  }

  private generateBackupId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadBackups(): Promise<ConfigBackup[]> {
    try {
      const stored = localStorage.getItem(this.backupKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load backups:', error);
      return [];
    }
  }

  private async saveBackups(backups: ConfigBackup[]): Promise<void> {
    try {
      localStorage.setItem(this.backupKey, JSON.stringify(backups));
    } catch (error) {
      console.error('Failed to save backups:', error);
      throw new Error('Backup save failed');
    }
  }

  private getBackupCount(): number {
    try {
      const stored = localStorage.getItem(this.backupKey);
      const backups = stored ? JSON.parse(stored) : [];
      return Array.isArray(backups) ? backups.length : 0;
    } catch {
      return 0;
    }
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(this.settingsKey);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load persistence settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(this.settingsKey, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save persistence settings:', error);
    }
  }

  private startAutoBackup(): void {
    if (!this.settings.autoBackup) return;
    
    this.autoBackupTimer = window.setInterval(async () => {
      const config = await this.loadConfig();
      if (config) {
        await this.createBackup(config, 'auto', 'Scheduled auto-backup');
      }
    }, this.settings.backupInterval);
  }

  private stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }
  }

  private compress(data: string): string {
    // Simple compression - in production, consider using a proper compression library
    try {
      return btoa(data);
    } catch {
      return data; // Fallback to uncompressed
    }
  }

  private decompress(data: string): string {
    try {
      return atob(data);
    } catch {
      return data; // Assume uncompressed
    }
  }
}

/**
 * Global persistence instance
 */
export const polymorphicPersistence = new PolymorphicPersistence();