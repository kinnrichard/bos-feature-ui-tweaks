# Front API Examples

This directory contains example scripts demonstrating the Front API integration with the monkeypatch fixes.

## Files

### frontapp_demo.rb
Demonstrates the basic usage of the frontapp gem with the monkeypatch that fixes pagination issues.

```bash
ruby examples/front_api/frontapp_demo.rb
```

Shows:
- Getting limited results with `max_results`
- Using `limit` as `max_results` for compatibility
- Fast response times (should complete in < 2 seconds per query)

### pagination_demo.rb
Comprehensive demonstration of all pagination options available with the monkeypatch.

```bash
ruby examples/front_api/pagination_demo.rb
```

Shows:
1. Quick limited fetch with `max_results`
2. Manual page-by-page pagination
3. Iterating through pages with blocks
4. Fetching all results (use carefully!)
5. Compatibility mode where `limit` acts as `max_results`

## Configuration

Both scripts expect a Front API token. You can either:
1. Set the `FRONT_API_TOKEN` environment variable
2. Edit the AUTH_TOKEN constant in the scripts

## Related Files

- `/lib/front_api_client.rb` - Custom Front API client (alternative to the gem)
- `/config/initializers/frontapp_monkeypatch.rb` - Monkeypatch that fixes the frontapp gem's pagination issues

## The Problem We Solved

The original frontapp gem (v0.0.13) has a critical bug where it always fetches ALL pages of results, even when you specify a limit. This causes the gem to hang when dealing with inboxes containing years of conversation data.

Our monkeypatch fixes this by:
- Making `limit` and `max_results` actually limit the total results returned
- Adding manual pagination methods for controlled page-by-page fetching
- Preserving the original behavior with `fetch_all: true` when needed