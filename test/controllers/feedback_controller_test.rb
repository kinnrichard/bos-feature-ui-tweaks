require "test_helper"
require "mocha/minitest"

class FeedbackControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:owner)
    sign_in_as(@user)
  end

  test "should get new with bug type" do
    get new_feedback_path(type: "bug")
    assert_response :success
  end

  test "should get new with feature type" do
    get new_feedback_path(type: "feature")
    assert_response :success
  end

  test "should redirect for invalid type" do
    get new_feedback_path(type: "invalid")
    assert_redirected_to root_path
    assert_equal "Invalid feedback type", flash[:alert]
  end

  test "should create bug report" do
    # Stub GitHub API calls
    mock_issue = OpenStruct.new(number: 123)
    Octokit::Client.any_instance.stubs(:create_issue).returns(mock_issue)

    post feedback_path, params: {
      type: "bug",
      title: "Test bug",
      description: "Bug description",
      page_url: "/test",
      user_agent: "Test Browser",
      viewport_size: "1920x1080",
      console_logs: '[{"level":"error","message":"Test error"}]'
    }

    assert_redirected_to root_path
    assert_equal "Bug report submitted successfully! Issue #123 created.", flash[:notice]
  end

  test "should create feature request" do
    # Stub GitHub API calls
    mock_issue = OpenStruct.new(number: 456)
    Octokit::Client.any_instance.stubs(:create_issue).returns(mock_issue)

    post feedback_path, params: {
      type: "feature",
      title: "Test feature",
      what_to_improve: "Add new feature",
      importance_level: "Nice to have",
      problem_description: "Problem description",
      current_handling: "Current workaround",
      frequency: "Daily",
      ideal_solution: "Ideal solution",
      examples: "Example apps",
      main_goal: "Save time",
      expected_outcome: "Better workflow",
      business_impact: "Minor efficiency gain",
      success_metrics: "Time saved",
      additional_notes: "Extra notes"
    }

    assert_redirected_to root_path
    assert_equal "Feature request submitted successfully! Issue #456 created.", flash[:notice]
  end

  test "should handle GitHub API errors for bug report" do
    # Stub GitHub API to raise error
    Octokit::Client.any_instance.stubs(:create_issue).raises(Octokit::Error.new)

    post feedback_path, params: {
      type: "bug",
      title: "Test bug",
      description: "Bug description"
    }

    assert_redirected_to new_feedback_path(type: "bug")
    assert_equal "Failed to submit bug report. Please try again.", flash[:alert]
  end

  test "should handle GitHub API errors for feature request" do
    # Stub GitHub API to raise error
    Octokit::Client.any_instance.stubs(:create_issue).raises(Octokit::Error.new)

    post feedback_path, params: {
      type: "feature",
      title: "Test feature",
      what_to_improve: "Add new feature"
    }

    assert_redirected_to new_feedback_path(type: "feature")
    assert_equal "Failed to submit feature request. Please try again.", flash[:alert]
  end

  test "should attach screenshot to bug report" do
    mock_issue = OpenStruct.new(number: 789)
    Octokit::Client.any_instance.stubs(:create_issue).returns(mock_issue)
    Octokit::Client.any_instance.stubs(:add_comment)

    screenshot_data = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k="

    post feedback_path, params: {
      type: "bug",
      title: "Test bug with screenshot",
      description: "Bug description",
      screenshot: screenshot_data
    }

    assert_redirected_to root_path
  end
end
