class Api::V1::UsersController < Api::V1::BaseController
  before_action :authenticate_request

  # GET /api/v1/users/me
  def me
    render json: {
      data: user_data(current_user)
    }
  end

  # GET /api/v1/users
  def index
    page = params[:page]&.to_i || 1
    per_page = params[:per_page]&.to_i || 25
    per_page = [ per_page, 100 ].min # Cap at 100 to prevent abuse

    @users = User.offset((page - 1) * per_page).limit(per_page)
    @total_count = User.count

    render json: {
      data: @users.map { |user| user_data(user) },
      meta: {
        current_page: page,
        per_page: per_page,
        total_count: @total_count,
        total_pages: (@total_count.to_f / per_page).ceil
      }
    }
  end

  private

  def user_data(user)
    {
      id: user.id,
      type: "users",
      attributes: {
        name: user.name,
        email: user.email,
        role: user.role,
        initials: user.initials,
        avatar_style: user.avatar_style,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    }
  end
end
