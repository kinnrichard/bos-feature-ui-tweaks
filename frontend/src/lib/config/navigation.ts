export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  type: 'navigation' | 'client' | 'footer';
  isExternal?: boolean;
}

// Global navigation items (shown when no client is selected)
export const globalNavItems: NavItem[] = [
  {
    id: 'clients',
    label: 'Clients',
    href: '/clients',
    icon: '🏢',
    type: 'navigation',
  },
  {
    id: 'all-jobs',
    label: 'All Jobs',
    href: '/jobs',
    icon: '💼',
    type: 'navigation',
  },
  {
    id: 'conversations',
    label: 'Talk',
    href: '/talk',
    icon: '💬',
    type: 'navigation',
  },
];

// Client-specific navigation items (shown when a client is selected)
export const clientNavItems: NavItem[] = [
  {
    id: 'people',
    label: 'People',
    href: '/clients/{id}/people',
    icon: '👥',
    type: 'navigation',
  },
  {
    id: 'jobs',
    label: 'Jobs',
    href: '/clients/{id}/jobs',
    icon: '💼',
    type: 'navigation',
  },
  {
    id: 'conversations',
    label: 'Talk',
    href: '/clients/{id}/talk',
    icon: '💬',
    type: 'navigation',
  },
];

// Legacy - kept for backward compatibility during transition
export const mainNavItems = globalNavItems;

// Footer navigation items
export const footerNavItems: NavItem[] = [
  {
    id: 'logs',
    label: "Vital Planet's Logs",
    href: '/logs',
    icon: '📜',
    type: 'footer',
  },
];

// Get active navigation item based on current route
export function getActiveNavItem(currentPath: string): string | null {
  // Check global nav items
  const globalMatch = globalNavItems.find((item) => item.href === currentPath);
  if (globalMatch) return globalMatch.id;

  // Check footer items
  const footerMatch = footerNavItems.find((item) => item.href === currentPath);
  if (footerMatch) return footerMatch.id;

  // Handle route-based matches
  if (currentPath === '/clients') return 'clients';
  if (currentPath.startsWith('/jobs') && !currentPath.includes('/clients/')) return 'all-jobs';
  if (currentPath.startsWith('/talk') && !currentPath.includes('/clients/')) return 'conversations';

  // Client-specific routes
  if (currentPath.includes('/people')) return 'people';
  if (currentPath.includes('/clients/') && currentPath.includes('/jobs')) return 'jobs';
  if (currentPath.includes('/clients/') && currentPath.includes('/talk')) return 'conversations';

  // Handle logs routes - both /logs and /clients/[id]/logs
  if (currentPath === '/logs' || currentPath.includes('/logs')) return 'logs';

  return null;
}

// Brand/Logo configuration
export const brandConfig = {
  name: 'FAULTLESS',
  logoIcon: '⚡', // Lightning bolt matching the image
  homeHref: '/',
};
