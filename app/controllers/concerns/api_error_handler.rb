module ApiErrorHandler
  extend ActiveSupport::Concern

  included do
    rescue_from StandardError, with: :handle_standard_error
    rescue_from ActiveRecord::RecordNotFound, with: :handle_not_found
    rescue_from ActiveRecord::RecordInvalid, with: :handle_unprocessable_entity
    rescue_from ActiveRecord::RecordNotDestroyed, with: :handle_unprocessable_entity
    rescue_from ActionController::ParameterMissing, with: :handle_bad_request
    rescue_from ActionController::UnpermittedParameters, with: :handle_bad_request

    # Custom application errors (commented out for now)
    # rescue_from AuthenticationError, with: :handle_unauthorized
    # rescue_from AuthorizationError, with: :handle_forbidden
    # rescue_from ValidationError, with: :handle_validation_error
    # rescue_from BusinessLogicError, with: :handle_business_logic_error
  end

  private

  def handle_standard_error(exception)
    log_error(exception)

    # Don't render if response already sent
    return if response_body

    # In production, don't expose internal errors
    if Rails.env.production?
      render_error(
        status: :internal_server_error,
        code: "INTERNAL_ERROR",
        title: "Internal Server Error",
        detail: "An unexpected error occurred. Please try again later."
      )
    else
      render_error(
        status: :internal_server_error,
        code: "INTERNAL_ERROR",
        title: exception.class.name,
        detail: exception.message,
        meta: { backtrace: exception.backtrace.first(10) }
      )
    end
  end

  def handle_not_found(exception)
    render_error(
      status: :not_found,
      code: "NOT_FOUND",
      title: "Resource Not Found",
      detail: exception.message,
      source: { parameter: params[:id] }
    )
  end

  def handle_unprocessable_entity(exception)
    if exception.respond_to?(:record) && exception.record
      render_validation_errors(exception.record.errors)
    else
      render_error(
        status: :unprocessable_entity,
        code: "UNPROCESSABLE_ENTITY",
        title: "Unprocessable Entity",
        detail: exception.message
      )
    end
  end

  def handle_bad_request(exception)
    render_error(
      status: :bad_request,
      code: "BAD_REQUEST",
      title: "Bad Request",
      detail: exception.message
    )
  end

  def handle_unauthorized(exception = nil)
    render_error(
      status: :unauthorized,
      code: "UNAUTHORIZED",
      title: "Authentication Required",
      detail: exception&.message || "You must be authenticated to access this resource"
    )
  end

  def handle_forbidden(exception = nil)
    render_error(
      status: :forbidden,
      code: "FORBIDDEN",
      title: "Access Denied",
      detail: exception&.message || "You do not have permission to access this resource"
    )
  end

  def handle_validation_error(exception)
    meta_data = exception.respond_to?(:errors) ? exception.errors : nil
    render_error(
      status: :unprocessable_entity,
      code: "VALIDATION_ERROR",
      title: "Validation Failed",
      detail: exception.message,
      meta: meta_data
    )
  end

  def handle_business_logic_error(exception)
    render_error(
      status: :conflict,
      code: exception.code || "BUSINESS_LOGIC_ERROR",
      title: "Business Logic Error",
      detail: exception.message
    )
  end

  def render_error(status:, code:, title:, detail:, source: nil, meta: nil)
    # Handle Rails status symbols that might not be in Rack's mapping
    status_code = case status
    when :unprocessable_entity
      422
    when Symbol
      Rack::Utils::SYMBOL_TO_STATUS_CODE[status] || 500
    else
      status.to_i
    end

    error = {
      status: status_code.to_s,
      code: code,
      title: title,
      detail: detail
    }

    error[:source] = source if source.present?
    error[:meta] = meta if meta.present?

    render json: { errors: [ error ] }, status: status
  end

  def render_validation_errors(errors)
    validation_errors = errors.map do |error|
      {
        status: "422",
        code: "VALIDATION_FAILED",
        title: "Validation Error",
        detail: error.full_message,
        source: {
          pointer: "/data/attributes/#{error.attribute}"
        }
      }
    end

    render json: { errors: validation_errors }, status: :unprocessable_entity
  end

  def log_error(exception)
    Rails.logger.error "#{exception.class}: #{exception.message}"
    Rails.logger.error exception.backtrace.join("\n") if Rails.env.development?
  end
end
