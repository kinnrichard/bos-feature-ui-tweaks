require "test_helper"

class UserSerializerTest < ActiveSupport::TestCase
  setup do
    @user = users(:technician)
  end

  test "serializes user attributes" do
    serialized = UserSerializer.new(@user).serializable_hash
    data = serialized[:data]

    assert_equal :users, data[:type]
    assert_equal @user.id.to_s, data[:id]
    assert_equal @user.name, data[:attributes][:name]
    assert_equal @user.email, data[:attributes][:email]
    assert_equal @user.role, data[:attributes][:role]
    assert data[:attributes][:createdAt].present?
    assert data[:attributes][:updatedAt].present?
  end

  test "includes computed attributes" do
    serialized = UserSerializer.new(@user).serializable_hash
    attrs = serialized[:data][:attributes]

    assert attrs[:initials].present?
    assert attrs[:displayName].present?
    assert attrs[:avatarColor].present?
  end

  test "uses camelCase for attribute keys" do
    serialized = UserSerializer.new(@user).serializable_hash
    attrs = serialized[:data][:attributes]

    assert attrs.key?(:createdAt)
    assert attrs.key?(:displayName)
    assert attrs.key?(:avatarColor)
    assert attrs.key?(:resortTasksOnStatusChange)

    # Should not have snake_case keys
    assert_not attrs.key?(:created_at)
    assert_not attrs.key?(:display_name)
  end

  test "conditionally includes relationships" do
    # Without params, relationships should be empty
    serialized = UserSerializer.new(@user).serializable_hash
    assert serialized[:data][:relationships].empty? || serialized[:data][:relationships].nil?

    # With params, relationships should be included
    serialized = UserSerializer.new(@user, params: { include_jobs: true, include_tasks: true }).serializable_hash
    assert serialized[:data][:relationships][:technicianJobs].present?
    assert serialized[:data][:relationships][:assignedTasks].present?
  end
end
