# Test Seeds for TaskList Comprehensive Testing
# This file creates realistic test data for Playwright tests

return unless Rails.env.test?

Rails.logger.info "🌱 Creating comprehensive test data..."

# Clear existing data safely using our improved cleanup method
Rails.logger.info "🧹 Cleaning existing test data..."
if defined?(TestEnvironment)
  TestEnvironment.clear_all_data!
else
  # Fallback if TestEnvironment is not loaded
  Rails.logger.info "🔄 Using manual cleanup fallback..."

  # Disable foreign key checks for PostgreSQL
  if ActiveRecord::Base.connection.adapter_name.downcase.include?('postgresql')
    ActiveRecord::Base.connection.execute('SET session_replication_role = replica;')
  end

  # Clear in dependency order
  [ ActivityLog, Task, JobAssignment, JobPerson, Note, Job,
   ContactMethod, Person, Device, Client, RefreshToken, User ].each do |model|
    begin
      model.delete_all
    rescue => e
      Rails.logger.warn "  ⚠️  Could not clear #{model.name}: #{e.message}"
    end
  end

  # Re-enable foreign key checks
  if ActiveRecord::Base.connection.adapter_name.downcase.include?('postgresql')
    ActiveRecord::Base.connection.execute('SET session_replication_role = DEFAULT;')
  end
end
Rails.logger.info "✅ Test data cleared"

# =============================================
# USERS - Test accounts with different roles
# =============================================

Rails.logger.info "👥 Creating test users..."

test_users = {
  owner: {
    name: "Oliver Owner",
    email: "owner@bos-test.local",
    password: "password123",
    role: "owner"
  },
  admin: {
    name: "Alice Admin",
    email: "admin@bos-test.local",
    password: "password123",
    role: "admin"
  },
  tech_lead: {
    name: "Terry TechLead",
    email: "techlead@bos-test.local",
    password: "password123",
    role: "technician"
  },
  technician: {
    name: "Tom Technician",
    email: "tech@bos-test.local",
    password: "password123",
    role: "technician"
  },
  technician2: {
    name: "Tina Technician",
    email: "tech2@bos-test.local",
    password: "password123",
    role: "technician"
  }
}

created_users = {}
test_users.each do |key, attrs|
  user = User.find_or_create_by(email: attrs[:email]) do |u|
    u.name = attrs[:name]
    u.email = attrs[:email]
    u.role = attrs[:role]
    u.password = attrs[:password]
    u.password_confirmation = attrs[:password]
  end
  created_users[key] = user
  Rails.logger.info "  ✓ #{user.name} (#{user.role})"
end

# =============================================
# CLIENTS - Test companies and individuals
# =============================================

Rails.logger.info "🏢 Creating test clients..."

test_clients = [
  { name: "Acme Corporation", client_type: "business" },
  { name: "TechStart Innovations", client_type: "business" },
  { name: "Local Coffee Shop", client_type: "business" },
  { name: "Dormant Corp", client_type: "business" },
  { name: "Global Enterprises Ltd", client_type: "business" },
  { name: "Johnson Family", client_type: "residential" }
]

created_clients = {}
test_clients.each_with_index do |client_attrs, index|
  client = Client.find_or_create_by(name: client_attrs[:name]) do |c|
    c.client_type = client_attrs[:client_type]
  end
  created_clients["client_#{index + 1}".to_sym] = client
  Rails.logger.info "  ✓ #{client.name}"
end

# =============================================
# DEVICES - Test hardware
# =============================================

Rails.logger.info "📱 Creating test devices..."

test_devices = [
  { name: "Primary Test iPhone", model: "iPhone 14 Pro", serial_number: "ABC123456", client: created_clients[:client_1] },
  { name: "Test Android Device", model: "Samsung Galaxy S23", serial_number: "DEF789012", client: created_clients[:client_2] },
  { name: "Test Laptop", model: "MacBook Pro M2", serial_number: "GHI345678", client: created_clients[:client_1] },
  { name: "Test Tablet", model: "iPad Air", serial_number: "JKL901234", client: created_clients[:client_3] }
]

created_devices = {}
test_devices.each_with_index do |device_attrs, index|
  device = Device.find_or_create_by(name: device_attrs[:name]) do |d|
    d.model = device_attrs[:model]
    d.serial_number = device_attrs[:serial_number]
    d.client = device_attrs[:client]
  end
  created_devices["device_#{index + 1}".to_sym] = device
  Rails.logger.info "  ✓ #{device.name}"
end

# =============================================
# PEOPLE - Client contacts
# =============================================

Rails.logger.info "👤 Creating test people..."

test_people = [
  { name: "John Acme", client: created_clients[:client_1] },
  { name: "Sarah Tech", client: created_clients[:client_2] },
  { name: "Mike Coffee", client: created_clients[:client_3] },
  { name: "Mary Johnson", client: created_clients[:client_6] }
]

created_people = {}
test_people.each_with_index do |person_attrs, index|
  person = Person.find_or_create_by(name: person_attrs[:name]) do |p|
    p.client = person_attrs[:client]
  end
  created_people["person_#{index + 1}".to_sym] = person
  Rails.logger.info "  ✓ #{person.name}"
end

# =============================================
# JOBS - Various complexity scenarios
# =============================================

Rails.logger.info "💼 Creating test jobs..."

# Simple job for basic testing
simple_job = Job.find_or_create_by(title: "Simple Website Setup") do |j|
  j.client = created_clients[:client_1]
  j.status = "open"
  j.priority = "normal"
  j.description = "Basic website setup and configuration"
end

Rails.logger.info "  ✓ #{simple_job.title}"

# Complex job for hierarchical testing
complex_job = Job.find_or_create_by(title: "Enterprise Software Deployment") do |j|
  j.client = created_clients[:client_2]
  j.status = "in_progress"
  j.priority = "high"
  j.description = "Large scale enterprise software deployment with multiple phases"
end

Rails.logger.info "  ✓ #{complex_job.title}"

# Mixed status job for status testing
mixed_job = Job.find_or_create_by(title: "Mobile App Development") do |j|
  j.client = created_clients[:client_3]
  j.status = "in_progress"
  j.priority = "normal"
  j.description = "Mobile app development with mixed task statuses"
end

Rails.logger.info "  ✓ #{mixed_job.title}"

# Large job for performance testing
large_job = Job.find_or_create_by(title: "System Migration Project") do |j|
  j.client = created_clients[:client_4]
  j.status = "in_progress"
  j.priority = "high"
  j.description = "Large system migration with many tasks"
end

Rails.logger.info "  ✓ #{large_job.title}"

# Empty job for creation testing
empty_job = Job.find_or_create_by(title: "Empty Project Template") do |j|
  j.client = created_clients[:client_5]
  j.status = "open"
  j.priority = "low"
  j.description = "Empty project for testing task creation"
end

Rails.logger.info "  ✓ #{empty_job.title}"

# =============================================
# TASKS - Comprehensive task scenarios
# =============================================

Rails.logger.info "📋 Creating test tasks..."

# Simple job tasks
simple_tasks = [
  { title: "Initial setup", status: "new_task", position: 10 },
  { title: "Install dependencies", status: "in_progress", position: 20 },
  { title: "Configure settings", status: "new_task", position: 30 },
  { title: "Test functionality", status: "new_task", position: 40 },
  { title: "Deploy to production", status: "new_task", position: 50 }
]

simple_tasks.each do |task_attrs|
  task = Task.find_or_create_by(title: task_attrs[:title], job: simple_job) do |t|
    t.status = task_attrs[:status]
    t.position = task_attrs[:position]
    t.assigned_to = created_users[:technician]
  end
  Rails.logger.info "    ✓ #{task.title}"
end

# Complex job with hierarchical tasks
planning_task = Task.find_or_create_by(title: "Project Planning Phase", job: complex_job) do |t|
  t.status = "successfully_completed"
  t.position = 10
  t.assigned_to = created_users[:tech_lead]
end

# Planning subtasks
planning_subtasks = [
  { title: "Requirements gathering", status: "successfully_completed", position: 11 },
  { title: "Architecture design", status: "successfully_completed", position: 12 },
  { title: "Resource allocation", status: "successfully_completed", position: 13 }
]

planning_subtasks.each do |subtask_attrs|
  task = Task.find_or_create_by(title: subtask_attrs[:title], job: complex_job) do |t|
    t.status = subtask_attrs[:status]
    t.position = subtask_attrs[:position]
    t.parent_id = planning_task.id
    t.assigned_to = created_users[:admin]
  end
  Rails.logger.info "      → #{task.title}"
end

development_task = Task.find_or_create_by(title: "Development Phase", job: complex_job) do |t|
  t.status = "in_progress"
  t.position = 20
  t.assigned_to = created_users[:tech_lead]
end

# Development subtasks
dev_subtasks = [
  { title: "Frontend development", status: "in_progress", position: 21 },
  { title: "Backend development", status: "in_progress", position: 22 },
  { title: "Database setup", status: "successfully_completed", position: 23 },
  { title: "API integration", status: "new_task", position: 24 }
]

dev_subtasks.each do |subtask_attrs|
  task = Task.find_or_create_by(title: subtask_attrs[:title], job: complex_job) do |t|
    t.status = subtask_attrs[:status]
    t.position = subtask_attrs[:position]
    t.parent_id = development_task.id
    t.assigned_to = created_users[:technician]
  end
  Rails.logger.info "      → #{task.title}"
end

testing_task = Task.find_or_create_by(title: "Testing Phase", job: complex_job) do |t|
  t.status = "new_task"
  t.position = 30
  t.assigned_to = created_users[:technician2]
end

# Testing subtasks
test_subtasks = [
  { title: "Unit testing", status: "new_task", position: 31 },
  { title: "Integration testing", status: "new_task", position: 32 },
  { title: "User acceptance testing", status: "new_task", position: 33 }
]

test_subtasks.each do |subtask_attrs|
  task = Task.find_or_create_by(title: subtask_attrs[:title], job: complex_job) do |t|
    t.status = subtask_attrs[:status]
    t.position = subtask_attrs[:position]
    t.parent_id = testing_task.id
    t.assigned_to = created_users[:technician2]
  end
  Rails.logger.info "      → #{task.title}"
end

Rails.logger.info "    ✓ #{complex_job.title} (#{complex_job.tasks.count} tasks)"

# Mixed status job tasks
mixed_statuses = [ "new_task", "in_progress", "paused", "successfully_completed", "cancelled" ]
mixed_tasks = [
  { title: "App design mockups", status: "successfully_completed", position: 10 },
  { title: "User interface development", status: "in_progress", position: 20 },
  { title: "Authentication system", status: "paused", position: 30 },
  { title: "Payment integration", status: "new_task", position: 40 },
  { title: "Push notifications", status: "cancelled", position: 50 },
  { title: "App store submission", status: "cancelled", position: 60 },
  { title: "Bug fixes", status: "in_progress", position: 70 },
  { title: "Performance optimization", status: "new_task", position: 80 }
]

mixed_tasks.each do |task_attrs|
  task = Task.find_or_create_by(title: task_attrs[:title], job: mixed_job) do |t|
    t.status = task_attrs[:status]
    t.position = task_attrs[:position]
    t.assigned_to = [ created_users[:technician], created_users[:technician2] ].sample
  end
  Rails.logger.info "    ✓ #{task.title} (#{task.status})"
end

# Large job with many tasks for performance testing
(1..25).each do |i|
  status = mixed_statuses.sample
  task = Task.find_or_create_by(title: "Migration Task #{i}", job: large_job) do |t|
    t.status = status
    t.position = i * 10
    t.assigned_to = [ created_users[:technician], created_users[:technician2], created_users[:tech_lead] ].sample
  end

  # Add some subtasks to a few parent tasks
  if i % 5 == 0 && i <= 15
    (1..3).each do |j|
      subtask = Task.find_or_create_by(title: "Migration Subtask #{i}.#{j}", job: large_job) do |st|
        st.status = mixed_statuses.sample
        st.position = (i * 10) + j
        st.parent_id = task.id
        st.assigned_to = created_users[:technician]
      end
    end
  end
end

Rails.logger.info "    ✓ #{large_job.title} (#{large_job.tasks.count} tasks)"

# Note: empty_job has no tasks by design

# =============================================
# VERIFICATION
# =============================================

Rails.logger.info "\n✅ Test data creation complete!"
Rails.logger.info "\n📊 Summary:"
Rails.logger.info "  Users: #{User.count}"
Rails.logger.info "  Clients: #{Client.count}"
Rails.logger.info "  Jobs: #{Job.count}"
Rails.logger.info "  Tasks: #{Task.count}"
Rails.logger.info "  Devices: #{Device.count}"
Rails.logger.info "  People: #{Person.count}"

Rails.logger.info "\n🎯 Test Scenarios Created:"
Rails.logger.info "  • Simple Website Setup (#{simple_job.tasks.count} tasks)"
Rails.logger.info "  • Enterprise Software Deployment (#{complex_job.tasks.count} tasks with hierarchy)"
Rails.logger.info "  • Mobile App Development (#{mixed_job.tasks.count} tasks with mixed statuses)"
Rails.logger.info "  • System Migration Project (#{large_job.tasks.count} tasks for performance testing)"
Rails.logger.info "  • Empty Project Template (#{empty_job.tasks.count} tasks for creation testing)"

Rails.logger.info "\n🔑 Test User Login Credentials:"
test_users.each do |role, attrs|
  Rails.logger.info "  #{attrs[:name]} (#{attrs[:role]}): #{attrs[:email]} / password123"
end

Rails.logger.info "\n🚀 Ready for comprehensive TaskList testing!"
