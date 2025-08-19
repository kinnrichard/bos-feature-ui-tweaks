namespace :front_conversations do
  desc "Populate people and clients join tables from existing message recipients"
  task populate_joins: :environment do
    puts "🔄 Populating front conversation join tables..."
    puts "📊 Total conversations to process: #{FrontConversation.count}"
    
    start_time = Time.current
    processed = 0
    people_created = 0
    clients_created = 0
    
    FrontConversation.find_in_batches(batch_size: 500) do |conversations|
      conversation_ids = conversations.map(&:id)
      
      # Get all people linked to these conversations via message recipients
      # This single query gets person_id, client_id, and conversation_id
      people_data = FrontMessageRecipient
        .joins(:front_message, matched_contact: :person)
        .where(front_messages: { front_conversation_id: conversation_ids })
        .where.not(contact_methods: { person_id: nil })
        .group('front_messages.front_conversation_id', 'people.id', 'people.client_id')
        .pluck(
          'front_messages.front_conversation_id',
          'people.id',
          'people.client_id'
        )
      
      # Prepare bulk insert data
      people_records = []
      client_records = []
      seen_people = Set.new
      seen_clients = Set.new
      
      people_data.each do |conv_id, person_id, client_id|
        # Track unique person-conversation pairs
        people_key = "#{person_id}-#{conv_id}"
        unless seen_people.include?(people_key)
          seen_people << people_key
          people_records << {
            id: SecureRandom.uuid,
            person_id: person_id,
            front_conversation_id: conv_id,
            created_at: Time.current,
            updated_at: Time.current
          }
        end
        
        # Track unique client-conversation pairs
        client_key = "#{client_id}-#{conv_id}"
        unless seen_clients.include?(client_key)
          seen_clients << client_key
          client_records << {
            id: SecureRandom.uuid,
            client_id: client_id,
            front_conversation_id: conv_id,
            created_at: Time.current,
            updated_at: Time.current
          }
        end
      end
      
      # Bulk upsert with conflict handling
      if people_records.any?
        result = PersonFrontConversation.upsert_all(
          people_records, 
          unique_by: [:person_id, :front_conversation_id],
          returning: false
        )
        people_created += people_records.size
      end
      
      if client_records.any?
        result = ClientFrontConversation.upsert_all(
          client_records, 
          unique_by: [:client_id, :front_conversation_id],
          returning: false
        )
        clients_created += client_records.size
      end
      
      processed += conversations.size
      
      # Progress indicator
      if processed % 5000 == 0
        elapsed = Time.current - start_time
        rate = processed / elapsed
        eta = (FrontConversation.count - processed) / rate
        puts "  Processed: #{processed} | Rate: #{rate.round}/sec | ETA: #{eta.round}s"
      end
    end
    
    duration = Time.current - start_time
    
    puts "\n✅ Population complete!"
    puts "⏱️  Duration: #{duration.round(2)} seconds"
    puts "📊 Final Statistics:"
    puts "  - Conversations processed: #{processed}"
    puts "  - PersonFrontConversation records created: #{people_created}"
    puts "  - ClientFrontConversation records created: #{clients_created}"
    puts "  - Total PersonFrontConversation records: #{PersonFrontConversation.count}"
    puts "  - Total ClientFrontConversation records: #{ClientFrontConversation.count}"
    puts "  - Conversations with people: #{FrontConversation.joins(:people).distinct.count}"
    puts "  - Conversations with clients: #{FrontConversation.joins(:clients).distinct.count}"
    puts "  - Orphaned conversations: #{FrontConversation.left_joins(:people).where(people: { id: nil }).count}"
  end

  desc "Verify join table integrity"
  task verify_joins: :environment do
    puts "🔍 Verifying join table integrity..."
    
    # Check for orphaned records
    orphaned_people = PersonFrontConversation
      .left_joins(:person, :front_conversation)
      .where('people.id IS NULL OR front_conversations.id IS NULL')
      .count
    
    orphaned_clients = ClientFrontConversation
      .left_joins(:client, :front_conversation)
      .where('clients.id IS NULL OR front_conversations.id IS NULL')
      .count
    
    # Check for duplicates (should be 0 due to unique constraint)
    duplicate_people = PersonFrontConversation
      .group(:person_id, :front_conversation_id)
      .having('COUNT(*) > 1')
      .count
      .size
    
    duplicate_clients = ClientFrontConversation
      .group(:client_id, :front_conversation_id)
      .having('COUNT(*) > 1')
      .count
      .size
    
    puts "📊 Integrity Check Results:"
    puts "  - Orphaned PersonFrontConversation records: #{orphaned_people}"
    puts "  - Orphaned ClientFrontConversation records: #{orphaned_clients}"
    puts "  - Duplicate person-conversation pairs: #{duplicate_people}"
    puts "  - Duplicate client-conversation pairs: #{duplicate_clients}"
    
    if orphaned_people + orphaned_clients + duplicate_people + duplicate_clients == 0
      puts "✅ All integrity checks passed!"
    else
      puts "❌ Integrity issues found. Run cleanup tasks if needed."
    end
  end
end