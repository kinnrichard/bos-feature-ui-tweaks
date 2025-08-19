# Wrapper for Front API that works around the hanging issue in frontapp gem
require "http"
require "json"

class FrontApiClient
  BASE_URL = "https://api2.frontapp.com"

  def initialize(auth_token:)
    @auth_token = auth_token
    @http = HTTP.auth("Bearer #{auth_token}")
              .timeout(connect: 5, read: 30)
              .headers(accept: "application/json")
  end

  # Get conversations for an inbox
  # Options:
  #   limit: number of results per page from API (default 25)
  #   max_results: maximum total results to fetch (default 100)
  #   fetch_all: if true, fetch all pages ignoring max_results (default false)
  # Example:
  #   client.get_inbox_conversations(inbox_id, max_results: 50)  # Get first 50
  #   client.get_inbox_conversations(inbox_id, fetch_all: true)  # Get ALL (careful!)
  def get_inbox_conversations(inbox_id, params = {})
    url = "#{BASE_URL}/inboxes/#{inbox_id}/conversations"
    fetch_paginated(url, params)
  end

  # Get all conversations
  # Same options as get_inbox_conversations
  def get_conversations(params = {})
    url = "#{BASE_URL}/conversations"
    fetch_paginated(url, params)
  end

  # Get a specific conversation
  def get_conversation(conversation_id)
    url = "#{BASE_URL}/conversations/#{conversation_id}"
    response = @http.get(url)
    handle_response(response)
  end

  # Get messages in a conversation
  def get_conversation_messages(conversation_id, params = {})
    url = "#{BASE_URL}/conversations/#{conversation_id}/messages"
    fetch_paginated(url, params)
  end

  # Get current user
  def me
    response = @http.get("#{BASE_URL}/me")
    handle_response(response)
  end

  # Get inboxes
  def inboxes
    url = "#{BASE_URL}/inboxes"
    fetch_paginated(url)
  end

  # Get teammates
  def teammates
    url = "#{BASE_URL}/teammates"
    fetch_paginated(url)
  end

  # Send a message
  def send_message(conversation_id, message_data)
    url = "#{BASE_URL}/conversations/#{conversation_id}/messages"
    response = @http.post(url, json: message_data)
    handle_response(response)
  end

  # Create a conversation
  def create_conversation(inbox_id, conversation_data)
    url = "#{BASE_URL}/conversations"
    data = conversation_data.merge(inbox_id: inbox_id)
    response = @http.post(url, json: data)
    handle_response(response)
  end

  private

  def fetch_paginated(url, params = {})
    all_results = []
    next_url = url

    # Extract control params (not sent to API)
    max_results = params.delete(:max_results) || 100  # Default: only fetch up to 100 results
    fetch_all = params.delete(:fetch_all) || false    # Default: don't fetch all pages

    # Default pagination params for API
    params = { limit: 25 }.merge(params)

    page_count = 0
    while next_url
      puts "DEBUG: Fetching page #{page_count + 1}: #{next_url}" if ENV["DEBUG_FRONT_API"]

      begin
        response = if next_url == url
          # First request with params
          @http.get(url, params: params)
        else
          # Follow pagination URL directly
          @http.get(next_url)
        end

        puts "DEBUG: Got response status #{response.status}, Content-Length: #{response.headers['Content-Length']}" if ENV["DEBUG_FRONT_API"]

        # Read the body immediately to avoid re-reading issues
        status = response.status.to_i
        body_str = response.body.to_s

        puts "DEBUG: Read body of #{body_str.length} bytes" if ENV["DEBUG_FRONT_API"]

        # Handle the response based on status
        if status >= 200 && status < 300
          data = JSON.parse(body_str)
          puts "DEBUG: Parsed JSON successfully" if ENV["DEBUG_FRONT_API"]
        else
          raise "API error (#{status}): #{body_str}"
        end
      rescue => e
        puts "ERROR in fetch_paginated: #{e.message}"
        puts e.backtrace.first(5).join("\n")
        raise
      end

      # Handle Front's pagination format
      if data.is_a?(Hash) && data["_results"]
        all_results.concat(data["_results"])
        page_count += 1

        # Check if we should continue fetching
        if !fetch_all && all_results.length >= max_results
          puts "DEBUG: Reached max_results limit (#{max_results}), stopping pagination" if ENV["DEBUG_FRONT_API"]
          break
        end

        # Check for next page
        if data["_pagination"] && data["_pagination"]["next"]
          next_url = data["_pagination"]["next"]
        else
          next_url = nil
        end
      else
        # Non-paginated response
        return data
      end

      # Safety limit to prevent infinite loops
      if all_results.length > 10000
        puts "WARNING: Reached safety limit of 10000 results, stopping pagination"
        break
      end
    end

    # Trim to max_results if needed
    if !fetch_all && all_results.length > max_results
      all_results = all_results.first(max_results)
    end

    all_results
  end

  def handle_response(response)
    case response.status
    when 200..299
      # Don't use response.parse - it seems to hang on large responses
      # Instead, read the body and parse it manually
      body = response.body.to_s
      JSON.parse(body)
    when 429
      raise "Rate limited. Reset at: #{response.headers['x-ratelimit-reset']}"
    when 401
      raise "Unauthorized. Check your API token."
    when 404
      raise "Not found: #{response.uri}"
    else
      raise "API error (#{response.status}): #{response.body}"
    end
  rescue HTTP::Error => e
    raise "HTTP error: #{e.message}"
  end
end
