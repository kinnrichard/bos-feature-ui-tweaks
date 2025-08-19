require "test_helper"

class ClientTest < ActiveSupport::TestCase
  test "has front_conversations association" do
    client = Client.new
    assert_respond_to client, :clients_front_conversations
    assert_respond_to client, :front_conversations
  end

  test "can access front_conversations through join table" do
    client = create(:client)
    conversation1 = create(:front_conversation)
    conversation2 = create(:front_conversation)

    create(:client_front_conversation, client: client, front_conversation: conversation1)
    create(:client_front_conversation, client: client, front_conversation: conversation2)

    assert_equal 2, client.front_conversations.count
    assert_includes client.front_conversations, conversation1
    assert_includes client.front_conversations, conversation2
  end

  test "destroys join table records when client is destroyed" do
    client = create(:client)
    conversation = create(:front_conversation)

    create(:client_front_conversation, client: client, front_conversation: conversation)

    assert_difference "ClientFrontConversation.count", -1 do
      client.destroy
    end
  end
end
