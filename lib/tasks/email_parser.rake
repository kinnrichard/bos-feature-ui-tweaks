# Rake tasks for testing email parsing functionality
namespace :email_parser do
  desc "Test PyCall and Talon integration"
  task test: :environment do
    puts "Testing PyCall and Talon integration..."
    puts "=" * 50
    
    # Test health check
    puts "Health Check:"
    health = EmailReplyParserService.health_check
    puts health.to_json
    puts
    
    if health[:available]
      # Test email parsing
      test_email = <<~EMAIL
        Thanks for your message! I'll get back to you soon.
        
        Best regards,
        John
        
        On Mon, Dec 1, 2014 at 11:55 AM, Original Sender <sender@example.com> wrote:
        > Hi John,
        > 
        > Can you help me with this issue?
        > 
        > Thanks!
      EMAIL
      
      puts "Testing reply extraction:"
      result = EmailReplyParserService.extract_reply(test_email)
      puts "Success: #{result[:success]}"
      puts "Reply: #{result[:data][:reply_text]}" if result[:success]
      puts "Error: #{result[:error]}" unless result[:success]
      puts
      
      puts "Testing basic signature removal:"
      reply_text = result[:data][:reply_text]
      clean_text = EmailReplyParserService.remove_common_signatures(reply_text)
      puts "Original reply length: #{reply_text.length}"
      puts "Clean text length: #{clean_text.length}"
      puts "Clean text: '#{clean_text[0..100]}#{'...' if clean_text.length > 100}'"
      puts
      
      puts "Testing combined parsing:"
      clean_result = EmailReplyParserService.parse_clean_reply(test_email)
      puts "Success: #{clean_result[:success]}"
      puts "Clean reply: #{clean_result[:data][:clean_reply]}" if clean_result[:success]
      puts "Error: #{clean_result[:error]}" unless clean_result[:success]
    else
      puts "Email parser not available - skipping tests"
    end
    
    puts "=" * 50
    puts "Test complete!"
  end
  
  desc "Check PyCall installation status"
  task status: :environment do
    puts "PyCall Installation Status:"
    puts "=" * 30
    
    begin
      require "pycall"
      puts "✓ PyCall gem loaded successfully"
      
      # Check if Python is available
      python_version = PyCall.sys.version rescue "Not available"
      puts "✓ Python version: #{python_version}"
      
      # Check if Talon is available
      if TalonParserHelper.available?
        puts "✓ Talon parser available"
        puts "✓ Configuration: #{Rails.application.config.talon_parser.present? ? 'Loaded' : 'Not loaded'}"
      else
        puts "✗ Talon parser not available"
      end
      
    rescue LoadError => e
      puts "✗ PyCall gem not available: #{e.message}"
    rescue StandardError => e
      puts "✗ Error checking PyCall: #{e.message}"
    end
    
    puts "=" * 30
  end
end