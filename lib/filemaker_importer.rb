require "nokogiri"

class FilemakerImporter
  def initialize
    @field_map = {}
    @errors = []
    @warnings = []
    @import_user = nil
    @job_id_mappings = {} # Track merged job ID mappings
    @original_job_mappings = {} # Track original job assignments from backup
  end

  def import_user
    @import_user ||= find_or_create_import_user
  end

  # Import all data files in the correct order
  def import_all
    puts "Starting complete FileMaker import..."

    # Import in dependency order
    clients_count = import_clients(Rails.root.join("FMPClients.xml"))
    puts "✓ Imported #{clients_count} clients"

    # Import people (enhanced data) after clients but before jobs
    people_count = import_people(Rails.root.join("FMPPeople.xml"))
    puts "✓ Imported #{people_count} people with departments"

    jobs_count = import_jobs(Rails.root.join("FMPCases.xml"))
    puts "✓ Imported #{jobs_count} jobs"

    # The job import will have populated @job_id_mappings
    # which will be used by the task import
    tasks_count = import_tasks(Rails.root.join("FMPTasks.xml"))
    puts "✓ Imported #{tasks_count} tasks"

    contacts_count = import_contacts(Rails.root.join("FMPContactInfo.xml"))
    puts "✓ Imported #{contacts_count} contact methods"

    # Clean up any empty Legacy Tasks jobs after all imports are done
    cleanup_empty_legacy_jobs

    puts "\nFileMaker import complete!"

    {
      clients: clients_count,
      people: people_count,
      jobs: jobs_count,
      tasks: tasks_count,
      contacts: contacts_count
    }
  end

  def find_or_create_import_user
    user = User.find_by(email: "oliver@faultless.tech")
    unless user
      user = User.create!(
        email: "oliver@faultless.tech",
        name: "Oliver",
        password: SecureRandom.hex(16), # Random password since we won't log in as this user
        role: "technician",
        created_at: Time.current,
        updated_at: Time.current
      )
      puts "Created import user: Oliver (oliver@faultless.tech)"
    end
    user
  end

  def import_clients(xml_file)
    count = 0

    ActiveRecord::Base.transaction do
      parse_xml(xml_file) do |row|
        begin
          client_id = extract_field(row, "PrimaryKey")

          # Skip if already exists
          if Client.exists?(id: client_id)
            @warnings << "Client #{client_id} already exists, skipping"
            next
          end

          # Determine client type based on Type field or name analysis
          full_name = extract_field(row, "Full Name")
          type_field = extract_field(row, "Type")

          # If Type field is empty, determine from the name
          if type_field.blank?
            client_type = is_company_name?(full_name) ? "business" : "residential"
          else
            client_type = map_client_type(type_field)
          end

          client = Client.create!(
            id: client_id,
            name: full_name,
            client_type: client_type,
            created_at: parse_timestamp(extract_field(row, "CreationTimestamp")),
            updated_at: parse_timestamp(extract_field(row, "ModificationTimestamp"))
          )

          # Extract and create person with contact info
          create_person_from_client_data(row, client)

          count += 1
        rescue => e
          @errors << "Error importing client: #{e.message}"
          # Don't rollback - just skip this client
        end
      end
    end

    print_summary("Clients", count)
    count
  end

  def import_people(xml_file)
    count = 0
    departments_created = {}

    # Skip if file doesn't exist
    unless File.exist?(xml_file)
      puts "Warning: #{xml_file} not found, skipping people import"
      return 0
    end

    ActiveRecord::Base.transaction do
      parse_xml(xml_file) do |row|
        begin
          person_id = extract_field(row, "PrimaryKey")
          client_id = extract_field(row, "ID of Client")

          # Skip if no client association
          unless client_id.present?
            @warnings << "Person #{person_id} has no client ID, skipping"
            next
          end

          # Skip if client doesn't exist
          unless Client.exists?(id: client_id)
            @warnings << "Client #{client_id} not found for person #{person_id}, skipping"
            next
          end

          # Extract name fields
          name_full = extract_field(row, "Name Full")
          name_preferred = extract_field(row, "Name Preferred")
          name_first = extract_field(row, "Name First")
          name_remainder = extract_field(row, "Name Remainder") # Last name

          # Use full name, or build from parts
          person_name = name_full.presence ||
                       [ name_first, name_remainder ].compact.join(" ").presence ||
                       name_preferred.presence ||
                       "Unknown Person"

          # Check if person already exists by ID
          existing_person = Person.find_by(id: person_id)

          if existing_person
            # Skip if person exists but for different client (data integrity issue)
            if existing_person.client_id != client_id
              @warnings << "Person #{person_id} exists but for different client (#{existing_person.client_id} vs #{client_id}), skipping"
              next
            end

            # Update existing person with FileMaker data
            existing_person.update!(
              name: person_name,
              name_preferred: name_preferred,
              name_pronunciation_hint: extract_field(row, "Pronunciation of Name"),
              is_active: extract_field(row, "Status") == "Active",
              title: extract_field(row, "Title"),
              updated_at: parse_timestamp(extract_field(row, "ModificationTimestamp"))
            )
            person = existing_person
          else
            # Check if a person with this name already exists for this client
            # (may have been created during client import)
            existing_by_name = Person.where(client_id: client_id)
                                    .where("lower(name) = lower(?)", person_name)
                                    .first

            if existing_by_name
              # Update existing person data (can't change ID)
              existing_by_name.update!(
                name_preferred: name_preferred,
                name_pronunciation_hint: extract_field(row, "Pronunciation of Name"),
                is_active: extract_field(row, "Status") == "Active",
                title: extract_field(row, "Title"),
                updated_at: parse_timestamp(extract_field(row, "ModificationTimestamp"))
              )
              person = existing_by_name
              @warnings << "Person #{person_id} already exists as #{existing_by_name.id} for client #{client_id}, updated data"
            else
              # Create new person
              person = Person.create!(
                id: person_id,
                client_id: client_id,
                name: person_name,
                name_preferred: name_preferred,
                name_pronunciation_hint: extract_field(row, "Pronunciation of Name"),
                is_active: extract_field(row, "Status") == "Active",
                title: extract_field(row, "Title"),
                created_at: parse_timestamp(extract_field(row, "CreationTimestamp")),
                updated_at: parse_timestamp(extract_field(row, "ModificationTimestamp"))
              )
            end
          end

          # Handle department/group assignment
          department_name = extract_field(row, "ID of Department")
          if department_name.present? && person.present?
            # Find or create the department as a PeopleGroup
            client = Client.find(client_id)
            department = departments_created[department_name] ||= PeopleGroup.find_or_create_by!(
              client_id: client_id,
              name: department_name,
              is_department: true
            )

            # Add person to department if not already a member
            unless person.people_groups.include?(department)
              PeopleGroupMembership.create!(
                person: person,
                people_group: department
              )
            end
          end

          # Note: Skipping notes field from FMPPeople.xml per user request

          count += 1
        rescue => e
          @errors << "Error importing person #{person_id}: #{e.message}"
          # Don't rollback - just skip this person
        end
      end
    end

    # Report on departments created
    if departments_created.any?
      puts "  → Created/updated #{departments_created.size} departments: #{departments_created.keys.join(', ')}"
    end

    print_summary("People", count)
    count
  end

  def import_jobs(xml_file)
    count = 0

    ActiveRecord::Base.transaction do
      parse_xml(xml_file) do |row|
        begin
          job_id = extract_field(row, "PrimaryKey")

          # Skip if already exists
          if Job.exists?(id: job_id)
            @warnings << "Job #{job_id} already exists, skipping"
            next
          end

          job_type = extract_field(row, "Job Type")

          # Determine if this is a job, case, or proposal
          status = map_job_status(extract_field(row, "Status"))

          # Ensure job has a title
          title = extract_field(row, "Title")
          if title.blank?
            # Try to use description as title, or generate a default
            description = extract_field(row, "Description")
            if description.present?
              title = description.truncate(100)
            else
              title = "Untitled Job (#{job_type || 'Unknown Type'})"
            end
            @warnings << "Job #{job_id} has no title, using: #{title}"
          end

          job = Job.create!(
            id: job_id,
            title: title,
            client_id: extract_field(row, "Client ID"),
            status: status,
            priority: map_priority(extract_field(row, "Priority")),
            description: extract_field(row, "Description"),
            due_at: parse_date(extract_field(row, "Due Date")),
            due_time_set: extract_field(row, "Due Time").present?,
            created_at: parse_timestamp(extract_field(row, "CreationTimestamp")),
            updated_at: parse_timestamp(extract_field(row, "ModificationTimestamp"))
          )

          # Skip job assignments for now (no notes for jobs)
          # technician = extract_field(row, 'Technician')

          count += 1
        rescue => e
          @errors << "Error importing job #{job_id}: #{e.message}"
          # Don't rollback - just skip this job
        end
      end

      # After importing all jobs, merge duplicate "Legacy Tasks" jobs per client
      merge_duplicate_legacy_tasks_jobs
    end

    print_summary("Jobs", count)
    count
  end

  def import_tasks(xml_file)
    count = 0
    parent_tasks = {}
    legacy_jobs = {} # Cache for legacy jobs per client
    orphaned_count = 0
    orphaned_subtasks = [] # Store subtasks that need parent job inheritance
    subtask_inherited = 0
    restored_count = 0

    # Load original job mappings from backup file if it exists
    backup_file = Rails.root.join("FMPTasksBackup")
    if File.exist?(backup_file)
      puts "Loading original job assignments from backup file..."
      load_original_job_mappings(backup_file)
      puts "  → Loaded #{@original_job_mappings.size} task-to-job mappings from backup"
    else
      puts "Warning: No backup file found at #{backup_file}"
    end

    ActiveRecord::Base.transaction do
      # First pass: Create all tasks without parent relationships
      parse_xml(xml_file) do |row|
        begin
          task_id = extract_field(row, "PrimaryKey")

          # Skip if already exists
          if Task.exists?(id: task_id)
            @warnings << "Task #{task_id} already exists, skipping"
            next
          end

          job_id = extract_field(row, "Job ID")
          parent_id = extract_field(row, "Parent Task ID")

          # Special handling for the problematic catch-all job
          # This job contained tasks for 239 different clients that need to be redistributed
          if job_id&.upcase == "DFE87385-A953-46DE-A4A3-CA6A0C868833"
            # First try to restore to original job from backup
            original_job_id = @original_job_mappings[task_id&.upcase]

            if original_job_id.present? && Job.exists?(id: original_job_id)
              job_id = original_job_id
              restored_count += 1
              @warnings << "Task '#{extract_field(row, 'Title')}' restored to original job from backup"
            else
              # Fall back to Legacy Tasks for the client
              client_id = extract_field(row, "Client ID")
              if client_id.present?
                # Find or create "Legacy Tasks" job for this task's actual client
                job_id = find_or_create_legacy_job(client_id, legacy_jobs)
                orphaned_count += 1
                @warnings << "Task '#{extract_field(row, 'Title')}' from catch-all job reassigned to client #{client_id}'s Legacy Tasks"
              else
                @errors << "Task '#{extract_field(row, 'Title')}' from catch-all job has no client ID, skipping"
                next
              end
            end
          end

          # Check if this job was merged and map to the new job ID
          if job_id.present? && @job_id_mappings[job_id.downcase]
            original_job_id = job_id
            job_id = @job_id_mappings[job_id.downcase]
          end

          # Handle tasks with no job
          if job_id.blank?
            client_id = extract_field(row, "Client ID")

            if client_id.present?
              # Find or create "Legacy Tasks" job for this client
              job_id = find_or_create_legacy_job(client_id, legacy_jobs)
              orphaned_count += 1
              @warnings << "Task '#{extract_field(row, 'Title')}' had no job, assigned to Legacy Tasks for client #{client_id}"
            elsif parent_id.present?
              # This is a subtask without direct job/client - store for third pass
              # Extract all the data we need now while @field_map is valid
              orphaned_subtasks << {
                task_id: task_id,
                parent_id: parent_id,
                title: extract_field(row, "Title"),
                description: extract_field(row, "Description"),
                status: extract_field(row, "Status"),
                sort_index: extract_field(row, "SortIndex"),
                notes: extract_field(row, "Notes"),
                created_at: extract_field(row, "CreationTimestamp"),
                updated_at: extract_field(row, "ModificationTimestamp")
              }
              next # Skip creating the task for now
            else
              @errors << "Task '#{extract_field(row, 'Title')}' has no job, client, or parent, skipping"
              next
            end
          end

          # Combine title and description for the task title if description exists
          title = extract_field(row, "Title")
          description = extract_field(row, "Description")

          # Skip tasks with no title and no description
          if title.blank? && description.blank?
            @warnings << "Task #{task_id} has no title or description, skipping"
            next
          end

          # Use description as title if title is blank
          if title.blank?
            title = description
          elsif description.present? && description != title
            title = "#{title} - #{description}"
          end

          task = Task.create!(
            id: task_id,
            title: title,
            status: map_task_status(extract_field(row, "Status")),
            job_id: job_id,
            position: extract_field(row, "SortIndex").to_i || 0,
            created_at: parse_timestamp(extract_field(row, "CreationTimestamp")),
            updated_at: parse_timestamp(extract_field(row, "ModificationTimestamp"))
          )

          # Create a note for the task if notes exist
          notes_content = extract_field(row, "Notes")
          if notes_content.present?
            Note.create!(
              notable: task,
              content: notes_content,
              user: import_user,
              created_at: task.created_at,
              updated_at: task.updated_at
            )
          end

          # Store parent relationship for second pass
          parent_tasks[task_id] = parent_id if parent_id.present?

          count += 1
        rescue => e
          @errors << "Error importing task #{task_id}: #{e.message}"
          # Don't rollback - just skip this task
        end
      end

      # Second pass: Update parent relationships
      parent_tasks.each do |task_id, parent_id|
        begin
          task = Task.find(task_id)
          task.update!(parent_id: parent_id)
        rescue => e
          @warnings << "Could not set parent for task #{task_id}: #{e.message}"
        end
      end

      # Third pass: Create orphaned subtasks with inherited job_id
      orphaned_subtasks.each do |subtask_data|
        begin
          parent_task = Task.find_by(id: subtask_data[:parent_id])

          if parent_task && parent_task.job_id.present?
            # Combine title and description for the task title if description exists
            title = subtask_data[:title]
            description = subtask_data[:description]

            # Skip subtasks with no title and no description
            if title.blank? && description.blank?
              @warnings << "Subtask #{subtask_data[:task_id]} has no title or description, skipping"
              next
            end

            # Use description as title if title is blank
            if title.blank?
              title = description
            elsif description.present? && description != title
              title = "#{title} - #{description}"
            end

            task = Task.create!(
              id: subtask_data[:task_id],
              title: title,
              status: map_task_status(subtask_data[:status]),
              job_id: parent_task.job_id,
              parent_id: subtask_data[:parent_id],
              position: subtask_data[:sort_index].to_i || 0,
              created_at: parse_timestamp(subtask_data[:created_at]),
              updated_at: parse_timestamp(subtask_data[:updated_at])
            )

            # Create a note for the task if notes exist
            if subtask_data[:notes].present?
              Note.create!(
                notable: task,
                content: subtask_data[:notes],
                user: import_user,
                created_at: task.created_at,
                updated_at: task.updated_at
              )
            end

            subtask_inherited += 1
            count += 1
          else
            @warnings << "Could not inherit job for subtask '#{subtask_data[:title]}' - parent task not found or has no job"
          end
        rescue => e
          @errors << "Error importing orphaned subtask #{subtask_data[:task_id]}: #{e.message}"
        end
      end

      # Report on orphaned and restored tasks
      if restored_count > 0
        puts "\n✨ Restored Tasks: #{restored_count} tasks were restored to their original jobs from backup"
      end

      if orphaned_count > 0
        puts "📋 Orphaned Tasks: #{orphaned_count} tasks were assigned to 'Legacy Tasks' jobs"
      end

      if subtask_inherited > 0
        puts "📎 Subtasks: #{subtask_inherited} subtasks inherited job from their parent task"
      end

      if orphaned_subtasks.size > subtask_inherited
        puts "⚠️  Warning: #{orphaned_subtasks.size - subtask_inherited} subtasks could not be imported"
      end

      # Sort and position tasks within each job
      puts "\n🔄 Sorting tasks within jobs..."
      jobs_sorted = sort_and_position_tasks_for_jobs
      puts "  → Sorted tasks in #{jobs_sorted} jobs"
    end

    print_summary("Tasks", count)
    count
  end

  def import_contacts(xml_file)
    count = 0

    ActiveRecord::Base.transaction do
      parse_xml(xml_file) do |row|
        begin
          contact_id = extract_field(row, "PrimaryKey")
          person_id = extract_field(row, "ID of Person")
          client_id = extract_field(row, "ID of Client")

          # Skip if already exists
          if ContactMethod.exists?(id: contact_id)
            @warnings << "Contact #{contact_id} already exists, skipping"
            next
          end

          # Find person - use person_id if present, otherwise fall back to client's first person
          person = nil

          if person_id.present?
            person = Person.find_by(id: person_id)
            unless person
              @warnings << "Person #{person_id} not found for contact #{contact_id}, skipping"
              next
            end
          elsif client_id.present?
            # No person_id provided, find or create first person for this client
            person = find_or_create_person_for_client(client_id)
          end

          next unless person

          contact_type = map_contact_type(extract_field(row, "Data Type"))
          value = extract_field(row, "Data")
          formatted_value = extract_field(row, "Data Formatted")

          ContactMethod.create!(
            id: contact_id,
            person_id: person.id,
            contact_type: contact_type,
            value: value,
            formatted_value: formatted_value.presence || value,
            created_at: parse_timestamp(extract_field(row, "CreationTimestamp")),
            updated_at: parse_timestamp(extract_field(row, "ModificationTimestamp"))
          )

          count += 1
        rescue => e
          @errors << "Error importing contact #{contact_id}: #{e.message}"
          # Don't rollback - just skip this contact
        end
      end
    end

    print_summary("Contact Methods", count)
    count
  end

  private

  def sort_and_position_tasks_for_jobs
    # Define status sort order based on your requirements
    # Lower numbers = higher priority (appear first)
    status_priority = {
      "in_progress" => 1,
      "paused" => 2,
      "new_task" => 4,  # "New" status
      # "Postponed" maps to "paused" in map_task_status, so gets priority 2
      # "Assumed Completed" maps to "successfully_completed"
      "successfully_completed" => 6,
      # "Failed" maps to "cancelled" in map_task_status
      "cancelled" => 8
    }

    # Get the original status from FileMaker for more granular sorting
    # We'll need to track this during import, for now use the mapped status

    jobs_processed = 0

    # Process each job's tasks
    Job.includes(:tasks).find_each do |job|
      next if job.tasks.empty?

      # Sort tasks according to the requirements
      sorted_tasks = job.tasks.sort do |a, b|
        # First sort by status priority
        a_priority = status_priority[a.status] || 99
        b_priority = status_priority[b.status] || 99

        if a_priority != b_priority
          a_priority <=> b_priority
        else
          # Then by position (which has the original SortIndex)
          # Note: During import we stored SortIndex in position field
          if a.position != b.position
            a.position <=> b.position
          else
            # Then by created_at (CreationTimestamp)
            if a.created_at != b.created_at
              a.created_at <=> b.created_at
            else
              # Finally by id (PrimaryKey)
              a.id <=> b.id
            end
          end
        end
      end

      # Update positions starting at 10000, incrementing by 10000
      position = 10000
      sorted_tasks.each do |task|
        task.update_column(:position, position)
        position += 10000
      end

      jobs_processed += 1
    end

    jobs_processed
  end

  def load_original_job_mappings(backup_file)
    doc = Nokogiri::XML(File.open(backup_file))

    # Build field map for backup file
    backup_field_map = {}
    doc.xpath("//xmlns:METADATA/xmlns:FIELD", "xmlns" => "http://www.filemaker.com/fmpxmlresult").each_with_index do |field, index|
      backup_field_map[field["NAME"]] = index
    end

    # Process each task in the backup to get original job assignments
    doc.xpath("//xmlns:RESULTSET/xmlns:ROW", "xmlns" => "http://www.filemaker.com/fmpxmlresult").each do |row|
      cols = row.xpath("xmlns:COL/xmlns:DATA", "xmlns" => "http://www.filemaker.com/fmpxmlresult")

      # Get task ID and job ID from backup
      task_id_idx = backup_field_map["PrimaryKey"]
      job_id_idx = backup_field_map["Job ID"]

      if task_id_idx && job_id_idx
        task_id = cols[task_id_idx]&.text&.strip
        job_id = cols[job_id_idx]&.text&.strip

        # Store the mapping if both IDs are present and job is not the problematic one
        if task_id.present? && job_id.present? && job_id.upcase != "DFE87385-A953-46DE-A4A3-CA6A0C868833"
          @original_job_mappings[task_id.upcase] = job_id.downcase
        end
      end
    end
  rescue => e
    @errors << "Error loading backup file: #{e.message}"
    puts "⚠️  Warning: Could not load backup file: #{e.message}"
  end

  def parse_xml(xml_file)
    doc = Nokogiri::XML(File.open(xml_file))

    # Build field map from metadata
    @field_map = {}
    doc.xpath("//xmlns:METADATA/xmlns:FIELD", "xmlns" => "http://www.filemaker.com/fmpxmlresult").each_with_index do |field, index|
      @field_map[field["NAME"]] = index
    end

    # Process each row
    doc.xpath("//xmlns:RESULTSET/xmlns:ROW", "xmlns" => "http://www.filemaker.com/fmpxmlresult").each do |row|
      yield row
    end
  end

  def extract_field(row, field_name)
    index = @field_map[field_name]
    return nil unless index

    col = row.xpath("xmlns:COL[#{index + 1}]/xmlns:DATA", "xmlns" => "http://www.filemaker.com/fmpxmlresult").first
    col&.text&.strip
  end

  def parse_timestamp(timestamp_str)
    return nil if timestamp_str.blank?

    # FileMaker timestamp format: MM/DD/YYYY HH:MM:SS
    DateTime.strptime(timestamp_str, "%m/%d/%Y %H:%M:%S")
  rescue
    nil
  end

  def parse_date(date_str)
    return nil if date_str.blank?

    # FileMaker date format: MM/DD/YYYY
    Date.strptime(date_str, "%m/%d/%Y")
  rescue
    nil
  end

  def map_client_type(type_str)
    case type_str&.downcase
    when "company", "business", "commercial" then "business"
    when "individual", "person", "residential" then "residential"
    else "residential" # Default to residential for individuals
    end
  end

  def map_job_status(status_str)
    case status_str&.downcase
    when "active", "open", "new" then "open"
    when "in progress", "working", "started" then "in_progress"
    when "completed", "done", "closed", "finished" then "successfully_completed"
    when "cancelled", "canceled" then "cancelled"
    when "on hold", "paused", "hold" then "paused"
    when "waiting", "pending" then "waiting_for_customer"
    when "scheduled" then "waiting_for_scheduled_appointment"
    when "proposal", "quote", "estimate" then "open" # Proposals become open jobs
    else "open"
    end
  end

  def map_task_status(status_str)
    case status_str&.downcase
    when "pending", "not started", "todo", "new" then "new_task"
    when "in progress", "active", "working", "started" then "in_progress"
    when "completed", "done", "finished", "successfully completed" then "successfully_completed"
    when "paused", "on hold", "hold" then "paused"
    when "cancelled", "canceled", "failed" then "cancelled"
    when "postponed" then "paused"
    when "assumed completed" then "successfully_completed"
    else "new_task"
    end
  end

  def map_priority(priority_str)
    case priority_str&.downcase
    when "low", "1" then "low"
    when "medium", "normal", "2", "standard" then "normal"
    when "high", "3" then "high"
    when "very high", "very_high", "4" then "very_high"
    when "urgent", "critical", "5" then "critical"
    when "proactive", "followup" then "proactive_followup"
    else "normal"
    end
  end

  def map_contact_type(type_str)
    case type_str&.downcase
    when "email", "e-mail" then "email"
    when "phone", "telephone", "mobile", "cell" then "phone"
    when "address", "location" then "address"
    else "address" # Default to address for unknown types
    end
  end

  def create_person_from_client_data(row, client)
    # Extract full name from client row
    full_name = extract_field(row, "Full Name")

    return unless full_name.present?

    # Parse the full name to extract people
    people_data = parse_full_name(full_name)

    # Safety check - ensure people_data is an array
    return unless people_data && people_data.is_a?(Array) && people_data.any?

    # Create Person records for each extracted name
    people_data.each_with_index do |person_data, index|
      # Combine first and last name into single name field
      name_parts = []
      name_parts << person_data[:first_name] if person_data[:first_name].present?
      name_parts << person_data[:last_name] if person_data[:last_name].present?
      full_name = name_parts.join(" ").strip

      # Skip if no name
      next if full_name.blank?

      Person.create!(
        client_id: client.id,
        name: full_name,
        title: person_data[:title],
        is_active: true,
        created_at: client.created_at,
        updated_at: client.updated_at
      )
    end

    # Note: We don't extract contact methods here - they come from FMPContactInfo.xml
  end

  def parse_full_name(full_name)
    people = []

    # Clean up the name
    name = full_name.strip

    # Handle company names (these usually don't have person names)
    if is_company_name?(name)
      # For companies, create a generic primary contact
      people << { first_name: "Primary", last_name: "Contact", title: nil }
      return people
    end

    # Remove company affiliations (e.g., "Ann Strawser with BlackRock" -> "Ann Strawser")
    name = name.gsub(/\s+with\s+.+$/i, "").strip

    # Handle couples with & or "and"
    if name.include?(" & ") || name.match(/\s+and\s+/i)
      # Split on & or "and"
      names = name.split(/\s+(?:&|and)\s+/i)

      # Check if the last name has a shared last name (e.g., "Kat & John Molinari")
      shared_last_name = nil
      if names.length == 2
        # Remove nicknames temporarily for parsing
        first_clean = names[0].strip.gsub(/\s*\([^)]+\)\s*/, " ").strip
        second_clean = names[1].strip.gsub(/\s*\([^)]+\)\s*/, " ").strip

        # Check if second name has more parts than the first
        first_parts = first_clean.split(/\s+/)
        second_parts = second_clean.split(/\s+/)

        # If first has 1 part and second has 2+ parts, likely shared last name
        if first_parts.length == 1 && second_parts.length >= 2
          shared_last_name = second_parts.last
          # Add shared last name to first person (keeping original with nickname)
          names[0] = "#{names[0].strip} #{shared_last_name}"
        end
      end

      names.each do |individual_name|
        person_data = parse_individual_name(individual_name.strip)
        people << person_data if person_data
      end
    else
      # Single person
      person_data = parse_individual_name(name)
      people << person_data if person_data
    end

    # Return at least a primary contact if we couldn't parse anything
    if people.empty?
      people << { first_name: "Primary", last_name: "Contact", title: nil }
    end

    people
  end

  def parse_individual_name(name)
    return nil if name.blank?

    # Extract nickname if present (e.g., Amanda "Mandy" Egron)
    nickname = nil
    if name =~ /"([^"]+)"/
      nickname = $1
      name = name.gsub(/"[^"]+"/, "").strip
    end

    # Extract title if present (Dr., Mr., Mrs., etc.)
    title = nil
    if name =~ /^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)\s+/i
      title = $1
      name = name.gsub(/^#{Regexp.escape(title)}\s+/i, "").strip
    end

    # Split the remaining name into parts
    name_parts = name.split(/\s+/)

    if name_parts.empty?
      return nil
    elsif name_parts.size == 1
      # Only one name part - use as last name
      first_name = nil
      last_name = name_parts[0]
    elsif name_parts.size == 2
      # Standard first and last name
      first_name = name_parts[0]
      last_name = name_parts[1]
    else
      # Multiple parts - assume first part is first name, rest is last name
      # This handles cases like "Mary Jo Smith" or "Jean Claude Van Damme"
      first_name = name_parts[0]
      last_name = name_parts[1..-1].join(" ")
    end

    # If we have a nickname but no first name, use the nickname
    if first_name.blank? && nickname.present?
      first_name = nickname
    end

    {
      first_name: first_name,
      last_name: last_name,
      title: title
    }
  end

  def is_company_name?(name)
    # Common patterns that indicate a company rather than a person
    company_keywords = [
      "LLC", "Inc", "Corp", "Corporation", "Company", 'Co\.?',
      "Limited", "Ltd", "Group", "Associates", "Partners",
      "Services", "Solutions", "Consulting", "Technologies",
      "Systems", "Software", "Hardware", "Enterprises",
      "Industries", "Manufacturing", "Distribution",
      "Magazine", "Publishing", "Media", "Broadcasting",
      "Bank", "Financial", "Insurance", "Realty", "Properties",
      "Medical", "Dental", "Clinic", "Hospital", "Healthcare",
      "Restaurant", "Cafe", "Coffee", "Pizza", "Grill",
      "Store", "Shop", "Market", "Boutique", "Gallery",
      "Studio", "Salon", "Spa", "Fitness", "Gym",
      "School", "Academy", "Institute", "University", "College",
      "Church", "Ministry", "Foundation", "Association",
      "BlackRock", "OneStop", "Printing"
    ]

    # Check if name contains any company keywords
    pattern = company_keywords.map { |keyword| "\\b#{keyword}\\b" }.join("|")
    name.match?(/#{pattern}/i)
  end

  def find_or_create_person_for_client(client_id)
    return nil unless client_id.present?

    client = Client.find_by(id: client_id)
    return nil unless client

    # Find existing person or create one
    person = client.people.first

    unless person
      person = Person.create!(
        client_id: client.id,
        name: "Primary Contact",
        is_active: true
      )
    end

    person
  end

  # Removed - not creating notes for jobs
  # def create_job_assignment(job, technician_name)
  # end

  def find_or_create_legacy_job(client_id, cache)
    # Check cache first
    return cache[client_id] if cache[client_id]

    # Check if client exists
    client = Client.find_by(id: client_id)
    unless client
      @errors << "Client #{client_id} not found for orphaned task"
      return nil
    end

    # Find the FIRST existing "Legacy Tasks" job for this client (there might be multiple)
    legacy_job = client.jobs.where(title: "Legacy Tasks").first

    # Create if doesn't exist
    unless legacy_job
      legacy_job = Job.create!(
        client_id: client_id,
        title: "Legacy Tasks",
        description: "Imported tasks from FileMaker that had no associated job. Created during import on #{Date.today}.",
        status: "open",
        priority: "low",
        created_at: Time.current,
        updated_at: Time.current
      )
      puts "  → Created 'Legacy Tasks' job for client: #{client.name}"
    end

    # Cache for future use
    cache[client_id] = legacy_job.id
    legacy_job.id
  end

  def merge_duplicate_legacy_tasks_jobs
    merged_count = 0

    # Find all clients with multiple Legacy Tasks jobs
    clients_with_duplicates = Client.joins(:jobs)
                                    .where(jobs: { title: "Legacy Tasks" })
                                    .group("clients.id")
                                    .having("COUNT(jobs.id) > 1")
                                    .pluck(:id)

    clients_with_duplicates.each do |client_id|
      client = Client.find(client_id)
      # Exclude the problematic catch-all job from merging (it should be empty after redistribution anyway)
      legacy_jobs = client.jobs.where(title: "Legacy Tasks")
                               .where.not(id: "DFE87385-A953-46DE-A4A3-CA6A0C868833")
                               .order(:created_at)

      if legacy_jobs.count > 1
        # Keep the first job (oldest) as the primary
        primary_job = legacy_jobs.first

        # Map ALL Legacy Tasks jobs for this client to the primary one
        # (including the primary to itself for consistency)
        legacy_jobs.each do |job|
          @job_id_mappings[job.id.downcase] = primary_job.id.downcase
        end

        # Now merge the duplicates
        legacy_jobs.offset(1).each do |duplicate_job|
          if primary_job.merge_with!(duplicate_job)
            merged_count += 1
          end
        end
      end
    end

    if merged_count > 0
      puts "\n📋 Merged #{merged_count} duplicate 'Legacy Tasks' jobs"
      puts "   Created #{@job_id_mappings.size} job ID mappings for task import"
    end
  end

  def cleanup_empty_legacy_jobs
    # Clean up empty Legacy Tasks jobs that were created but never got tasks
    empty_legacy_jobs = Job.where(title: "Legacy Tasks").left_joins(:tasks).where(tasks: { id: nil })
    if empty_legacy_jobs.any?
      count = empty_legacy_jobs.count
      empty_legacy_jobs.destroy_all
      puts "\n🧹 Cleaned up #{count} empty Legacy Tasks jobs"
    end
  end

  def print_summary(entity_type, count)
    puts "\n=== #{entity_type} Import Summary ==="
    puts "✓ Successfully imported: #{count}"

    if @warnings.any?
      puts "\n⚠ Warnings (#{@warnings.size}):"
      @warnings.first(5).each { |w| puts "  - #{w}" }
      puts "  ... and #{@warnings.size - 5} more" if @warnings.size > 5
    end

    if @errors.any?
      puts "\n✗ Errors (#{@errors.size}):"
      @errors.first(5).each { |e| puts "  - #{e}" }
      puts "  ... and #{@errors.size - 5} more" if @errors.size > 5
    end

    # Clear for next import
    @warnings.clear
    @errors.clear
  end
end
