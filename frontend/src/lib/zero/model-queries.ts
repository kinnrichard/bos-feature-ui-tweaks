/**
 * Surgical .includes() Implementation for Epic-008
 * 
 * Provides Rails-like .includes() functionality without new classes or factories.
 * Simple chainable functions that work with existing ReactiveQuery system.
 * 
 * Usage:
 *   queryJobs().includes('client').orderBy('created_at', 'desc')
 *   queryJobs().includes('client', 'tasks', 'jobAssignments').where('id', jobId).one()
 */

import { getZero } from './zero-client';
import { debugDatabase, debugReactive } from '$lib/utils/debug';

/**
 * Creates a chainable query object with includes() support
 * Returns an object that forwards all Zero.js methods after applying relationships
 * 
 * Key insight: Always return chainable objects, even when baseQuery is null.
 * This prevents "null is not an object" errors during Zero.js initialization.
 */
function createQueryChain(tableName: string, baseQuery: any) {
  // Store the relationships and other operations to apply later
  let storedRelationships: string[] = [];
  let storedOperations: Array<{method: string, args: any[]}> = [];
  
  /**
   * Apply all stored operations to a query
   */
  function executeStoredOperations(query: any) {
    if (!query) return null;
    
    // First apply relationships
    storedRelationships.forEach(rel => {
      query = query?.related(rel);
    });
    
    // Then apply other operations in order
    storedOperations.forEach(op => {
      if (query && typeof query[op.method] === 'function') {
        query = query[op.method](...op.args);
      }
    });
    
    return query;
  }
  
  const chainProxy = {
    /**
     * Include related records using Zero.js .related() syntax
     * Can chain multiple relationships: .includes('client', 'assignments')
     */
    includes(...relationships: string[]) {
      storedRelationships = [...storedRelationships, ...relationships];
      return chainProxy;
    },
    
    /**
     * Add orderBy operation to the chain
     * Always returns chainable object for continued chaining
     */
    orderBy(...args: any[]) {
      storedOperations.push({method: 'orderBy', args});
      return chainProxy;
    },
    
    /**
     * Add where operation to the chain
     * Always returns chainable object for continued chaining
     */
    where(...args: any[]) {
      storedOperations.push({method: 'where', args});
      return chainProxy;
    },
    
    /**
     * Add limit operation to the chain
     */
    limit(...args: any[]) {
      storedOperations.push({method: 'limit', args});
      return chainProxy;
    },
    
    /**
     * Terminal operation: Execute chain and return single result
     */
    one() {
      if (!baseQuery) {
        debugDatabase('queryJobs().one(): baseQuery not ready, returning null');
        return null;
      }
      
      const finalQuery = executeStoredOperations(baseQuery);
      debugReactive('queryJobs().one(): executing with relationships', { relationships: storedRelationships });
      return finalQuery?.one();
    },
    
    /**
     * Terminal operation: Execute chain and return collection query
     */
    all() {
      if (!baseQuery) {
        debugDatabase('queryJobs().all(): baseQuery not ready, returning null');
        return null;
      }
      
      const finalQuery = executeStoredOperations(baseQuery);
      debugReactive('queryJobs().all(): executing with relationships', { relationships: storedRelationships });
      return finalQuery;
    },
    
    /**
     * For ReactiveQuery compatibility - return the final query
     */
    materialize(...args: any[]) {
      if (!baseQuery) {
        debugDatabase('queryJobs().materialize(): baseQuery not ready, returning null');
        return null;
      }
      
      const finalQuery = executeStoredOperations(baseQuery);
      debugReactive('queryJobs().materialize(): executing with relationships', { relationships: storedRelationships });
      return finalQuery?.materialize(...args);
    }
  };
  
  return chainProxy;
}

/**
 * Jobs query builder with includes() support
 * Usage: queryJobs().includes('client').orderBy('created_at', 'desc')
 */
export function queryJobs() {
  const zero = getZero();
  const baseQuery = zero?.query.jobs;
  return createQueryChain('jobs', baseQuery);
}

/**
 * Clients query builder with includes() support  
 * Usage: queryClients().includes('jobs').all()
 */
export function queryClients() {
  const zero = getZero();
  const baseQuery = zero?.query.clients;
  return createQueryChain('clients', baseQuery);
}

/**
 * Tasks query builder with includes() support
 * Usage: queryTasks().includes('job').where('status', 1).all()
 */
export function queryTasks() {
  const zero = getZero();
  const baseQuery = zero?.query.tasks;
  return createQueryChain('tasks', baseQuery);
}

/**
 * Users query builder with includes() support
 * Usage: queryUsers().includes('jobAssignments').all()
 */
export function queryUsers() {
  const zero = getZero();
  const baseQuery = zero?.query.users;
  return createQueryChain('users', baseQuery);
}