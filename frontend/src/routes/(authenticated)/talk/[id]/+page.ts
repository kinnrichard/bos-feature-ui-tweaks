import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { ReactiveFrontConversation } from '$lib/models/reactive-front-conversation';
import { ReactiveFrontMessage } from '$lib/models/reactive-front-message';

export const load: PageLoad = async ({ params }) => {
  const { id } = params;

  // Validate conversation ID
  if (!id) {
    throw error(400, 'Conversation ID is required');
  }

  // Create reactive query for the conversation
  const conversationQuery = ReactiveFrontConversation.find(id);

  // Create reactive query for messages in this conversation
  // Order by created_at_timestamp ascending for chronological order
  const messagesQuery = ReactiveFrontMessage.where({ front_conversation_id: id })
    .orderBy('created_at_timestamp', 'asc')
    .all();

  return {
    conversationId: id,
    conversationQuery,
    messagesQuery,
  };
};
