#!/usr/bin/env ruby
# Demo script to download all contacts from Front API

require 'bundler/setup'
require 'frontapp'
require 'json'
require 'csv'

# Make sure the monkeypatch is loaded for pagination control
begin
  require_relative '../../config/initializers/frontapp_monkeypatch'
rescue LoadError
  puts "Warning: Monkeypatch not found. Using standard frontapp gem behavior."
end

AUTH_TOKEN = ENV['FRONT_API_TOKEN'] || "your_token_here"

if AUTH_TOKEN == "your_token_here"
  puts "ERROR: Please set your FRONT_API_TOKEN environment variable"
  puts "Example: FRONT_API_TOKEN=your_actual_token ruby #{__FILE__}"
  exit 1
end

puts "Front API Contact Downloader"
puts "=" * 60

client = Frontapp::Client.new(auth_token: AUTH_TOKEN)

# Configuration
BATCH_SIZE = 100  # Number of contacts per page
OUTPUT_FORMAT = :json  # :json, :csv, or :both

def save_to_json(contacts, filename = "front_contacts.json")
  File.write(filename, JSON.pretty_generate(contacts))
  puts "✓ Saved #{contacts.length} contacts to #{filename}"
end

def save_to_csv(contacts, filename = "front_contacts.csv")
  return puts "No contacts to save" if contacts.empty?

  CSV.open(filename, 'w') do |csv|
    # Extract all unique field names from contacts
    headers = contacts.flat_map(&:keys).uniq
    csv << headers

    contacts.each do |contact|
      csv << headers.map { |h| contact[h] }
    end
  end
  puts "✓ Saved #{contacts.length} contacts to #{filename}"
end

# Method 1: Download all contacts at once (simple but may be slow for large datasets)
def download_all_at_once(client)
  puts "\nMethod 1: Downloading all contacts at once..."
  puts "-" * 40

  start_time = Time.now

  begin
    # Using fetch_all: true to get all contacts across all pages
    # Remove fetch_all if you want to limit results
    contacts = client.contacts(fetch_all: true)

    elapsed = Time.now - start_time
    puts "✓ Downloaded #{contacts.length} contacts in #{elapsed.round(2)} seconds"

    contacts
  rescue => e
    puts "✗ Error downloading contacts: #{e.message}"
    []
  end
end

# Method 2: Download contacts page by page with progress updates
def download_with_pagination(client, batch_size = 100)
  puts "\nMethod 2: Downloading contacts page by page..."
  puts "-" * 40

  all_contacts = []
  page_token = nil
  page_num = 0
  start_time = Time.now

  begin
    loop do
      page_num += 1
      print "Downloading page #{page_num}... "

      # Get a page of contacts
      if client.respond_to?(:contacts_page)
        # If monkeypatch provides page method
        page_data = client.contacts_page(limit: batch_size, page_token: page_token)
        contacts = page_data[:results]
        has_more = page_data[:has_more]
        page_token = page_data[:next_token]
      else
        # Fallback: use standard method with limit
        # Note: This may still fetch all if monkeypatch isn't loaded
        contacts = client.contacts(limit: batch_size)
        has_more = false  # Can't paginate without monkeypatch
      end

      all_contacts.concat(contacts)
      puts "#{contacts.length} contacts (total: #{all_contacts.length})"

      break unless has_more
    end

    elapsed = Time.now - start_time
    puts "✓ Downloaded #{all_contacts.length} total contacts in #{elapsed.round(2)} seconds"

    all_contacts
  rescue => e
    puts "\n✗ Error downloading contacts: #{e.message}"
    puts "  Returning #{all_contacts.length} contacts downloaded so far"
    all_contacts
  end
end

# Method 3: Download and process contacts in batches
def download_and_process_batches(client, batch_size = 50)
  puts "\nMethod 3: Downloading and processing contacts in batches..."
  puts "-" * 40

  processed_count = 0
  all_contact_summaries = []

  begin
    if client.respond_to?(:each_contact_page)
      # If monkeypatch provides iteration method
      client.each_contact_page(limit: batch_size) do |contacts|
        processed_count += contacts.length

        # Process each batch (example: extract key fields)
        contacts.each do |contact|
          summary = {
            id: contact['id'],
            name: contact['name'],
            emails: contact['handles']&.select { |h| h['source'] == 'email' }&.map { |h| h['handle'] },
            phones: contact['handles']&.select { |h| h['source'] == 'phone' }&.map { |h| h['handle'] },
            created_at: contact['created_at'],
            updated_at: contact['updated_at']
          }
          all_contact_summaries << summary
        end

        puts "Processed batch: #{contacts.length} contacts (total: #{processed_count})"

        # Optional: Stop after certain number for demo
        # break if processed_count >= 200
      end
    else
      puts "Batch iteration not available without monkeypatch"
      puts "Falling back to single fetch..."

      contacts = client.contacts(limit: batch_size)
      contacts.each do |contact|
        summary = {
          id: contact['id'],
          name: contact['name'],
          emails: contact['handles']&.select { |h| h['source'] == 'email' }&.map { |h| h['handle'] },
          phones: contact['handles']&.select { |h| h['source'] == 'phone' }&.map { |h| h['handle'] },
          created_at: contact['created_at'],
          updated_at: contact['updated_at']
        }
        all_contact_summaries << summary
      end
      processed_count = contacts.length
    end

    puts "✓ Processed #{processed_count} total contacts"
    all_contact_summaries
  rescue => e
    puts "✗ Error processing contacts: #{e.message}"
    all_contact_summaries
  end
end

# Main execution
puts "\nChoose download method:"
puts "1. Download all at once (simple, may be slow)"
puts "2. Download with pagination (shows progress)"
puts "3. Download and process in batches (memory efficient)"
print "Enter choice (1-3): "

choice = gets&.chomp || "2"

contacts = case choice
when "1"
  download_all_at_once(client)
when "2"
  download_with_pagination(client, BATCH_SIZE)
when "3"
  download_and_process_batches(client, BATCH_SIZE)
else
  puts "Invalid choice, using method 2"
  download_with_pagination(client, BATCH_SIZE)
end

# Save the results
if contacts && !contacts.empty?
  puts "\nSaving contacts..."
  puts "-" * 40

  timestamp = Time.now.strftime("%Y%m%d_%H%M%S")

  case OUTPUT_FORMAT
  when :json
    save_to_json(contacts, "front_contacts_#{timestamp}.json")
  when :csv
    save_to_csv(contacts, "front_contacts_#{timestamp}.csv")
  when :both
    save_to_json(contacts, "front_contacts_#{timestamp}.json")
    save_to_csv(contacts, "front_contacts_#{timestamp}.csv")
  end

  # Print sample of first few contacts
  puts "\nSample of downloaded contacts:"
  puts "-" * 40
  contacts.first(3).each_with_index do |contact, i|
    puts "\n#{i + 1}. #{contact['name'] || '(no name)'}"
    puts "   ID: #{contact['id']}"
    if contact['handles']
      emails = contact['handles'].select { |h| h['source'] == 'email' }.map { |h| h['handle'] }
      puts "   Emails: #{emails.join(', ')}" if emails.any?
    end
  end
else
  puts "\nNo contacts downloaded."
end

puts "\n" + "=" * 60
puts "Download complete!"
