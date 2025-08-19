// Zero Context for Svelte 5
// Makes Zero functions available throughout the app via context API

import { getContext, setContext } from 'svelte';
import type { ZeroClient } from './zero';
import { 
  getZero, 
  initZero, 
  getZeroState
} from './zero';

// Epic-008: Import models from Epic-008 architecture
import { User } from '$lib/models/user';
import { Task } from '$lib/models/task';
import { Job } from '$lib/models/job';
import { Client } from '$lib/models/client';

const ZERO_CONTEXT_KEY = Symbol('zero');

export interface ZeroContext {
  // Client functions
  getZero: typeof getZero;
  initZero: typeof initZero;
  getZeroState: typeof getZeroState;
  
  // Epic-008 ActiveRecord-style queries (available models)
  User: typeof User;
  Task: typeof Task;
  Job: typeof Job;
  Client: typeof Client;
  
  // Note: CRUD mutations are now handled by Epic-008 models directly
  // Use: User.create(), User.update(), Task.create(), etc.
}

export function createZeroContext(): ZeroContext {
  const context: ZeroContext = {
    // Client functions
    getZero,
    initZero,
    getZeroState,
    
    // Epic-008 ActiveRecord-style queries
    User,
    Task,
    Job,
    Client,
  };
  
  return setContext(ZERO_CONTEXT_KEY, context);
}

export function getZeroContext(): ZeroContext {
  const context = getContext<ZeroContext>(ZERO_CONTEXT_KEY);
  if (!context) {
    throw new Error('Zero context not found. Make sure createZeroContext() is called in a parent component.');
  }
  return context;
}