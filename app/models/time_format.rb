# frozen_string_literal: true

class TimeFormat
  class << self
    # Format duration in seconds to human readable format
    # Examples: "5m", "1h", "1h 30m", "2d 3h", "1w 2d"
    def duration(seconds)
      return nil if seconds.nil? || seconds == 0

      seconds = seconds.to_i
      weeks = seconds / 604800
      days = (seconds % 604800) / 86400
      hours = (seconds % 86400) / 3600
      minutes = (seconds % 3600) / 60

      parts = []
      parts << "#{weeks}w" if weeks > 0
      parts << "#{days}d" if days > 0
      parts << "#{hours}h" if hours > 0
      parts << "#{minutes}m" if minutes > 0 || parts.empty?

      parts.join(" ")
    end

    # Format time ago in words (compact format)
    # Examples: "2s", "5m", "3h", "2d", "1w", "3mo", "1y"
    def time_ago(time)
      return nil unless time

      seconds = Time.current - time
      return "now" if seconds < 1

      case seconds
      when 0...60 then "#{seconds.to_i}s"
      when 60...3600 then "#{(seconds / 60).to_i}m"
      when 3600...86400 then "#{(seconds / 3600).to_i}h"
      when 86400...604800 then "#{(seconds / 86400).to_i}d"
      when 604800...2592000 then "#{(seconds / 604800).to_i}w"
      when 2592000...31536000 then "#{(seconds / 2592000).to_i}mo"
      else "#{(seconds / 31536000).to_i}y"
      end
    end

    # Format time (without date)
    # Examples: "3:30 PM", "9:00 AM"
    def time(time)
      return nil unless time
      time.strftime("%-l:%M %p").strip
    end

    # Format timestamp for logs
    # Examples: "3:30 PM", "9:00 AM"
    def timestamp(time)
      return nil unless time
      time.strftime("%-I:%M %p")
    end

    # Format date with contextual awareness
    # Examples: "Today", "Yesterday", "Monday, January 15, 2025"
    def date(date, format: :contextual)
      return nil unless date

      date = date.to_date if date.respond_to?(:to_date)
      today = Time.current.to_date
      yesterday = today - 1

      case format
      when :contextual
        if date == today
          "Today"
        elsif date == yesterday
          "Yesterday"
        elsif date == today + 1
          "Tomorrow"
        elsif date > today && date <= today + 7
          date.strftime("%A") # Day name for next week
        else
          date.strftime("%A, %B %-d, %Y")
        end
      when :short
        date.strftime("%b %-d")
      when :medium
        date.strftime("%B %-d, %Y")
      when :long
        date.strftime("%A, %B %-d, %Y")
      else
        date.strftime("%B %-d, %Y")
      end
    end

    # Format date header for logs/activity
    # Examples: "Today, January 15, 2025", "Yesterday, January 14, 2025"
    def date_header(date)
      return nil unless date

      date = date.to_date if date.respond_to?(:to_date)
      today = Time.current.to_date
      yesterday = today - 1

      if date == today
        "Today, #{date.strftime('%B %-d, %Y')}"
      elsif date == yesterday
        "Yesterday, #{date.strftime('%B %-d, %Y')}"
      else
        date.strftime("%A, %B %-d, %Y")
      end
    end

    # Format datetime
    # Examples: "January 15, 2025 at 3:30 PM"
    def datetime(datetime, include_time: true)
      return nil unless datetime

      if include_time && datetime.respond_to?(:strftime)
        "#{datetime.strftime('%B %-d, %Y')} at #{time(datetime)}"
      else
        date(datetime, format: :medium)
      end
    end

    # Format grouped times for logs
    # Used when multiple activities happen at similar times
    def grouped_times(times)
      return nil if times.empty?

      unique_times = times.map { |t| timestamp(t) }.uniq

      case unique_times.size
      when 1
        unique_times.first
      when 2
        "#{unique_times.first} and #{unique_times.last}"
      else
        times_sorted = times.sort
        "#{timestamp(times_sorted.first)} – #{timestamp(times_sorted.last)}"
      end
    end

    # Format relative date
    # Examples: "2 days ago", "in 3 hours", "just now"
    def relative_date(time, options = {})
      return nil unless time

      seconds = time - Time.current
      absolute = seconds.abs

      if absolute < 60
        return "just now"
      end

      words = case absolute
      when 60...3600 then "#{(absolute / 60).to_i} minute"
      when 3600...86400 then "#{(absolute / 3600).to_i} hour"
      when 86400...604800 then "#{(absolute / 86400).to_i} day"
      when 604800...2592000 then "#{(absolute / 604800).to_i} week"
      when 2592000...31536000 then "#{(absolute / 2592000).to_i} month"
      else "#{(absolute / 31536000).to_i} year"
      end

      # Pluralize
      count = words.split.first.to_i
      words += "s" if count > 1

      if seconds < 0
        "#{words} ago"
      else
        "in #{words}"
      end
    end

    # Format business hours
    # Examples: "9:00 AM - 5:00 PM", "Closed"
    def business_hours(open_time, close_time)
      return "Closed" if open_time.nil? || close_time.nil?
      "#{time(open_time)} - #{time(close_time)}"
    end
  end
end
