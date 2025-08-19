require "test_helper"

class PersonFrontConversationTest < ActiveSupport::TestCase
  test "enforces uniqueness of person and conversation pair" do
    person = create(:person)
    conversation = create(:front_conversation)

    create(:person_front_conversation, person: person, front_conversation: conversation)

    duplicate = build(:person_front_conversation, person: person, front_conversation: conversation)
    assert_not duplicate.valid?
    assert_includes duplicate.errors[:person_id], "has already been taken"
  end

  test "allows same person in different conversations" do
    person = create(:person)
    conv1 = create(:front_conversation)
    conv2 = create(:front_conversation)

    pfc1 = create(:person_front_conversation, person: person, front_conversation: conv1)
    pfc2 = build(:person_front_conversation, person: person, front_conversation: conv2)

    assert pfc2.valid?
  end

  test "allows different people in same conversation" do
    person1 = create(:person)
    person2 = create(:person)
    conversation = create(:front_conversation)

    pfc1 = create(:person_front_conversation, person: person1, front_conversation: conversation)
    pfc2 = build(:person_front_conversation, person: person2, front_conversation: conversation)

    assert pfc2.valid?
  end

  test "requires person" do
    pfc = build(:person_front_conversation, person: nil)
    assert_not pfc.valid?
    assert_includes pfc.errors[:person], "must exist"
  end

  test "requires front_conversation" do
    pfc = build(:person_front_conversation, front_conversation: nil)
    assert_not pfc.valid?
    assert_includes pfc.errors[:front_conversation], "must exist"
  end

  test "cascades deletion when person is destroyed" do
    person = create(:person)
    conversation = create(:front_conversation)
    pfc = create(:person_front_conversation, person: person, front_conversation: conversation)

    assert_difference "PersonFrontConversation.count", -1 do
      person.destroy
    end
  end

  test "cascades deletion when front_conversation is destroyed" do
    person = create(:person)
    conversation = create(:front_conversation)
    pfc = create(:person_front_conversation, person: person, front_conversation: conversation)

    assert_difference "PersonFrontConversation.count", -1 do
      conversation.destroy
    end
  end
end
