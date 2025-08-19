// Conversations search store - for filtering conversations on the listing page
export const conversationsSearch = $state({
  searchQuery: '' as string,
  searchFields: ['subject', 'recipient_handle'] as string[],
});

// Filter function for conversations
export function shouldShowConversation(conversation: any): boolean {
  // If no search query, show all conversations
  if (!conversationsSearch.searchQuery.trim()) {
    return true;
  }

  const query = conversationsSearch.searchQuery.toLowerCase().trim();

  // Search in conversation subject
  if (conversation.subject && conversation.subject.toLowerCase().includes(query)) {
    return true;
  }

  // Search in recipient handle
  if (
    conversation.recipient_handle &&
    conversation.recipient_handle.toLowerCase().includes(query)
  ) {
    return true;
  }

  return false;
}

// Actions for managing conversations search
export const conversationsSearchActions = {
  setSearchQuery: (query: string) => {
    conversationsSearch.searchQuery = query;
  },

  clearSearch: () => {
    conversationsSearch.searchQuery = '';
  },
};
