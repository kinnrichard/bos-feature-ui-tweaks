# Rake tasks for TalonEmailParser service
namespace :talon do
  desc "Test TalonEmailParser service functionality"
  task test: :environment do
    puts "=== TalonEmailParser Service Test ==="
    
    parser = TalonEmailParser.instance
    
    # Health check
    puts "\n1. Health Check:"
    health = parser.health_check
    puts "   Status: #{health[:status]}"
    puts "   Available: #{parser.available?}"
    puts "   Version: #{parser.talon_version}"
    puts "   Capabilities: #{health[:capabilities]}" if health[:capabilities]
    
    if parser.available?
      # Test plain text parsing
      test_email = <<~EMAIL
        Thanks for your message. I'll review this and get back to you.
        
        Best regards,
        John Smith
        Senior Developer
        john@example.com
        
        On Mon, Dec 1, 2014 at 11:55 AM, Original Sender wrote:
        > Original message content here
        > More quoted content
      EMAIL
      
      puts "\n2. Plain Text Parsing:"
      result = parser.parse_email(test_email, format: 'text/plain')
      if result[:success]
        puts "   ✓ Success"
        puts "   Reply: #{result[:data][:reply_text]&.truncate(60)}"
        puts "   Clean: #{result[:data][:clean_reply]&.truncate(60)}"
        puts "   Has Signature: #{result[:data][:has_signature]}"
      else
        puts "   ✗ Failed: #{result[:error]}"
      end
      
      # Test HTML parsing
      html_email = <<~HTML
        <div>
          <p>Thanks for your message.</p>
          <div>Best regards,<br>John</div>
        </div>
        <div class="gmail_quote">
          <div>On Mon, Dec 1, 2014 wrote:</div>
          <blockquote><p>Original message</p></blockquote>
        </div>
      HTML
      
      puts "\n3. HTML Parsing:"
      result = parser.parse_email(html_email, format: 'text/html')
      if result[:success]
        puts "   ✓ Success"
        puts "   Reply HTML: #{result[:data][:reply_html]&.truncate(60)}"
        puts "   Has Signature: #{result[:data][:has_signature]}"
      else
        puts "   ✗ Failed: #{result[:error]}"
      end
    else
      puts "\nParser not available - functionality tests skipped"
    end
    
    puts "\n=== Test Complete ==="
  end
  
  desc "Show TalonEmailParser service status and capabilities"
  task status: :environment do
    parser = TalonEmailParser.instance
    health = parser.health_check
    
    puts "TalonEmailParser Service Status:"
    puts "================================"
    puts "Status: #{health[:status]}"
    puts "Available: #{parser.available?}"
    puts "Talon Version: #{parser.talon_version}"
    puts "Initialized: #{health[:initialized]}"
    
    if health[:capabilities]
      puts "\nCapabilities:"
      health[:capabilities].each do |key, value|
        puts "  #{key.to_s.humanize}: #{value ? '✓' : '✗'}"
      end
    end
    
    if health[:error]
      puts "\nError: #{health[:error]}"
    end
    
    puts "\nLast Check: #{health[:last_check]}"
  end
  
  desc "Test TalonEmailParser with a FrontMessage"
  task :test_message, [:message_id] => :environment do |task, args|
    message_id = args[:message_id]
    
    if message_id.blank?
      puts "Usage: rake talon:test_message[message_id]"
      puts "Example: rake talon:test_message[12345]"
      exit 1
    end
    
    message = FrontMessage.find_by(id: message_id)
    unless message
      puts "FrontMessage with ID #{message_id} not found"
      exit 1
    end
    
    parser = TalonEmailParser.instance
    unless parser.available?
      puts "TalonEmailParser not available"
      exit 1
    end
    
    puts "Testing TalonEmailParser with FrontMessage ID: #{message_id}"
    puts "Subject: #{message.subject}"
    puts "Type: #{message.message_type}"
    puts "Inbound: #{message.is_inbound}"
    puts ""
    
    result = parser.parse_front_message(message, format: 'both')
    
    if result[:success]
      puts "✓ Parsing successful"
      data = result[:data]
      
      if data[:text_parsing]
        text_result = data[:text_parsing]
        if text_result[:success]
          puts "\nText Parsing:"
          puts "  Reply length: #{text_result[:data][:reply_length]}"
          puts "  Clean length: #{text_result[:data][:clean_length]}"
          puts "  Has signature: #{text_result[:data][:has_signature]}"
        end
      end
      
      if data[:html_parsing]
        html_result = data[:html_parsing]
        if html_result[:success]
          puts "\nHTML Parsing:"
          puts "  Reply length: #{html_result[:data][:reply_length]}"
          puts "  Clean length: #{html_result[:data][:clean_length]}"
          puts "  Has signature: #{html_result[:data][:has_signature]}"
        end
      end
      
    else
      puts "✗ Parsing failed: #{result[:error]}"
    end
  end
  
  desc "Benchmark TalonEmailParser performance"
  task benchmark: :environment do
    require 'benchmark'
    
    parser = TalonEmailParser.instance
    unless parser.available?
      puts "TalonEmailParser not available for benchmarking"
      exit 1
    end
    
    test_email = <<~EMAIL
      Thanks for your message. I'll review this proposal.
      
      Best regards,
      John Smith
      
      On Mon, Dec 1, 2024 at 11:55 AM, Jane Doe wrote:
      > Hi John, could you please review this proposal?
      > It's quite urgent. Thanks!
    EMAIL
    
    puts "TalonEmailParser Performance Benchmark"
    puts "======================================"
    
    Benchmark.bm do |x|
      x.report("Plain text (100x)") do
        100.times { parser.parse_email(test_email, format: 'text/plain') }
      end
      
      x.report("HTML (100x)") do
        html_email = "<div>#{test_email.gsub("\n", "<br>")}</div>"
        100.times { parser.parse_email(html_email, format: 'text/html') }
      end
      
      x.report("Both formats (50x)") do
        50.times do
          parser.parse_email({
            text: test_email,
            html: "<div>#{test_email.gsub("\n", "<br>")}</div>"
          }, format: 'both')
        end
      end
    end
  end
end