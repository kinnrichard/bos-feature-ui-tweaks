export interface MutatorContext {
  tx?: any; // Zero.js transaction
  user?: { id: string; [key: string]: any };
  offline?: boolean;
  action?: 'create' | 'update' | 'destroy';
  
  // Activity logging support
  skipActivityLogging?: boolean;
  environment?: string;
  customAction?: string;
  metadata?: Record<string, any>;
  changes?: Record<string, [any, any]>; // [oldValue, newValue] for each changed field
  
  // Pending activity log data for batch creation
  pendingActivityLog?: {
    user_id: string;
    action: string;
    loggable_type: string;
    loggable_id: string;
    metadata: any;
    client_id: string | null;
    job_id: string | null;
  };
  
  [key: string]: any;
}

export abstract class BaseMutator<T = any> {
  mutate(_data: T, _context?: MutatorContext): T | Promise<T> {
    throw new Error('Must be implemented by subclass');
  }
}

export type MutatorFunction<T = any> = (
  data: T,
  context?: MutatorContext
) => T | Promise<T>;