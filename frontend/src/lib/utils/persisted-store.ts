import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { debugReactive } from './debug';

/**
 * Configuration options for persisted stores
 */
export interface PersistedStoreOptions<T> {
  /** Key to use in localStorage */
  key: string;
  /** Initial/default value */
  initialValue: T;
  /** Whether to sync changes across tabs (default: true) */
  syncAcrossTabs?: boolean;
  /** Custom serializer (default: JSON) */
  serializer?: {
    stringify: (value: T) => string;
    parse: (value: string) => T;
  };
  /** Validation function to check if loaded data is valid */
  validator?: (value: unknown) => value is T;
  /** Migration function for handling schema changes */
  migrate?: (oldValue: unknown, version: number) => T;
  /** Current schema version for migrations */
  version?: number;
}

/**
 * Enhanced persisted store that handles localStorage with SSR safety,
 * cross-tab synchronization, and data validation
 */
export function createPersistedStore<T>(options: PersistedStoreOptions<T>): Writable<T> {
  const {
    key,
    initialValue,
    syncAcrossTabs = true,
    serializer = JSON,
    validator,
    migrate,
    version = 1
  } = options;

  // Create the internal store
  const store = writable<T>(initialValue);

  // Only run localStorage logic in browser
  if (browser) {
    try {
      // Load initial value from localStorage
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        try {
          const parsed = serializer.parse(stored);
          
          // Handle versioned data with migration
          let finalValue: T;
          if (migrate && typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
            const storedVersion = (parsed as any).version || 1;
            if (storedVersion < version) {
              debugReactive(`Migrating ${key} from version ${storedVersion} to ${version}`);
              finalValue = migrate((parsed as any).data, storedVersion);
            } else {
              finalValue = (parsed as any).data;
            }
          } else {
            finalValue = parsed as T;
          }
          
          // Validate the loaded data
          if (validator && !validator(finalValue)) {
            debugReactive('Invalid data in localStorage for key %s, using initial value', key);
            finalValue = initialValue;
          }
          
          store.set(finalValue);
          debugReactive(`Loaded persisted data for ${key}`, finalValue);
        } catch (error) {
          debugReactive(`Failed to parse stored data for ${key}`, { error });
          // Fall back to initial value on parse error
        }
      }
    } catch (error) {
      debugReactive(`Failed to access localStorage for ${key}`, { error });
    }

    // Subscribe to store changes and persist them
    store.subscribe(value => {
      try {
        const dataToStore = migrate 
          ? { data: value, version }
          : value;
        
        const serialized = serializer.stringify(dataToStore as T);
        localStorage.setItem(key, serialized);
        debugReactive(`Persisted data for ${key}`, value);
      } catch (error) {
        debugReactive(`Failed to persist data for ${key}`, { error });
      }
    });

    // Listen for storage events to sync across tabs
    if (syncAcrossTabs) {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === key && event.newValue !== null) {
          try {
            const parsed = serializer.parse(event.newValue);
            
            let finalValue: T;
            if (migrate && typeof parsed === 'object' && parsed !== null && 'version' in parsed) {
              finalValue = (parsed as any).data;
            } else {
              finalValue = parsed as T;
            }
            
            if (!validator || validator(finalValue)) {
              store.set(finalValue);
              debugReactive(`Synced data across tabs for ${key}`, finalValue);
            }
          } catch (error) {
            debugReactive(`Failed to sync data across tabs for ${key}`, { error });
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);
      
      // Return cleanup function (though Svelte stores don't typically use this)
      return {
        ...store,
        destroy: () => window.removeEventListener('storage', handleStorageChange)
      } as Writable<T>;
    }
  }

  return store;
}

/**
 * Predefined persisted stores for common application data
 */

// User preferences store
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  sidebarCollapsed: boolean;
  defaultJobsPerPage: number;
  notificationsEnabled: boolean;
  debugEnabled: boolean;
}

export const userPreferences = createPersistedStore<UserPreferences>({
  key: 'bos:user-preferences',
  initialValue: {
    theme: 'auto',
    sidebarCollapsed: false,
    defaultJobsPerPage: 25,
    notificationsEnabled: true,
    debugEnabled: false
  },
  validator: (value): value is UserPreferences => {
    return typeof value === 'object' && value !== null &&
           typeof (value as any).theme === 'string' &&
           typeof (value as any).sidebarCollapsed === 'boolean' &&
           typeof (value as any).defaultJobsPerPage === 'number';
  },
  version: 1
});

// Recently viewed items store
export interface RecentItem {
  id: string;
  type: 'job' | 'client' | 'technician';
  name: string;
  lastViewed: number;
}

export const recentItems = createPersistedStore<RecentItem[]>({
  key: 'bos:recent-items',
  initialValue: [],
  validator: (value): value is RecentItem[] => {
    return Array.isArray(value) && value.every(item =>
      typeof item === 'object' && item !== null &&
      typeof item.id === 'string' &&
      typeof item.type === 'string' &&
      typeof item.name === 'string' &&
      typeof item.lastViewed === 'number'
    );
  },
  version: 1
});

// Draft data store for forms
export interface DraftData {
  [formId: string]: {
    data: any;
    lastSaved: number;
    expiresAt?: number;
  };
}

export const draftData = createPersistedStore<DraftData>({
  key: 'bos:draft-data',
  initialValue: {},
  validator: (value): value is DraftData => {
    return typeof value === 'object' && value !== null;
  },
  version: 1
});

// Last selected technicians per job (for convenience)
export interface TechnicianSelections {
  [jobId: string]: {
    technicianIds: string[];
    lastUpdated: number;
  };
}

export const technicianSelections = createPersistedStore<TechnicianSelections>({
  key: 'bos:technician-selections',
  initialValue: {},
  validator: (value): value is TechnicianSelections => {
    return typeof value === 'object' && value !== null;
  },
  version: 1
});

// UI state that should persist across sessions
export interface UIState {
  lastActiveTab?: string;
  lastJobFilter?: {
    status?: string;
    client_id?: string;
    technician_id?: string;
  };
  expandedSections: Record<string, boolean>;
}

export const uiState = createPersistedStore<UIState>({
  key: 'bos:ui-state',
  initialValue: {
    expandedSections: {}
  },
  validator: (value): value is UIState => {
    return typeof value === 'object' && value !== null &&
           typeof (value as any).expandedSections === 'object';
  },
  version: 1
});

/**
 * Helper functions for managing persisted data
 */

// Add item to recent items with automatic cleanup
export function addRecentItem(item: Omit<RecentItem, 'lastViewed'>) {
  recentItems.update(items => {
    const now = Date.now();
    const maxItems = 20;
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    // Remove old entries and duplicates
    const filtered = items.filter(i => 
      i.id !== item.id && 
      (now - i.lastViewed) < maxAge
    );
    
    // Add new item at the front
    const updated = [{ ...item, lastViewed: now }, ...filtered];
    
    // Keep only the most recent items
    return updated.slice(0, maxItems);
  });
}

// Save draft data with expiration
export function saveDraftData(formId: string, data: any, expirationHours: number = 24) {
  const now = Date.now();
  const expiresAt = now + (expirationHours * 60 * 60 * 1000);
  
  draftData.update(drafts => ({
    ...drafts,
    [formId]: {
      data,
      lastSaved: now,
      expiresAt
    }
  }));
}

// Get valid draft data (not expired)
export function getDraftData(formId: string): any | null {
  let result: any = null;
  
  draftData.subscribe(drafts => {
    const draft = drafts[formId];
    if (draft && (!draft.expiresAt || Date.now() < draft.expiresAt)) {
      result = draft.data;
    }
  })();
  
  return result;
}

// Clean up expired draft data
export function cleanupExpiredDrafts() {
  const now = Date.now();
  
  draftData.update(drafts => {
    const cleaned: DraftData = {};
    
    Object.entries(drafts).forEach(([formId, draft]) => {
      if (!draft.expiresAt || draft.expiresAt > now) {
        cleaned[formId] = draft;
      }
    });
    
    return cleaned;
  });
}

// Initialize cleanup on app start (call this in your main app file)
export function initializePersistedStores() {
  if (browser) {
    // Clean up expired drafts on startup
    cleanupExpiredDrafts();
    
    // Set up periodic cleanup (every hour)
    setInterval(cleanupExpiredDrafts, 60 * 60 * 1000);
    
    debugReactive('Persisted stores initialized');
  }
}