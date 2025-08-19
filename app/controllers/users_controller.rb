class UsersController < ApplicationController
  before_action :require_owner, except: [ :settings, :update_settings ]
  before_action :set_user, only: [ :edit, :update, :destroy ]

  def index
    @users = User.order(:name)
    render Views::Users::IndexView.new(users: @users, current_user: current_user)
  end

  def new
    @user = User.new
    render Views::Users::NewView.new(user: @user, current_user: current_user)
  end

  def create
    @user = User.new(user_params)

    if @user.save
      ActivityLog.create!(
        user: current_user,
        action: "created",
        loggable: @user,
        metadata: {
          user_name: @user.name,
          user_email: @user.email,
          user_role: @user.role
        }
      )
      redirect_to users_path, notice: "User #{@user.name} was successfully created."
    else
      render Views::Users::NewView.new(user: @user, current_user: current_user), status: :unprocessable_entity
    end
  end

  def edit
    render Views::Users::EditView.new(user: @user, current_user: current_user)
  end

  def update
    # Don't require password if it's blank
    if params[:user][:password].blank?
      params[:user].delete(:password)
      params[:user].delete(:password_confirmation)
    end

    if @user.update(user_params)
      ActivityLog.create!(
        user: current_user,
        action: "updated",
        loggable: @user,
        metadata: {
          user_name: @user.name,
          changes: @user.saved_changes.except("updated_at", "password_digest")
        }
      )
      redirect_to users_path, notice: "User #{@user.name} was successfully updated."
    else
      render Views::Users::EditView.new(user: @user, current_user: current_user), status: :unprocessable_entity
    end
  end

  def settings
    @user = current_user
    render Views::Users::SettingsView.new(user: @user, current_user: current_user)
  end

  def update_settings
    @user = current_user
    if @user.update(settings_params)
      redirect_to settings_path, notice: "Settings updated successfully."
    else
      render Views::Users::SettingsView.new(user: @user, current_user: current_user), status: :unprocessable_entity
    end
  end

  def destroy
    user_name = @user.name
    user_email = @user.email

    if @user == current_user
      redirect_to users_path, alert: "You cannot delete your own account."
      return
    end

    ActivityLog.create!(
      user: current_user,
      action: "deleted",
      loggable: @user,
      metadata: {
        user_name: user_name,
        user_email: user_email
      }
    )

    @user.destroy

    redirect_to users_path, notice: "User #{user_name} was successfully deleted."
  end

  private

  def set_user
    @user = User.find(params[:id])
  end

  def user_params
    params.require(:user).permit(:name, :email, :password, :password_confirmation, :role)
  end

  def settings_params
    params.require(:user).permit(:resort_tasks_on_status_change)
  end

  def require_owner
    unless current_user&.owner?
      redirect_to root_path, alert: "You don't have permission to access this page."
    end
  end
end
