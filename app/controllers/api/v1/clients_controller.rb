class Api::V1::ClientsController < Api::V1::BaseController
  include Paginatable

  before_action :authenticate_request
  before_action :set_client, only: [ :show, :update, :destroy ]

  # GET /api/v1/clients
  def index
    clients = Client.includes(:jobs, :devices)
                   .order(:name)

    # Apply filters
    clients = apply_filters(clients)

    # Paginate
    clients = paginate(clients)

    Rails.logger.info "CLIENTS INDEX: Loading #{clients.count} clients" if Rails.env.development?

    # Check ETag freshness with filter params as additional keys
    filter_params = params.permit(:q, :client_type, :page, :per_page, :include).to_h
    if stale_check?(clients, additional_keys: [ filter_params ])
      render json: ClientSerializer.new(
        clients,
        include: params[:include]&.split(","),
        meta: pagination_meta(clients),
        links: pagination_links(clients, request.url)
      ).serializable_hash
    end
  end

  # GET /api/v1/clients/:id
  def show
    # Check ETag freshness for the client
    if stale_check?(@client, additional_keys: [ params[:include] ])
      render json: ClientSerializer.new(
        @client,
        include: params[:include]&.split(",")
      ).serializable_hash
    end
  end

  # POST /api/v1/clients
  def create
    client = Client.new(client_params)

    if client.save
      render json: ClientSerializer.new(client).serializable_hash, status: :created
    else
      render_validation_errors(client.errors)
    end
  end

  # PATCH/PUT /api/v1/clients/:id
  def update
    if @client.update(client_params)
      render json: ClientSerializer.new(@client).serializable_hash
    else
      render_validation_errors(@client.errors)
    end
  end

  # DELETE /api/v1/clients/:id
  def destroy
    if current_user.can_delete?(@client)
      @client.destroy
      head :no_content
    else
      render_error(
        status: :forbidden,
        code: "FORBIDDEN",
        title: "Access Denied",
        detail: "You do not have permission to delete this client"
      )
    end
  end

  private

  def set_client
    @client = Client.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render_error(
      status: :not_found,
      code: "NOT_FOUND",
      title: "Client Not Found",
      detail: "Client with ID #{params[:id]} not found"
    )
  end

  def client_params
    params.require(:client).permit(:name, :client_type)
  end

  def apply_filters(scope)
    # Filter by client type
    if params[:client_type].present?
      scope = scope.where(client_type: params[:client_type])
    end

    # Search by name
    if params[:q].present?
      scope = scope.where("clients.name ILIKE ?", "%#{params[:q]}%")
    end

    scope
  end
end
