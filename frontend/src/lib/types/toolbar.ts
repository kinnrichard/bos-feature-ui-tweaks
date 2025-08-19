/**
 * Type definitions for toolbar components
 */

export type SearchContext = 'jobs' | 'client-jobs' | 'clients' | 'tasks' | 'people' | null;
export type PageType = 'home' | 'job-detail' | 'jobs' | 'clients' | 'people' | 'devices';
export type IconType = 'svg' | 'emoji';

export interface PageAction {
  label: string;
  icon: string;
  iconType: IconType;
  action: () => void;
  testId?: string;
}

export interface SearchConfig {
  context: SearchContext;
  placeholder: string;
  searchQuery: string;
  setQuery: (value: string) => void;
  clearQuery: () => void;
}

export const ROUTE_PATTERNS = {
  jobDetail: '/(authenticated)/jobs/[id]',
  jobs: '/jobs',
  clientJobs: '/(authenticated)/clients/[id]/jobs',
  clients: '/(authenticated)/clients',
  clientPeople: '/(authenticated)/clients/[id]/people',
  people: '/people',
  devices: '/devices',
} as const;

export const SEARCH_PLACEHOLDERS: Record<NonNullable<SearchContext>, string> = {
  jobs: 'Search jobs',
  'client-jobs': 'Search client jobs',
  clients: 'Search clients',
  tasks: 'Search tasks',
  people: 'Search people by name or title...',
} as const;
