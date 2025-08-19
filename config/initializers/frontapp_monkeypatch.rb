# Monkeypatch for frontapp gem to respect max_results parameter and add pagination
# The original gem always fetches ALL pages, which causes it to hang on large datasets
# This patch adds:
#   1. max_results support to stop pagination early
#   2. fetch_all flag to get original behavior when needed
#   3. Single page methods for manual pagination
#
# Usage examples:
#   # Get just first 10 results (fast!)
#   client.get_inbox_conversations(inbox_id, max_results: 10)
#
#   # Manual pagination - get one page at a time (default: 100 per page)
#   page1 = client.get_inbox_conversations_page(inbox_id)
#   # page1 = { results: [...], next_token: "...", has_more: true }
#
#   page2 = client.get_inbox_conversations_page(inbox_id, page_token: page1[:next_token])
#
#   # Get ALL results (original behavior - careful with large datasets!)
#   client.get_inbox_conversations(inbox_id, fetch_all: true)

require "frontapp"
require "http"

module Frontapp
  class Client
    # Default page size for API requests
    DEFAULT_PAGE_SIZE = 100
    # New method: Get a single page of results with pagination info
    def list_page(path, params = {})
      # Extract page_token if provided
      page_token = params.delete(:page_token) || params.delete("page_token")

      # Build URL
      if page_token
        # Page token contains the full URL with params
        url = page_token
        params = {} # Clear params for pagination URLs
      else
        url = "#{base_url}#{path}"
      end

      # Debug logging for query parameters
      if ENV["DEBUG_FRONT_API"] && !params.empty?
        puts "  DEBUG [list_page]: URL: #{url}"
        puts "  DEBUG [list_page]: Params: #{params.inspect}"
      end

      response = @headers.get(url, params: params)

      # Handle API errors
      raise Error.from_response(response) unless response.status.success?

      parsed = response.parse
      results = parsed["_results"] || []
      pagination = parsed["_pagination"] || {}

      # Return structured response with pagination info
      {
        results: results,
        next_token: pagination["next"],
        has_more: !pagination["next"].nil?,
        total: results.length
      }
    end

    # Override the list method to respect max_results and fetch_all
    def list(path, params = {}, &block)
      # Extract control parameters
      max_results = params.delete(:max_results) || params.delete("max_results")
      fetch_all = params.delete(:fetch_all) || params.delete("fetch_all") || false

      # If fetch_all is true, use original behavior (fetch everything)
      if fetch_all
        return list_all_pages(path, params, &block)
      end

      # If limit is specified without max_results, use it as max_results
      # and remove limit from params to prevent API pagination
      if max_results.nil? && params[:limit]
        max_results = params.delete(:limit) || params.delete("limit")
        puts "DEBUG: Using limit as max_results: #{max_results}" if ENV["DEBUG_FRONT_API"]
      end

      items = []
      last_page = false
      url = "#{base_url}#{path}"

      # Track how many results we've collected
      total_collected = 0

      while !last_page
        # If we have a max_results limit, check if we've reached it
        if max_results && total_collected >= max_results
          break
        end

        # Set appropriate limit for this request
        request_params = params.dup
        if max_results
          remaining = max_results - total_collected
          # Use smaller of default or remaining needed
          request_params[:limit] = [ DEFAULT_PAGE_SIZE, remaining ].min
        else
          # No max_results, use default page size
          request_params[:limit] ||= DEFAULT_PAGE_SIZE
        end

        response = @headers.get(url, params: request_params)

        # Handle API errors
        raise Error.from_response(response) unless response.status.success?

        # Process results
        parsed = response.parse
        actual_results = parsed["_results"] || []

        # Log if we got fewer results than requested (Front API limit)
        if request_params[:limit] && actual_results.length < request_params[:limit] && parsed["_pagination"] && parsed["_pagination"]["next"]
          Rails.logger.debug "[FrontAPI] Requested limit: #{request_params[:limit]}, but got #{actual_results.length} results (API max limit)"
        end

        if block_given?
          yield actual_results
        else
          items.concat(actual_results)
          total_collected += actual_results.length

          # Stop immediately if we have enough results
          if max_results && total_collected >= max_results
            puts "DEBUG: Reached max_results (#{max_results}), stopping pagination" if ENV["DEBUG_FRONT_API"]
            break
          end
        end

        # Check for next page
        pagination = parsed["_pagination"]
        if pagination.nil? || pagination["next"].nil?
          last_page = true
        else
          url = pagination["next"]
          # Clear params for subsequent requests (pagination URL includes params)
          params = {}
        end

        # Safety check to prevent infinite loops
        break if total_collected > 10000
      end

      # Trim to max_results if we went over
      if max_results && items.length > max_results
        items = items.first(max_results)
      end

      items
    end

    # Original behavior - fetch all pages (be careful!)
    def list_all_pages(path, params = {})
      if block_given?
        # When block given, yield each page instead of collecting
        last_page = false
        url = "#{base_url}#{path}"
        page_count = 0

        # Set default page size if not specified
        params[:limit] ||= DEFAULT_PAGE_SIZE

        while !last_page
          response = @headers.get(url, params: params)

          raise Error.from_response(response) unless response.status.success?

          parsed = response.parse
          results = parsed["_results"] || []

          # Yield the page results
          yield results if results.any?
          page_count += 1

          pagination = parsed["_pagination"]
          if pagination.nil? || pagination["next"].nil?
            last_page = true
          else
            url = pagination["next"]
            params = {}
          end

          # Safety limit
          break if page_count > 500  # 500 pages * 100 items = 50,000 max
        end

        nil  # Return nil when using blocks
      else
        # Original behavior - collect all results
        items = []
        last_page = false
        url = "#{base_url}#{path}"

        # Set default page size if not specified
        params[:limit] ||= DEFAULT_PAGE_SIZE

        while !last_page
          response = @headers.get(url, params: params)

          raise Error.from_response(response) unless response.status.success?

          parsed = response.parse
          results = parsed["_results"] || []
          items.concat(results)

          pagination = parsed["_pagination"]
          if pagination.nil? || pagination["next"].nil?
            last_page = true
          else
            url = pagination["next"]
            params = {}
          end

          # Safety limit
          break if items.length > 50000
        end

        items
      end
    end

    # Add single-page methods for manual pagination

    def get_inbox_conversations_page(inbox_id, params = {})
      page_token = params[:page_token] || params["page_token"]
      limit = params[:limit] || params["limit"] || DEFAULT_PAGE_SIZE

      if page_token
        list_page(nil, page_token: page_token)
      else
        cleaned = params.permit({ q: [ :statuses ] })
        cleaned[:limit] = limit
        list_page("inboxes/#{inbox_id}/conversations", cleaned)
      end
    end

    def conversations_page(params = {})
      page_token = params[:page_token] || params["page_token"]
      limit = params[:limit] || params["limit"] || DEFAULT_PAGE_SIZE

      if page_token
        list_page(nil, page_token: page_token)
      else
        # Allow more q parameters including updated_after for date filtering
        cleaned = params.permit({ q: [ :statuses, :updated_after, :updated_before ] })
        cleaned[:limit] = limit
        # Also pass through any q[...] parameters that came as flat strings
        params.each do |key, value|
          if key.to_s.start_with?("q[")
            cleaned[key] = value
          end
        end
        list_page("conversations", cleaned)
      end
    end

    # Override get_inbox_conversations to handle max_results and fetch_all
    alias_method :original_get_inbox_conversations, :get_inbox_conversations

    def get_inbox_conversations(inbox_id, params = {})
      # Preserve control params through the permit call
      max_results = params[:max_results] || params["max_results"]
      fetch_all = params[:fetch_all] || params["fetch_all"]
      limit = params[:limit] || params["limit"]

      cleaned = params.permit({ q: [ :statuses ] })
      cleaned[:max_results] = max_results if max_results
      cleaned[:fetch_all] = fetch_all if fetch_all
      cleaned[:limit] = limit if limit

      list("inboxes/#{inbox_id}/conversations", cleaned)
    end

    # Override conversations method to handle max_results and fetch_all
    alias_method :original_conversations, :conversations

    def conversations(params = {}, &block)
      # Preserve control params through the permit call
      max_results = params[:max_results] || params["max_results"]
      fetch_all = params[:fetch_all] || params["fetch_all"]
      limit = params[:limit] || params["limit"]

      # Allow more q parameters including updated_after for date filtering
      cleaned = params.permit({ q: [ :statuses, :updated_after, :updated_before ] })
      cleaned[:max_results] = max_results if max_results
      cleaned[:fetch_all] = fetch_all if fetch_all
      cleaned[:limit] = limit if limit

      # Also pass through any q[...] parameters that came as flat strings
      params.each do |key, value|
        if key.to_s.start_with?("q[")
          cleaned[key] = value
        end
      end

      list("conversations", cleaned, &block)
    end

    # Override contacts method to handle blocks
    alias_method :original_contacts, :contacts if method_defined?(:contacts)

    def contacts(params = {}, &block)
      params[:fetch_all] = true if params[:fetch_all].nil? && block_given?
      list("contacts", params, &block)
    end

    # Override tags method to handle blocks
    alias_method :original_tags, :tags if method_defined?(:tags)

    def tags(params = {}, &block)
      params[:fetch_all] = true if params[:fetch_all].nil? && block_given?
      list("tags", params, &block)
    end

    # Override teammates method to handle blocks
    alias_method :original_teammates, :teammates if method_defined?(:teammates)

    def teammates(params = {}, &block)
      params[:fetch_all] = true if params[:fetch_all].nil? && block_given?
      list("teammates", params, &block)
    end

    # Override channels method to handle blocks
    alias_method :original_channels, :channels if method_defined?(:channels)

    def channels(params = {}, &block)
      params[:fetch_all] = true if params[:fetch_all].nil? && block_given?
      list("channels", params, &block)
    end

    # Helper method for iterating through pages with a block
    def each_conversation_page(inbox_id, limit: DEFAULT_PAGE_SIZE, &block)
      page_token = nil

      loop do
        page = get_inbox_conversations_page(inbox_id, limit: limit, page_token: page_token)

        # Yield the page results to the block
        yield page[:results]

        # Check if there are more pages
        break unless page[:has_more]
        page_token = page[:next_token]
      end
    end

    # Add get_conversation method if it doesn't exist
    unless method_defined?(:get_conversation)
      def get_conversation(conversation_id)
        response = @headers.get("#{base_url}conversations/#{conversation_id}")
        raise Error.from_response(response) unless response.status.success?
        response.parse
      end
    end
  end
end

# Log that the monkeypatch is loaded
if defined?(Rails) && Rails.logger
  Rails.logger.info "Frontapp monkeypatch loaded: Added max_results support and pagination methods"
elsif ENV["DEBUG_FRONT_API"]
  puts "Frontapp monkeypatch loaded: Added max_results support and pagination methods"
end
