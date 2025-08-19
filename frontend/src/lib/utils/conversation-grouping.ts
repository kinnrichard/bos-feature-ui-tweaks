/**
 * Conversation grouping utilities for organizing conversations by month
 * Groups conversations chronologically by month based on waiting_since_timestamp
 */

import type { FrontConversationData } from '$lib/models/types/front-conversation-data';

/**
 * Month section for grouping conversations
 */
export interface MonthSection {
  key: string; // Format: "YYYY-MM"
  title: string; // Format: "December 2024"
  conversations: FrontConversationData[];
}

/**
 * Get month key from timestamp
 */
function getMonthKey(timestamp?: number): string {
  if (!timestamp) return 'unknown';
  const date = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Format month title for display
 */
function formatMonthTitle(monthKey: string): string {
  if (monthKey === 'unknown') return 'Unknown Date';

  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Sort conversations within a section by waiting_since_timestamp (newest first)
 */
function sortConversationsInSection(
  conversations: FrontConversationData[]
): FrontConversationData[] {
  return [...conversations].sort((a, b) => {
    const timestampA = a.waiting_since_timestamp || 0;
    const timestampB = b.waiting_since_timestamp || 0;
    return timestampB - timestampA; // Newest first
  });
}

/**
 * Group conversations by month
 */
export function groupConversationsByMonth(conversations: FrontConversationData[]): MonthSection[] {
  // Group conversations by month
  const groupedByMonth = new Map<string, FrontConversationData[]>();

  for (const conversation of conversations) {
    const monthKey = getMonthKey(conversation.waiting_since_timestamp);

    if (!groupedByMonth.has(monthKey)) {
      groupedByMonth.set(monthKey, []);
    }

    groupedByMonth.get(monthKey)!.push(conversation);
  }

  // Convert to array of sections
  const sections: MonthSection[] = [];

  for (const [monthKey, monthConversations] of groupedByMonth) {
    sections.push({
      key: monthKey,
      title: formatMonthTitle(monthKey),
      conversations: sortConversationsInSection(monthConversations),
    });
  }

  // Sort sections by month key (newest first)
  sections.sort((a, b) => {
    if (a.key === 'unknown') return 1;
    if (b.key === 'unknown') return -1;
    return b.key.localeCompare(a.key);
  });

  return sections;
}

/**
 * Check if we should use compact mode based on conversation count
 * Similar to jobs, use compact mode for 7+ conversations
 */
export function shouldUseCompactMode(conversations: FrontConversationData[]): boolean {
  return conversations.length >= 7;
}
