# TaskList Test Helpers
# Comprehensive helpers for testing TaskList component functionality

module TaskListTestHelpers
  # =============================================
  # Authentication & Navigation
  # =============================================

  def login_as_test_user(role = :admin)
    credentials = TestEnvironment.test_credentials(role)

    unless credentials
      raise "No test user found for role: #{role}. Run TestEnvironment.setup_test_data!"
    end

    visit "/login"
    fill_in "Email", with: credentials[:email]
    fill_in "Password", with: credentials[:password]
    click_on "Sign In"

    # Wait for successful login
    wait_for_navigation

    # Verify we're logged in
    assert_no_text "Sign In"

    credentials[:email]
  end

  def navigate_to_job(job_identifier)
    job = resolve_job(job_identifier)
    visit "/jobs/#{job.id}"
    wait_for_tasklist_load
    job
  end

  def wait_for_tasklist_load
    # Wait for the task list to load
    wait_for_selector(".task-list, .task-item", timeout: 10000)
  end

  # =============================================
  # Task List Element Selectors
  # =============================================

  def task_list_container
    @page.locator(".task-list").first
  end

  def task_items
    @page.locator(".task-item")
  end

  def task_item(identifier)
    if identifier.is_a?(String) && identifier.include?("task-")
      # Direct selector
      @page.locator(identifier).first
    elsif identifier.is_a?(Integer)
      # By index (0-based)
      task_items.nth(identifier)
    else
      # By title text
      @page.locator(".task-item", has_text: identifier.to_s).first
    end
  end

  def new_task_form
    @page.locator(".task-item-add-new, .new-task-form").first
  end

  def task_status_filter
    @page.locator(".status-filter, .task-filter").first
  end

  # =============================================
  # Task Creation Helpers
  # =============================================

  def create_new_task(title, options = {})
    # Navigate to new task form
    if new_task_form.visible?
      new_task_form.click
    else
      # Look for "New Task" button or placeholder
      new_task_button = @page.locator("text=New Task").first
      new_task_button.click if new_task_button.visible?
    end

    # Wait for form to appear
    task_input = @page.locator("input[placeholder*='task'], input[placeholder*='Task']").first
    wait_for_element(task_input)

    # Fill in task title
    task_input.fill(title)

    # Handle different submission methods
    if options[:method] == :enter
      task_input.press("Enter")
    elsif options[:method] == :blur
      task_input.blur
    else
      # Look for save/create button
      save_button = @page.locator("button:has-text('Save'), button:has-text('Create')").first
      save_button.click if save_button.visible?
    end

    # Wait for task to appear in list
    wait_for_task_creation(title)
  end

  def create_inline_task(after_task_identifier, title)
    # Find the reference task
    reference_task = task_item(after_task_identifier)

    # Look for inline creation trigger (might be keyboard shortcut or button)
    reference_task.click
    reference_task.press("Enter") # Common pattern for inline creation

    # Fill in the inline form
    inline_input = @page.locator(".task-item input[type='text']").last
    inline_input.fill(title)
    inline_input.press("Enter")

    wait_for_task_creation(title)
  end

  def wait_for_task_creation(title, timeout: 5000)
    @page.wait_for_selector(
      ".task-item:has-text('#{title}')",
      timeout: timeout / 1000.0
    )
  end

  # =============================================
  # Task Interaction Helpers
  # =============================================

  def click_task(identifier)
    task = task_item(identifier)
    task.click
    wait_for_selection_update
  end

  def click_task_with_modifier(identifier, modifier: :ctrl)
    task = task_item(identifier)

    case modifier
    when :ctrl, :cmd
      task.click(modifiers: [ "ControlOrMeta" ])
    when :shift
      task.click(modifiers: [ "Shift" ])
    else
      task.click
    end

    wait_for_selection_update
  end

  def double_click_task(identifier)
    task = task_item(identifier)
    task.dblclick

    # Wait for edit mode or action
    sleep 0.5
  end

  def right_click_task(identifier)
    task = task_item(identifier)
    task.click(button: "right")

    # Wait for context menu
    sleep 0.5
  end

  def select_multiple_tasks(*identifiers)
    identifiers.each_with_index do |identifier, index|
      if index == 0
        click_task(identifier)
      else
        click_task_with_modifier(identifier, modifier: :ctrl)
      end
    end
  end

  def select_task_range(start_identifier, end_identifier)
    click_task(start_identifier)
    click_task_with_modifier(end_identifier, modifier: :shift)
  end

  # =============================================
  # Task Status Management
  # =============================================

  def change_task_status(identifier, new_status)
    task = task_item(identifier)

    # Find status button/emoji within task
    status_button = task.locator(".status-emoji, .task-status button").first
    status_button.click

    # Handle different status selection UIs
    if @page.locator(".status-dropdown, .status-menu").visible?
      # Dropdown interface
      status_option = @page.locator("text=#{new_status}").first
      status_option.click
    else
      # Cycling interface - click multiple times if needed
      current_status = get_task_status(identifier)
      status_cycle = [ "new_task", "in_progress", "successfully_completed" ]

      current_index = status_cycle.index(current_status) || 0
      target_index = status_cycle.index(new_status) || 0

      clicks_needed = (target_index - current_index) % status_cycle.length
      clicks_needed.times { status_button.click }
    end

    wait_for_status_update(identifier, new_status)
  end

  def get_task_status(identifier)
    task = task_item(identifier)
    status_element = task.locator(".status-emoji, .task-status").first

    # Extract status from data attributes, classes, or text
    status_element.get_attribute("data-status") ||
    extract_status_from_classes(status_element) ||
    extract_status_from_emoji(status_element.text_content)
  end

  def wait_for_status_update(identifier, expected_status, timeout: 5000)
    task = task_item(identifier)

    @page.wait_for_function(
      "(args) => {
        const task = document.querySelector(args.selector);
        const statusElement = task?.querySelector('.status-emoji, .task-status');
        return statusElement && (
          statusElement.dataset.status === args.status ||
          statusElement.textContent.includes(args.statusEmoji)
        );
      }",
      {
        selector: build_task_selector(identifier),
        status: expected_status,
        statusEmoji: status_to_emoji(expected_status)
      },
      timeout: timeout / 1000.0
    )
  end

  # =============================================
  # Task Editing Helpers
  # =============================================

  def edit_task_title(identifier, new_title)
    task = task_item(identifier)

    # Find the title element
    title_element = task.locator(".task-title, h5").first

    # Double-click to enter edit mode
    title_element.dblclick

    # Wait for input field
    input_field = task.locator("input[type='text']").first
    wait_for_element(input_field)

    # Clear and enter new title
    input_field.fill(new_title)
    input_field.press("Enter")

    # Wait for title update
    wait_for_text_in_element(task, new_title)
  end

  def start_editing_task(identifier)
    task = task_item(identifier)
    title_element = task.locator(".task-title").first
    title_element.dblclick

    # Return the input element for further interaction
    task.locator("input[type='text']").first
  end

  def cancel_task_edit(identifier)
    task = task_item(identifier)
    input_field = task.locator("input[type='text']").first
    input_field.press("Escape")
  end

  # =============================================
  # Drag & Drop Helpers
  # =============================================

  def drag_task_to_position(source_identifier, target_identifier, position: :after)
    source_task = task_item(source_identifier)
    target_task = task_item(target_identifier)

    # Get bounding boxes
    source_box = source_task.bounding_box
    target_box = target_task.bounding_box

    # Calculate drop position
    case position
    when :before
      drop_y = target_box["y"] - 5
    when :after
      drop_y = target_box["y"] + target_box["height"] + 5
    when :center, :nest
      drop_y = target_box["y"] + (target_box["height"] / 2)
    else
      drop_y = target_box["y"] + target_box["height"] + 5
    end

    drop_x = target_box["x"] + (target_box["width"] / 2)

    # Perform drag and drop
    source_task.drag_to_position(x: drop_x, y: drop_y)

    # Wait for position update
    wait_for_drag_completion
  end

  def drag_task_for_nesting(source_identifier, parent_identifier)
    drag_task_to_position(source_identifier, parent_identifier, position: :center)
  end

  def drag_task_for_reordering(source_identifier, target_identifier, position: :after)
    drag_task_to_position(source_identifier, target_identifier, position: position)
  end

  def wait_for_drag_completion(timeout: 5000)
    # Wait for any drag indicators to disappear
    @page.wait_for_function(
      "() => !document.querySelector('.drag-indicator, .drop-zone-active')",
      timeout: timeout / 1000.0
    )
  end

  # =============================================
  # Hierarchy & Nesting Helpers
  # =============================================

  def expand_task(identifier)
    task = task_item(identifier)
    disclosure_button = task.locator(".disclosure-button, .expand-button").first

    if disclosure_button.visible?
      disclosure_button.click
      wait_for_subtask_expansion(identifier)
    end
  end

  def collapse_task(identifier)
    task = task_item(identifier)
    disclosure_button = task.locator(".disclosure-button, .collapse-button").first

    if disclosure_button.visible?
      disclosure_button.click
      wait_for_subtask_collapse(identifier)
    end
  end

  def wait_for_subtask_expansion(parent_identifier, timeout: 3000)
    # Wait for subtasks to become visible
    @page.wait_for_selector(
      ".task-item[data-parent-id]",
      state: "visible",
      timeout: timeout / 1000.0
    )
  end

  def wait_for_subtask_collapse(parent_identifier, timeout: 3000)
    # Wait for subtasks to be hidden
    @page.wait_for_selector(
      ".task-item[data-parent-id]",
      state: "hidden",
      timeout: timeout / 1000.0
    )
  end

  def get_task_depth(identifier)
    task = task_item(identifier)

    # Extract depth from CSS custom property or data attribute
    depth_value = task.evaluate("el => getComputedStyle(el).getPropertyValue('--depth')")
    depth_value.to_i
  end

  def get_task_children(parent_identifier)
    parent_task = task_item(parent_identifier)
    parent_id = parent_task.get_attribute("data-task-id")

    @page.locator(".task-item[data-parent-id='#{parent_id}']")
  end

  # =============================================
  # Keyboard Navigation Helpers
  # =============================================

  def navigate_tasks_with_arrows(direction, count: 1)
    key = direction == :up ? "ArrowUp" : "ArrowDown"

    count.times do
      @page.keyboard.press(key)
      sleep 0.1 # Small delay for navigation
    end
  end

  def use_task_keyboard_shortcut(shortcut)
    case shortcut.to_sym
    when :delete, :del
      @page.keyboard.press("Delete")
    when :escape, :esc
      @page.keyboard.press("Escape")
    when :enter
      @page.keyboard.press("Enter")
    when :select_all
      @page.keyboard.press("Control+a")
    else
      @page.keyboard.press(shortcut.to_s)
    end

    # Wait for action to complete
    sleep 0.5
  end

  # =============================================
  # Selection & Multi-Select Helpers
  # =============================================

  def get_selected_tasks
    @page.locator(".task-item.selected, .task-item[aria-selected='true']")
  end

  def get_selected_task_count
    get_selected_tasks.count
  end

  def clear_task_selection
    use_task_keyboard_shortcut(:escape)
  end

  def assert_task_selected(identifier)
    task = task_item(identifier)

    assert task.get_attribute("aria-selected") == "true" ||
           task.evaluate("el => el.classList.contains('selected')"),
           "Expected task to be selected: #{identifier}"
  end

  def assert_task_not_selected(identifier)
    task = task_item(identifier)

    assert task.get_attribute("aria-selected") != "true" &&
           !task.evaluate("el => el.classList.contains('selected')"),
           "Expected task to not be selected: #{identifier}"
  end

  def wait_for_selection_update(timeout: 3000)
    # Wait for selection state to stabilize
    sleep 0.3
  end

  # =============================================
  # Filtering & Search Helpers
  # =============================================

  def filter_tasks_by_status(status)
    # Look for status filter controls
    filter_control = @page.locator(".status-filter, .task-filter").first

    if filter_control.visible?
      filter_control.click

      # Select the status option
      status_option = @page.locator("text=#{status.humanize}").first
      status_option.click
    end

    wait_for_filter_application
  end

  def clear_task_filters
    clear_filter_button = @page.locator(".clear-filters, .reset-filters").first

    if clear_filter_button.visible?
      clear_filter_button.click
      wait_for_filter_application
    end
  end

  def wait_for_filter_application(timeout: 3000)
    # Wait for filtering to complete
    sleep 0.5
  end

  def search_tasks(query)
    search_input = @page.locator("input[placeholder*='search'], input[type='search']").first

    if search_input.visible?
      search_input.fill(query)

      # Wait for search results
      sleep 0.5
    end
  end

  # =============================================
  # Assertion Helpers
  # =============================================

  def assert_task_exists(identifier)
    task = task_item(identifier)

    assert task.visible?,
           "Expected task to exist and be visible: #{identifier}"
  end

  def assert_task_not_exists(identifier)
    begin
      task = task_item(identifier)
      assert !task.visible?,
             "Expected task to not exist or be hidden: #{identifier}"
    rescue
      # Task not found - this is what we want
    end
  end

  def assert_task_has_status(identifier, expected_status)
    actual_status = get_task_status(identifier)

    assert_equal expected_status, actual_status,
                 "Expected task #{identifier} to have status #{expected_status}, but was #{actual_status}"
  end

  def assert_task_order(*identifiers)
    task_titles = task_items.all.map { |task| task.locator(".task-title").text_content.strip }

    identifiers.each_with_index do |identifier, index|
      expected_title = identifier.is_a?(String) ? identifier : resolve_task_title(identifier)

      assert task_titles[index]&.include?(expected_title),
             "Expected task #{index} to be '#{expected_title}', but task order was: #{task_titles.inspect}"
    end
  end

  def assert_task_count(expected_count)
    actual_count = task_items.count

    assert_equal expected_count, actual_count,
                 "Expected #{expected_count} tasks, but found #{actual_count}"
  end

  def assert_task_is_child_of(child_identifier, parent_identifier)
    child_task = task_item(child_identifier)
    parent_task = task_item(parent_identifier)

    parent_id = parent_task.get_attribute("data-task-id")
    child_parent_id = child_task.get_attribute("data-parent-id")

    assert_equal parent_id, child_parent_id,
                 "Expected task #{child_identifier} to be child of #{parent_identifier}"
  end

  # =============================================
  # Utility Methods
  # =============================================

  private

  def resolve_job(identifier)
    case identifier
    when Job
      identifier
    when Integer
      Job.find(identifier)
    when String
      Job.find_by(title: identifier) || Job.find(identifier.to_i)
    when Symbol
      TestEnvironment.get_test_job(identifier)
    else
      Job.first
    end
  end

  def resolve_task_title(identifier)
    if identifier.is_a?(String)
      identifier
    else
      task_item(identifier).locator(".task-title").text_content.strip
    end
  end

  def build_task_selector(identifier)
    if identifier.is_a?(String) && identifier.include?("task-")
      identifier
    elsif identifier.is_a?(Integer)
      ".task-item:nth-child(#{identifier + 1})"
    else
      ".task-item:has-text('#{identifier}')"
    end
  end

  def extract_status_from_classes(element)
    class_list = element.get_attribute("class") || ""

    %w[new_task in_progress paused successfully_completed cancelled failed].find do |status|
      class_list.include?(status)
    end
  end

  def extract_status_from_emoji(text)
    emoji_map = {
      "📋" => "new_task",
      "🔄" => "in_progress",
      "⏸️" => "paused",
      "✅" => "successfully_completed",
      "❌" => "cancelled",
      "💥" => "failed"
    }

    emoji_map[text.strip]
  end

  def status_to_emoji(status)
    emoji_map = {
      "new_task" => "📋",
      "in_progress" => "🔄",
      "paused" => "⏸️",
      "successfully_completed" => "✅",
      "cancelled" => "❌",
      "failed" => "💥"
    }

    emoji_map[status] || "📋"
  end

  def wait_for_element(element, timeout: 5000)
    element.wait_for(state: "visible", timeout: timeout / 1000.0)
  end

  def wait_for_text_in_element(element, text, timeout: 5000)
    element.wait_for(state: "visible", timeout: timeout / 1000.0)

    @page.wait_for_function(
      "(args) => {
        const element = document.querySelector(args.selector);
        return element && element.textContent.includes(args.text);
      }",
      {
        selector: build_element_selector(element),
        text: text
      },
      timeout: timeout / 1000.0
    )
  end

  def build_element_selector(element)
    # Simple approach - generate a unique selector for the element
    ".task-item" # Fallback - should be enhanced based on actual element
  end
end
