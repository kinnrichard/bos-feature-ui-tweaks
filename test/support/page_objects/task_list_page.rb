# TaskList Page Object Model
# Provides a high-level interface for interacting with the TaskList component

class TaskListPage
  attr_reader :page

  def initialize(page)
    @page = page
  end

  # =============================================
  # Navigation & Setup
  # =============================================

  def visit_job(job_identifier)
    job = resolve_job(job_identifier)
    @page.goto("/jobs/#{job.id}")
    wait_for_load
    self
  end

  def wait_for_load
    @page.wait_for_selector(".task-list, .task-item", timeout: 10)
    self
  end

  def reload
    @page.reload
    wait_for_load
    self
  end

  # =============================================
  # Element Getters
  # =============================================

  def container
    @page.locator(".task-list").first
  end

  def all_tasks
    @page.locator(".task-item:not(.task-item-add-new)")
  end

  def visible_tasks
    all_tasks.locator("visible=true")
  end

  def task(identifier)
    case identifier
    when Integer
      all_tasks.nth(identifier)
    when String
      if identifier.start_with?("#", ".", "[")
        @page.locator(identifier).first
      else
        @page.locator(".task-item", has_text: identifier).first
      end
    else
      all_tasks.first
    end
  end

  def new_task_form
    @page.locator(".task-item-add-new, .new-task-form").first
  end

  def selection_toolbar
    @page.locator(".selection-actions, .bulk-actions").first
  end

  def status_filter
    @page.locator(".status-filter, .task-filter").first
  end

  def search_box
    @page.locator("input[placeholder*='search'], input[type='search']").first
  end

  # =============================================
  # Task Interaction
  # =============================================

  def click_task(identifier, modifiers: [])
    task_element = task(identifier)

    if modifiers.empty?
      task_element.click
    else
      task_element.click(modifiers: modifiers)
    end

    wait_for_action_completion
    self
  end

  def ctrl_click_task(identifier)
    click_task(identifier, modifiers: [ "ControlOrMeta" ])
  end

  def shift_click_task(identifier)
    click_task(identifier, modifiers: [ "Shift" ])
  end

  def double_click_task(identifier)
    task(identifier).dblclick
    wait_for_action_completion
    self
  end

  def right_click_task(identifier)
    task(identifier).click(button: "right")
    wait_for_action_completion
    self
  end

  # =============================================
  # Task Creation
  # =============================================

  def create_task(title, method: :enter)
    # Click new task area
    if new_task_form.visible?
      new_task_form.click
    else
      @page.locator("text=New Task").first.click
    end

    # Find task input
    input = @page.locator("input[placeholder*='task'], input[placeholder*='Task']").first
    input.wait_for(state: "visible")

    # Enter title
    input.fill(title)

    # Submit based on method
    case method
    when :enter
      input.press("Enter")
    when :blur
      input.blur
    when :button
      @page.locator("button:has-text('Save'), button:has-text('Create')").first.click
    end

    wait_for_task_creation(title)
    self
  end

  def create_inline_task(after_task_identifier, title)
    reference_task = task(after_task_identifier)
    reference_task.click
    reference_task.press("Enter")

    inline_input = @page.locator(".task-item input[type='text']").last
    inline_input.fill(title)
    inline_input.press("Enter")

    wait_for_task_creation(title)
    self
  end

  # =============================================
  # Task Editing
  # =============================================

  def edit_task_title(identifier, new_title)
    task_element = task(identifier)
    title_element = task_element.locator(".task-title, h5").first

    # Enter edit mode
    title_element.dblclick

    # Find input and edit
    input = task_element.locator("input[type='text']").first
    input.wait_for(state: "visible")
    input.fill(new_title)
    input.press("Enter")

    wait_for_text_update(task_element, new_title)
    self
  end

  def start_editing(identifier)
    task_element = task(identifier)
    title_element = task_element.locator(".task-title").first
    title_element.dblclick

    # Return input for further interaction
    task_element.locator("input[type='text']").first
  end

  def cancel_edit(identifier)
    task_element = task(identifier)
    input = task_element.locator("input[type='text']").first
    input.press("Escape")
    self
  end

  # =============================================
  # Status Management
  # =============================================

  def change_task_status(identifier, new_status)
    task_element = task(identifier)
    status_button = task_element.locator(".status-emoji, .task-status button").first

    status_button.click

    # Handle different status UI patterns
    if @page.locator(".status-dropdown, .status-menu").visible?
      @page.locator("text=#{new_status.humanize}").first.click
    else
      # Cycle through statuses if needed
      cycle_to_status(status_button, identifier, new_status)
    end

    wait_for_status_update(identifier, new_status)
    self
  end

  def get_task_status(identifier)
    task_element = task(identifier)
    status_element = task_element.locator(".status-emoji, .task-status").first

    # Try different ways to extract status
    status_element.get_attribute("data-status") ||
    extract_status_from_emoji(status_element.text_content) ||
    "unknown"
  end

  # =============================================
  # Drag & Drop
  # =============================================

  def drag_task(source_identifier, target_identifier, position: :after)
    source_task = task(source_identifier)
    target_task = task(target_identifier)

    # Get positions for drop calculation
    target_box = target_task.bounding_box

    case position
    when :before
      drop_y = target_box["y"] - 5
    when :after
      drop_y = target_box["y"] + target_box["height"] + 5
    when :center, :nest
      drop_y = target_box["y"] + (target_box["height"] / 2)
    end

    drop_x = target_box["x"] + (target_box["width"] / 2)

    # Perform drag and drop
    source_task.drag_to(target_task, target_position: { x: drop_x, y: drop_y })

    wait_for_drag_completion
    self
  end

  def drag_for_nesting(source_identifier, parent_identifier)
    drag_task(source_identifier, parent_identifier, position: :center)
  end

  def drag_for_reordering(source_identifier, target_identifier, position: :after)
    drag_task(source_identifier, target_identifier, position: position)
  end

  # =============================================
  # Hierarchy Management
  # =============================================

  def expand_task(identifier)
    task_element = task(identifier)
    disclosure = task_element.locator(".disclosure-button, .expand-button").first

    if disclosure.visible?
      disclosure.click
      wait_for_expansion(identifier)
    end

    self
  end

  def collapse_task(identifier)
    task_element = task(identifier)
    disclosure = task_element.locator(".disclosure-button, .collapse-button").first

    if disclosure.visible?
      disclosure.click
      wait_for_collapse(identifier)
    end

    self
  end

  def get_task_children(parent_identifier)
    parent_task = task(parent_identifier)
    parent_id = parent_task.get_attribute("data-task-id")
    @page.locator(".task-item[data-parent-id='#{parent_id}']")
  end

  def get_task_depth(identifier)
    task_element = task(identifier)
    depth = task_element.evaluate("el => getComputedStyle(el).getPropertyValue('--depth')")
    depth.to_i
  end

  # =============================================
  # Selection & Multi-select
  # =============================================

  def select_multiple_tasks(*identifiers)
    identifiers.each_with_index do |identifier, index|
      if index == 0
        click_task(identifier)
      else
        ctrl_click_task(identifier)
      end
    end
    self
  end

  def select_task_range(start_identifier, end_identifier)
    click_task(start_identifier)
    shift_click_task(end_identifier)
    self
  end

  def get_selected_tasks
    @page.locator(".task-item.selected, .task-item[aria-selected='true']")
  end

  def get_selected_count
    get_selected_tasks.count
  end

  def clear_selection
    @page.keyboard.press("Escape")
    wait_for_action_completion
    self
  end

  # =============================================
  # Keyboard Navigation
  # =============================================

  def navigate_up(count: 1)
    count.times { @page.keyboard.press("ArrowUp") }
    wait_for_action_completion
    self
  end

  def navigate_down(count: 1)
    count.times { @page.keyboard.press("ArrowDown") }
    wait_for_action_completion
    self
  end

  def use_shortcut(key)
    case key.to_sym
    when :delete
      @page.keyboard.press("Delete")
    when :escape
      @page.keyboard.press("Escape")
    when :enter
      @page.keyboard.press("Enter")
    when :select_all
      @page.keyboard.press("Control+a")
    else
      @page.keyboard.press(key.to_s)
    end

    wait_for_action_completion
    self
  end

  # =============================================
  # Filtering & Search
  # =============================================

  def filter_by_status(status)
    if status_filter.visible?
      status_filter.click
      @page.locator("text=#{status.humanize}").first.click
      wait_for_filter_completion
    end
    self
  end

  def search(query)
    if search_box.visible?
      search_box.fill(query)
      wait_for_filter_completion
    end
    self
  end

  def clear_filters
    clear_button = @page.locator(".clear-filters, .reset-filters").first
    if clear_button.visible?
      clear_button.click
      wait_for_filter_completion
    end
    self
  end

  # =============================================
  # Assertions & Validation
  # =============================================

  def has_task?(identifier)
    begin
      task(identifier).visible?
    rescue
      false
    end
  end

  def task_count
    all_tasks.count
  end

  def visible_task_count
    visible_tasks.count
  end

  def has_selected_tasks?
    get_selected_count > 0
  end

  def task_order
    all_tasks.all.map do |task_element|
      task_element.locator(".task-title").text_content.strip
    end
  end

  def task_statuses
    all_tasks.all.map do |task_element|
      status_element = task_element.locator(".status-emoji, .task-status").first
      extract_status_from_emoji(status_element.text_content) || "unknown"
    end
  end

  # =============================================
  # Debugging & Utilities
  # =============================================

  def take_screenshot(name = nil)
    name ||= "tasklist_#{Time.now.to_i}"
    screenshot_dir = Rails.root.join("tmp", "screenshots")
    FileUtils.mkdir_p(screenshot_dir)

    path = screenshot_dir.join("#{name}.png")
    @page.screenshot(path: path.to_s)

    puts "📸 TaskList screenshot: #{path}"
    path
  end

  def debug_info
    {
      task_count: task_count,
      visible_count: visible_task_count,
      selected_count: get_selected_count,
      task_order: task_order,
      has_new_form: new_task_form.visible?,
      has_filters: status_filter.visible?
    }
  end

  def print_debug_info
    info = debug_info
    puts "\n🐛 TaskList Debug Info:"
    info.each { |key, value| puts "  #{key}: #{value}" }
    puts
  end

  private

  # =============================================
  # Private Utility Methods
  # =============================================

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

  def wait_for_action_completion
    sleep 0.3 # Brief pause for UI updates
  end

  def wait_for_task_creation(title, timeout: 5)
    @page.wait_for_selector(".task-item:has-text('#{title}')", timeout: timeout)
  end

  def wait_for_text_update(element, text, timeout: 5)
    @page.wait_for_function(
      "(args) => {
        const element = document.querySelector(args.selector);
        return element && element.textContent.includes(args.text);
      }",
      { selector: ".task-item", text: text },
      timeout: timeout
    )
  end

  def wait_for_status_update(identifier, expected_status, timeout: 5)
    @page.wait_for_function(
      "(args) => {
        const tasks = document.querySelectorAll('.task-item');
        for (let task of tasks) {
          if (task.textContent.includes(args.identifier)) {
            const statusEl = task.querySelector('.status-emoji, .task-status');
            return statusEl && (
              statusEl.dataset.status === args.status ||
              statusEl.textContent.includes(args.emoji)
            );
          }
        }
        return false;
      }",
      {
        identifier: identifier.to_s,
        status: expected_status,
        emoji: status_to_emoji(expected_status)
      },
      timeout: timeout
    )
  end

  def wait_for_expansion(identifier, timeout: 3)
    @page.wait_for_selector(".task-item[data-parent-id]", state: "visible", timeout: timeout)
  end

  def wait_for_collapse(identifier, timeout: 3)
    @page.wait_for_selector(".task-item[data-parent-id]", state: "hidden", timeout: timeout)
  end

  def wait_for_drag_completion
    @page.wait_for_function(
      "() => !document.querySelector('.drag-indicator, .drop-zone-active')",
      timeout: 5
    )
  end

  def wait_for_filter_completion
    sleep 0.5 # Wait for filter to apply
  end

  def cycle_to_status(status_button, identifier, target_status)
    # Simple cycling implementation
    max_clicks = 6 # Prevent infinite loops

    max_clicks.times do
      current_status = get_task_status(identifier)
      break if current_status == target_status

      status_button.click
      sleep 0.2
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
end
