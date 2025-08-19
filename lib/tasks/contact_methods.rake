require 'csv'

namespace :contact_methods do
  desc "Detect duplicate contact methods per person"
  task detect_duplicates: :environment do
    puts "🔍 Detecting duplicate contact methods..."
    
    # Track duplicates found
    duplicate_groups = []
    total_contacts = ContactMethod.count
    processed = 0
    
    puts "📊 Processing #{total_contacts} contact methods..."
    
    # Group contact methods by person and contact_type
    ContactMethod.includes(:person).find_in_batches(batch_size: 1000) do |batch|
      batch_groups = {}
      
      batch.each do |contact_method|
        processed += 1
        
        # Skip if no value to normalize
        next if contact_method.value.blank?
        
        # Normalize the value using the model's logic
        normalized = ContactMethod.normalize(contact_method.value, contact_method.contact_type)
        next if normalized.blank?
        
        # Create grouping key: person_id + contact_type + normalized_value
        key = "#{contact_method.person_id}:#{contact_method.contact_type}:#{normalized}"
        
        batch_groups[key] ||= []
        batch_groups[key] << {
          id: contact_method.id,
          person_id: contact_method.person_id,
          person_name: contact_method.person&.name || "Unknown",
          contact_type: contact_method.contact_type,
          value: contact_method.value,
          normalized: normalized
        }
      end
      
      # Find groups with more than one contact method (duplicates)
      batch_groups.each do |key, contacts|
        if contacts.length > 1
          duplicate_groups << contacts
        end
      end
      
      print "\r⏳ Processed #{processed}/#{total_contacts} (#{(processed.to_f / total_contacts * 100).round(1)}%)"
    end
    
    puts "\n\n📋 Analysis Complete!"
    puts "🔍 Found #{duplicate_groups.length} duplicate groups affecting #{duplicate_groups.sum(&:length)} contact methods"
    
    if duplicate_groups.empty?
      puts "✅ No duplicates found! All contact methods are unique per person."
      return
    end
    
    # Generate CSV report
    timestamp = Time.current.strftime("%Y-%m-%d_%H%M%S")
    csv_path = Rails.root.join("tmp", "duplicate_contact_methods_#{timestamp}.csv")
    
    # Ensure tmp directory exists
    FileUtils.mkdir_p(Rails.root.join("tmp"))
    
    puts "\n📝 Generating CSV report..."
    
    CSV.open(csv_path, "w", headers: true) do |csv|
      # Write header
      csv << [
        "duplicate_group",
        "person_id", 
        "person_name", 
        "contact_type", 
        "contact_method_id",
        "original_value", 
        "normalized_value",
        "duplicate_count"
      ]
      
      # Write duplicate data
      duplicate_groups.each_with_index do |group, group_index|
        group_id = "group_#{group_index + 1}"
        duplicate_count = group.length
        
        group.each do |contact|
          csv << [
            group_id,
            contact[:person_id],
            contact[:person_name],
            contact[:contact_type],
            contact[:id],
            contact[:value],
            contact[:normalized],
            duplicate_count
          ]
        end
      end
    end
    
    puts "✅ CSV report generated: #{csv_path}"
    puts "\n📊 Summary:"
    puts "   • Total duplicate groups: #{duplicate_groups.length}"
    puts "   • Total duplicate contact methods: #{duplicate_groups.sum(&:length)}"
    
    # Show breakdown by contact type
    type_breakdown = duplicate_groups.flat_map(&:itself).group_by { |c| c[:contact_type] }
    type_breakdown.each do |type, contacts|
      puts "   • #{type.capitalize} duplicates: #{contacts.length}"
    end
    
    puts "\n🎯 Next Steps:"
    puts "   1. Review the CSV report for duplicate resolution strategy"
    puts "   2. CTO review required before implementing constraints"
    puts "   3. Consider which duplicates to merge vs. delete"
    puts "\n📁 Report saved to: #{csv_path}"
  end
  
  desc "Show duplicate detection statistics without generating report"
  task stats: :environment do
    puts "📊 Quick duplicate statistics..."
    
    duplicate_count = 0
    total_contacts = ContactMethod.count
    
    # Use find_in_batches without select to avoid cursor issues
    ContactMethod.find_in_batches(batch_size: 1000) do |batch|
      batch_groups = {}
      
      batch.each do |contact_method|
        next if contact_method.value.blank?
        
        normalized = ContactMethod.normalize(contact_method.value, contact_method.contact_type)
        next if normalized.blank?
        
        key = "#{contact_method.person_id}:#{contact_method.contact_type}:#{normalized}"
        batch_groups[key] ||= 0
        batch_groups[key] += 1
      end
      
      duplicate_count += batch_groups.values.count { |count| count > 1 }
    end
    
    puts "📋 Quick Stats:"
    puts "   • Total contact methods: #{total_contacts}"
    puts "   • Estimated duplicate groups: #{duplicate_count}"
    puts "\n💡 Run 'rake contact_methods:detect_duplicates' for detailed report"
  end
  
  desc "Backfill normalized_value for existing contact methods"
  task backfill_normalized: :environment do
    puts "🚀 Starting ContactMethod normalized_value backfill..."
    puts "📅 Started at: #{Time.current}"
    
    # Initialize counters
    total_records = ContactMethod.where(normalized_value: nil).count
    processed = 0
    successful = 0
    failed = 0
    skipped = 0
    failed_records = []
    
    puts "📊 Found #{total_records} records to backfill"
    
    if total_records == 0
      puts "✅ No records need backfilling. All ContactMethod records already have normalized_value."
      next
    end
    
    start_time = Time.current
    batch_size = 500
    
    puts "⚙️  Processing in batches of #{batch_size}..."
    puts "━" * 80
    
    # Process records in batches for memory efficiency
    ContactMethod.where(normalized_value: nil).find_in_batches(batch_size: batch_size) do |batch|
      batch_start_time = Time.current
      batch_successful = 0
      batch_failed = 0
      batch_skipped = 0
      
      batch.each do |contact_method|
        processed += 1
        
        begin
          # Skip if value is blank
          if contact_method.value.blank?
            skipped += 1
            batch_skipped += 1
            next
          end
          
          # Skip if contact_type is blank (shouldn't happen but be safe)
          if contact_method.contact_type.blank?
            failed += 1
            batch_failed += 1
            failed_records << {
              id: contact_method.id,
              error: "Missing contact_type",
              value: contact_method.value,
              person_id: contact_method.person_id
            }
            next
          end
          
          # Use model's normalization logic for consistency
          normalized = ContactMethod.normalize(contact_method.value, contact_method.contact_type)
          
          if normalized.blank?
            failed += 1
            batch_failed += 1
            failed_records << {
              id: contact_method.id,
              error: "Normalization returned blank value",
              value: contact_method.value,
              contact_type: contact_method.contact_type,
              person_id: contact_method.person_id
            }
            next
          end
          
          # Update the normalized_value directly to avoid callbacks
          # This prevents potential validation issues and is more efficient
          contact_method.update_column(:normalized_value, normalized)
          
          successful += 1
          batch_successful += 1
          
        rescue => e
          failed += 1
          batch_failed += 1
          failed_records << {
            id: contact_method.id,
            error: e.message,
            value: contact_method.value,
            contact_type: contact_method.contact_type,
            person_id: contact_method.person_id
          }
        end
      end
      
      batch_duration = Time.current - batch_start_time
      progress_percentage = (processed.to_f / total_records * 100).round(1)
      
      puts "📦 Batch complete: #{batch_successful} success, #{batch_failed} failed, #{batch_skipped} skipped (#{batch_duration.round(2)}s)"
      puts "📊 Progress: #{processed}/#{total_records} (#{progress_percentage}%)"
      
      # Show ETA if we have enough data
      if processed >= batch_size
        elapsed = Time.current - start_time
        rate = processed / elapsed
        remaining = total_records - processed
        eta_seconds = remaining / rate
        eta_time = Time.current + eta_seconds
        puts "⏰ ETA: #{eta_time.strftime('%H:%M:%S')} (#{eta_seconds.round(0)}s remaining)"
      end
      
      puts "━" * 80
    end
    
    total_duration = Time.current - start_time
    
    puts "\n🎉 Backfill Complete!"
    puts "📅 Finished at: #{Time.current}"
    puts "⏱️  Total duration: #{total_duration.round(2)} seconds"
    puts "\n📊 Final Summary:"
    puts "   • Total processed: #{processed}"
    puts "   • Successful: #{successful}"
    puts "   • Failed: #{failed}"
    puts "   • Skipped (blank values): #{skipped}"
    puts "   • Processing rate: #{(processed / total_duration).round(1)} records/second"
    
    # Report failed records if any
    if failed_records.any?
      puts "\n❌ Failed Records Details:"
      failed_records.each_with_index do |record, index|
        puts "   #{index + 1}. ID #{record[:id]} (Person: #{record[:person_id]})"
        puts "      Value: '#{record[:value]}'"
        puts "      Type: #{record[:contact_type]}"
        puts "      Error: #{record[:error]}"
        puts ""
      end
      
      # Generate CSV report for failed records
      timestamp = Time.current.strftime("%Y-%m-%d_%H%M%S")
      csv_path = Rails.root.join("tmp", "backfill_failed_records_#{timestamp}.csv")
      
      # Ensure tmp directory exists
      FileUtils.mkdir_p(Rails.root.join("tmp"))
      
      require 'csv'
      CSV.open(csv_path, "w", headers: true) do |csv|
        csv << ["contact_method_id", "person_id", "contact_type", "original_value", "error_message"]
        
        failed_records.each do |record|
          csv << [
            record[:id],
            record[:person_id],
            record[:contact_type],
            record[:value],
            record[:error]
          ]
        end
      end
      
      puts "📁 Failed records report saved to: #{csv_path}"
    end
    
    # Verify backfill success
    remaining_null = ContactMethod.where(normalized_value: nil).count
    puts "\n🔍 Verification:"
    puts "   • Records still with null normalized_value: #{remaining_null}"
    
    if remaining_null == 0
      puts "✅ All records successfully backfilled!"
      puts "\n🎯 Next Step: Run 'rake contact_methods:add_not_null_constraint' to add NOT NULL constraint"
    else
      puts "⚠️  Some records still have null normalized_value. Review failed records before proceeding."
    end
  end
  
  desc "Add NOT NULL constraint to normalized_value after backfill"
  task add_not_null_constraint: :environment do
    puts "🔒 Adding NOT NULL constraint to ContactMethod.normalized_value..."
    
    # First verify all records have normalized_value
    null_count = ContactMethod.where(normalized_value: nil).count
    
    if null_count > 0
      puts "❌ Cannot add NOT NULL constraint!"
      puts "   Found #{null_count} records with null normalized_value"
      puts "   Run 'rake contact_methods:backfill_normalized' first"
      exit 1
    end
    
    puts "✅ All records have normalized_value. Safe to add constraint."
    
    begin
      # Add NOT NULL constraint
      ActiveRecord::Migration.connection.execute(
        "ALTER TABLE contact_methods ALTER COLUMN normalized_value SET NOT NULL"
      )
      
      puts "✅ NOT NULL constraint added successfully!"
      puts "🔍 Verification: Testing constraint..."
      
      # Test the constraint by trying to insert a null value (should fail)
      begin
        # Get a valid person_id to use for testing
        test_person_id = Person.first&.id || "00000000-0000-0000-0000-000000000000"
        
        ActiveRecord::Migration.connection.execute(
          "INSERT INTO contact_methods (person_id, contact_type, value, normalized_value, created_at, updated_at) VALUES ('#{test_person_id}', 'email', 'test@example.com', NULL, NOW(), NOW())"
        )
        puts "❌ ERROR: Constraint test failed - null value was accepted!"
        exit 1
      rescue ActiveRecord::NotNullViolation
        puts "✅ Constraint test passed - null values properly rejected"
        
        # Clean up the failed insert (it shouldn't exist, but just in case)
        ActiveRecord::Migration.connection.execute(
          "DELETE FROM contact_methods WHERE value = 'test@example.com' AND person_id = '#{test_person_id}'"
        )
      end
      
      puts "\n🎉 NOT NULL constraint successfully added and verified!"
      puts "📊 ContactMethod.normalized_value is now required for all records"
      
    rescue => e
      puts "❌ Failed to add NOT NULL constraint: #{e.message}"
      puts "   This might be a database-specific issue. Check your database logs."
      exit 1
    end
  end
  
  desc "Show backfill status and statistics"
  task backfill_status: :environment do
    puts "📊 ContactMethod normalized_value backfill status"
    puts "━" * 50
    
    total_records = ContactMethod.count
    null_records = ContactMethod.where(normalized_value: nil).count
    populated_records = total_records - null_records
    
    puts "📈 Overall Statistics:"
    puts "   • Total ContactMethod records: #{total_records}"
    puts "   • Records with normalized_value: #{populated_records}"
    puts "   • Records with null normalized_value: #{null_records}"
    
    if total_records > 0
      completion_percentage = (populated_records.to_f / total_records * 100).round(1)
      puts "   • Backfill completion: #{completion_percentage}%"
    end
    
    puts "\n📋 Status by Contact Type:"
    ContactMethod.group(:contact_type).count.each do |contact_type, total_count|
      null_for_type = ContactMethod.where(contact_type: contact_type, normalized_value: nil).count
      populated_for_type = total_count - null_for_type
      
      puts "   • #{contact_type.capitalize}: #{populated_for_type}/#{total_count} completed"
    end
    
    if null_records == 0
      puts "\n✅ Backfill is complete! All records have normalized_value."
      
      # Check if NOT NULL constraint exists
      constraint_exists = ActiveRecord::Migration.connection.execute(
        "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'contact_methods' AND column_name = 'normalized_value'"
      ).first&.dig('is_nullable') == 'NO'
      
      if constraint_exists
        puts "✅ NOT NULL constraint is in place."
      else
        puts "⚠️  NOT NULL constraint not yet added. Run 'rake contact_methods:add_not_null_constraint'"
      end
    elsif null_records > 0
      puts "\n⚠️  Backfill incomplete. Run 'rake contact_methods:backfill_normalized' to complete."
    end
  end
end