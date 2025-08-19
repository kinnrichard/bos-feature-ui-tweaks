// Jobs search store - for filtering jobs on the listing page
export const jobsSearch = $state({
  searchQuery: '' as string,
  searchFields: ['title', 'client.name'] as string[]
});

// Filter function for jobs
export function shouldShowJob(job: any): boolean {
  // If no search query, show all jobs
  if (!jobsSearch.searchQuery.trim()) {
    return true;
  }
  
  const query = jobsSearch.searchQuery.toLowerCase().trim();
  
  // Search in job title
  if (job.title && job.title.toLowerCase().includes(query)) {
    return true;
  }
  
  // Search in client name (if client is loaded)
  if (job.client && job.client.name && job.client.name.toLowerCase().includes(query)) {
    return true;
  }
  
  return false;
}

// Actions for managing jobs search
export const jobsSearchActions = {
  setSearchQuery: (query: string) => {
    jobsSearch.searchQuery = query;
  },
  
  clearSearch: () => {
    jobsSearch.searchQuery = '';
  }
};