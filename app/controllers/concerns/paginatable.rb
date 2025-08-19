module Paginatable
  extend ActiveSupport::Concern

  DEFAULT_PAGE = 1
  DEFAULT_PER_PAGE = 25
  MAX_PER_PAGE = 100

  included do
    helper_method :pagination_meta if respond_to?(:helper_method)
  end

  private

  def paginate(scope)
    scope.page(current_page).per(per_page)
  end

  def current_page
    page = params[:page].to_i
    page > 0 ? page : DEFAULT_PAGE
  end

  def per_page
    per_page_param = params[:per_page].to_i

    if per_page_param > 0
      [ per_page_param, MAX_PER_PAGE ].min
    else
      DEFAULT_PER_PAGE
    end
  end

  def pagination_meta(collection)
    {
      current_page: collection.current_page,
      total_pages: collection.total_pages,
      total_count: collection.total_count,
      per_page: collection.limit_value,
      next_page: collection.next_page,
      prev_page: collection.prev_page,
      first_page: collection.first_page?,
      last_page: collection.last_page?
    }
  end

  def pagination_links(collection, base_url)
    links = {}

    links[:self] = paginated_url(base_url, collection.current_page)
    links[:first] = paginated_url(base_url, 1)
    links[:last] = paginated_url(base_url, collection.total_pages)

    if collection.next_page
      links[:next] = paginated_url(base_url, collection.next_page)
    end

    if collection.prev_page
      links[:prev] = paginated_url(base_url, collection.prev_page)
    end

    links
  end

  def paginated_url(base_url, page)
    uri = URI(base_url)
    params = Rack::Utils.parse_nested_query(uri.query)
    params["page"] = page.to_s
    params["per_page"] = per_page.to_s
    uri.query = params.to_query
    uri.to_s
  end
end
