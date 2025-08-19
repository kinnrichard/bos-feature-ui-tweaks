require "test_helper"

class ClientFrontConversationTest < ActiveSupport::TestCase
  test "enforces uniqueness of client and conversation pair" do
    client = create(:client)
    conversation = create(:front_conversation)

    create(:client_front_conversation, client: client, front_conversation: conversation)

    duplicate = build(:client_front_conversation, client: client, front_conversation: conversation)
    assert_not duplicate.valid?
    assert_includes duplicate.errors[:client_id], "has already been taken"
  end

  test "allows same client in different conversations" do
    client = create(:client)
    conv1 = create(:front_conversation)
    conv2 = create(:front_conversation)

    cfc1 = create(:client_front_conversation, client: client, front_conversation: conv1)
    cfc2 = build(:client_front_conversation, client: client, front_conversation: conv2)

    assert cfc2.valid?
  end

  test "allows different clients in same conversation" do
    client1 = create(:client)
    client2 = create(:client)
    conversation = create(:front_conversation)

    cfc1 = create(:client_front_conversation, client: client1, front_conversation: conversation)
    cfc2 = build(:client_front_conversation, client: client2, front_conversation: conversation)

    assert cfc2.valid?
  end

  test "requires client" do
    cfc = build(:client_front_conversation, client: nil)
    assert_not cfc.valid?
    assert_includes cfc.errors[:client], "must exist"
  end

  test "requires front_conversation" do
    cfc = build(:client_front_conversation, front_conversation: nil)
    assert_not cfc.valid?
    assert_includes cfc.errors[:front_conversation], "must exist"
  end

  test "cascades deletion when client is destroyed" do
    client = create(:client)
    conversation = create(:front_conversation)
    cfc = create(:client_front_conversation, client: client, front_conversation: conversation)

    assert_difference "ClientFrontConversation.count", -1 do
      client.destroy
    end
  end

  test "cascades deletion when front_conversation is destroyed" do
    client = create(:client)
    conversation = create(:front_conversation)
    cfc = create(:client_front_conversation, client: client, front_conversation: conversation)

    assert_difference "ClientFrontConversation.count", -1 do
      conversation.destroy
    end
  end
end
