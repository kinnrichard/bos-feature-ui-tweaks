require "test_helper"

class PersonTest < ActiveSupport::TestCase
  test "has front_conversations association" do
    person = Person.new
    assert_respond_to person, :people_front_conversations
    assert_respond_to person, :front_conversations
  end

  test "can access front_conversations through join table" do
    person = create(:person)
    conversation1 = create(:front_conversation)
    conversation2 = create(:front_conversation)

    create(:person_front_conversation, person: person, front_conversation: conversation1)
    create(:person_front_conversation, person: person, front_conversation: conversation2)

    assert_equal 2, person.front_conversations.count
    assert_includes person.front_conversations, conversation1
    assert_includes person.front_conversations, conversation2
  end

  test "destroys join table records when person is destroyed" do
    person = create(:person)
    conversation = create(:front_conversation)

    create(:person_front_conversation, person: person, front_conversation: conversation)

    assert_difference "PersonFrontConversation.count", -1 do
      person.destroy
    end
  end
end
