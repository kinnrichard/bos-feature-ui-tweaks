# Test email parsing on a single message

# Find an inbound email message
message = FrontMessage.where(is_inbound: true, message_type: 'email').where.not(body_plain: nil).first

if message
  puts "Found message: #{message.id}"
  puts "Subject: #{message.subject}"
  puts "Has body_plain: #{message.body_plain.present?}"
  puts "Has body_html: #{message.body_html.present?}"

  # Try to parse it
  puts "\nParsing message..."
  begin
    message.parse!
    puts "✅ Parsing successful!"

    if message.parsed_email
      puts "\nParsed content:"
      puts "- Plain message: #{message.parsed_email.plain_message&.truncate(100) if message.parsed_email.plain_message}"
      puts "- Plain signature: #{message.parsed_email.plain_signature&.truncate(50) if message.parsed_email.plain_signature}"
      puts "- Has HTML message: #{message.parsed_email.html_message.present?}"
      puts "- Parse errors: #{message.parsed_email.parse_errors}"
    end
  rescue => e
    puts "❌ Error parsing: #{e.message}"
    puts e.backtrace.first(5)
  end
else
  puts "No inbound email messages found with body_plain content"

  # Check what messages we have
  total = FrontMessage.count
  inbound = FrontMessage.where(is_inbound: true).count
  emails = FrontMessage.where(message_type: 'email').count
  with_body = FrontMessage.where.not(body_plain: nil).count

  puts "\nMessage statistics:"
  puts "- Total messages: #{total}"
  puts "- Inbound messages: #{inbound}"
  puts "- Email type messages: #{emails}"
  puts "- Messages with body_plain: #{with_body}"
end
