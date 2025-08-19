---
title: "Backend Developer Getting Started Guide"
description: "Complete guide for backend developers working with the bŏs Rails API"
last_updated: "2025-07-17"
status: "active"
category: "getting-started"
tags: ["backend", "rails", "api", "ruby", "postgresql"]
---

# Backend Developer Getting Started Guide

> **Master the bŏs Rails API: from setup to advanced patterns**

## 🎯 Objectives
After completing this guide, you will:
- Understand the bŏs Rails API architecture and patterns
- Know how to build and maintain RESTful API endpoints
- Understand database modeling and relationships
- Be able to implement authentication and authorization
- Know how to write comprehensive tests and optimize performance

## 📋 Prerequisites
- Solid knowledge of Ruby programming language
- Understanding of Rails framework fundamentals
- Basic knowledge of SQL and database concepts
- Familiarity with RESTful API design principles

## 🏗️ Backend Architecture Overview

### Technology Stack
- **Ruby 3.4.4**: Programming language
- **Rails 8.0.2**: Web framework (API-only mode)
- **PostgreSQL**: Primary database
- **JWT**: Authentication tokens
- **ActiveJob**: Background job processing
- **Action Cable**: WebSocket connections
- **Minitest**: Testing framework

### Key Architectural Patterns
- **API-only Rails**: JSON responses, no views
- **Service Objects**: Business logic encapsulation
- **Serializers**: JSON response formatting
- **UUID Primary Keys**: Globally unique identifiers
- **Soft Deletion**: Preserve data integrity
- **Optimistic Locking**: Prevent concurrent updates

---

## 🚀 Phase 1: Environment Setup (30-45 minutes)

### 1.1 Ruby and Rails Setup
```bash
# Install Ruby 3.4.4 (using rbenv)
rbenv install 3.4.4
rbenv global 3.4.4

# Verify Ruby version
ruby -v

# Install Rails 8.0.2
gem install rails -v 8.0.2

# Install bundler
gem install bundler
```

### 1.2 Database Setup
```bash
# Install PostgreSQL dependencies
bundle install

# Create and setup database
rails db:create
rails db:migrate
rails db:seed

# Run test database setup
RAILS_ENV=test rails db:create
RAILS_ENV=test rails db:migrate
```

### 1.3 Development Server
```bash
# Start Rails server
rails server -b 0.0.0.0

# Server should be running on http://localhost:3000
# Test health endpoint
curl http://localhost:3000/api/v1/health
```

### 1.4 Project Structure
```
app/
├── controllers/
│   ├── api/v1/              # API endpoints
│   ├── application_controller.rb
│   └── concerns/            # Shared controller logic
├── models/
│   ├── application_record.rb
│   └── concerns/            # Shared model logic
├── serializers/             # JSON response formatting
├── services/                # Business logic
├── jobs/                    # Background jobs
└── channels/                # WebSocket channels

config/
├── routes.rb                # API routes
├── database.yml            # Database configuration
└── initializers/           # App initialization

db/
├── migrate/                # Database migrations
├── seeds.rb               # Sample data
└── schema.rb              # Database schema

test/
├── controllers/           # Controller tests
├── models/               # Model tests
├── integration/          # Integration tests
└── fixtures/             # Test data
```

---

## 🔧 Phase 2: API Architecture and Routing (45-60 minutes)

### 2.1 API Routing Structure
```ruby
# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      # Health check
      get 'health', to: 'health#index'
      
      # Authentication
      post 'auth/login', to: 'auth#login'
      post 'auth/logout', to: 'auth#logout'
      post 'auth/refresh', to: 'auth#refresh'
      
      # Resources
      resources :clients do
        resources :jobs, shallow: true
        resources :devices, shallow: true
        resources :people, shallow: true
      end
      
      resources :jobs do
        resources :tasks, shallow: true
        resources :notes, shallow: true
      end
      
      resources :tasks do
        member do
          patch :reorder
          patch :complete
        end
      end
      
      resources :users, except: [:new, :edit]
      
      # Nested routes for related resources
      resources :scheduled_date_times, only: [:index, :create, :update, :destroy]
    end
  end
  
  # WebSocket cable
  mount ActionCable.server => '/cable'
end
```

### 2.2 Base Controller Setup
```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  include ApiErrorHandler
  include ApiCsrfProtection
  include Authenticatable
  include SetCurrentUser
  include Paginatable
  include EtagSupport
  
  before_action :set_current_user
  before_action :authenticate_request!
  
  rescue_from StandardError, with: :handle_standard_error
  rescue_from ActiveRecord::RecordNotFound, with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid, with: :handle_validation_error
  rescue_from AuthenticationError, with: :handle_authentication_error
  rescue_from AuthorizationError, with: :handle_authorization_error
  
  private
  
  def render_success(data = {}, status = :ok)
    render json: data, status: status
  end
  
  def render_error(message, status = :unprocessable_entity, details = {})
    render json: {
      error: {
        message: message,
        details: details
      }
    }, status: status
  end
end
```

### 2.3 API Base Controller
```ruby
# app/controllers/api/v1/base_controller.rb
module Api
  module V1
    class BaseController < ApplicationController
      before_action :set_api_version
      
      private
      
      def set_api_version
        response.headers['X-API-Version'] = 'v1'
      end
      
      def current_api_version
        'v1'
      end
    end
  end
end
```

### 2.4 Example Resource Controller
```ruby
# app/controllers/api/v1/clients_controller.rb
module Api
  module V1
    class ClientsController < BaseController
      before_action :set_client, only: [:show, :update, :destroy]
      
      # GET /api/v1/clients
      def index
        @clients = Client.includes(:jobs, :devices, :people)
                        .page(params[:page])
                        .per(params[:per_page] || 20)
        
        if params[:search].present?
          @clients = @clients.where(
            "name ILIKE :search OR email ILIKE :search",
            search: "%#{params[:search]}%"
          )
        end
        
        @clients = @clients.where(client_type: params[:client_type]) if params[:client_type].present?
        
        render json: {
          clients: ActiveModel::Serializer::CollectionSerializer.new(
            @clients,
            serializer: ClientSerializer
          ),
          meta: pagination_meta(@clients)
        }
      end
      
      # GET /api/v1/clients/:id
      def show
        render json: {
          client: ClientSerializer.new(@client, include: ['jobs', 'devices', 'people']),
          recent_jobs: @client.jobs.recent.limit(5).map { |job| JobSerializer.new(job) },
          stats: {
            total_jobs: @client.jobs.count,
            active_jobs: @client.jobs.active.count,
            completed_jobs: @client.jobs.completed.count,
            total_devices: @client.devices.count
          }
        }
      end
      
      # POST /api/v1/clients
      def create
        @client = Client.new(client_params)
        
        if @client.save
          render json: {
            client: ClientSerializer.new(@client),
            message: 'Client created successfully'
          }, status: :created
        else
          render_error('Client creation failed', :unprocessable_entity, @client.errors)
        end
      end
      
      # PUT /api/v1/clients/:id
      def update
        if @client.update(client_params)
          render json: {
            client: ClientSerializer.new(@client),
            message: 'Client updated successfully'
          }
        else
          render_error('Client update failed', :unprocessable_entity, @client.errors)
        end
      end
      
      # DELETE /api/v1/clients/:id
      def destroy
        if @client.destroy
          render json: { message: 'Client deleted successfully' }
        else
          render_error('Client deletion failed', :unprocessable_entity, @client.errors)
        end
      end
      
      private
      
      def set_client
        @client = Client.find(params[:id])
      end
      
      def client_params
        params.require(:client).permit(
          :name, :email, :phone, :address, :client_type, :notes,
          :billing_address, :tax_id, :payment_terms
        )
      end
    end
  end
end
```

---

## 🗄️ Phase 3: Database Models and Relationships (60-75 minutes)

### 3.1 Base Model Setup
```ruby
# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  include HasUniqueId
  include Touchable
  include Loggable
  
  primary_abstract_class
  
  # Global scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :oldest, -> { order(created_at: :asc) }
  
  # Common validations
  validates :id, presence: true, uniqueness: true
  
  # Hooks
  before_create :generate_unique_id
  after_create :log_creation
  after_update :log_update
  after_destroy :log_destruction
  
  private
  
  def generate_unique_id
    self.id = SecureRandom.uuid if id.blank?
  end
end
```

### 3.2 Core Business Models

#### Client Model
```ruby
# app/models/client.rb
class Client < ApplicationRecord
  include CacheInvalidation
  
  # Associations
  has_many :jobs, dependent: :destroy
  has_many :devices, dependent: :destroy
  has_many :people, dependent: :destroy
  has_many :job_assignments, through: :jobs
  has_many :activity_logs, dependent: :destroy
  
  # Validations
  validates :name, presence: true, length: { minimum: 2, maximum: 255 }
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :phone, format: { with: /\A[\+]?[0-9\-\(\)\s]*\z/ }, allow_blank: true
  validates :client_type, inclusion: { in: %w[individual business government] }
  
  # Enums
  enum client_type: {
    individual: 'individual',
    business: 'business',
    government: 'government'
  }
  
  # Scopes
  scope :active, -> { where(active: true) }
  scope :by_type, ->(type) { where(client_type: type) }
  scope :search, ->(query) { where("name ILIKE :q OR email ILIKE :q", q: "%#{query}%") }
  
  # Callbacks
  before_save :normalize_name
  after_update :invalidate_related_caches
  
  # Instance methods
  def display_name
    name.presence || email
  end
  
  def full_address
    [address, city, state, zip_code].compact.join(', ')
  end
  
  def active_jobs_count
    jobs.active.count
  end
  
  def total_revenue
    jobs.completed.sum(:total_amount) || 0
  end
  
  private
  
  def normalize_name
    self.name = name.strip.titleize if name.present?
  end
  
  def invalidate_related_caches
    Rails.cache.delete("client_#{id}_stats")
    Rails.cache.delete("client_#{id}_recent_jobs")
  end
end
```

#### Job Model
```ruby
# app/models/job.rb
class Job < ApplicationRecord
  include CacheInvalidation
  include StatusConvertible
  
  # Associations
  belongs_to :client
  has_many :tasks, dependent: :destroy
  has_many :job_assignments, dependent: :destroy
  has_many :users, through: :job_assignments
  has_many :notes, dependent: :destroy
  has_many :activity_logs, dependent: :destroy
  has_many :scheduled_date_times, dependent: :destroy
  
  # Validations
  validates :title, presence: true, length: { minimum: 3, maximum: 255 }
  validates :description, length: { maximum: 2000 }
  validates :status, inclusion: { in: %w[pending active completed cancelled] }
  validates :priority, inclusion: { in: %w[low medium high urgent] }
  validates :due_at, comparison: { greater_than: :created_at }, allow_blank: true
  
  # Enums
  enum status: {
    pending: 'pending',
    active: 'active',
    completed: 'completed',
    cancelled: 'cancelled'
  }
  
  enum priority: {
    low: 'low',
    medium: 'medium',
    high: 'high',
    urgent: 'urgent'
  }
  
  # Scopes
  scope :by_status, ->(status) { where(status: status) }
  scope :by_priority, ->(priority) { where(priority: priority) }
  scope :due_soon, -> { where(due_at: Time.current..1.week.from_now) }
  scope :overdue, -> { where(due_at: ...Time.current) }
  scope :assigned_to, ->(user) { joins(:job_assignments).where(job_assignments: { user: user }) }
  
  # Callbacks
  before_save :set_completed_at
  after_update :broadcast_changes
  
  # Instance methods
  def completed?
    status == 'completed'
  end
  
  def overdue?
    due_at.present? && due_at < Time.current && !completed?
  end
  
  def progress_percentage
    return 0 if tasks.empty?
    (tasks.completed.count.to_f / tasks.count * 100).round(2)
  end
  
  def estimated_completion
    return nil unless due_at.present?
    
    if progress_percentage > 0
      days_elapsed = (Time.current - created_at) / 1.day
      total_estimated_days = days_elapsed / (progress_percentage / 100)
      created_at + total_estimated_days.days
    else
      due_at
    end
  end
  
  def assign_user(user)
    job_assignments.find_or_create_by(user: user)
  end
  
  def unassign_user(user)
    job_assignments.find_by(user: user)&.destroy
  end
  
  private
  
  def set_completed_at
    if status_changed? && status == 'completed'
      self.completed_at = Time.current
    elsif status_changed? && status != 'completed'
      self.completed_at = nil
    end
  end
  
  def broadcast_changes
    JobChannel.broadcast_to(self, {
      type: 'job_updated',
      job: JobSerializer.new(self)
    })
  end
end
```

#### Task Model
```ruby
# app/models/task.rb
class Task < ApplicationRecord
  include CacheInvalidation
  include StatusConvertible
  
  # Associations
  belongs_to :job
  belongs_to :parent, class_name: 'Task', optional: true
  has_many :subtasks, class_name: 'Task', foreign_key: 'parent_id', dependent: :destroy
  has_many :notes, dependent: :destroy
  has_many :activity_logs, dependent: :destroy
  
  # Validations
  validates :title, presence: true, length: { minimum: 3, maximum: 255 }
  validates :description, length: { maximum: 1000 }
  validates :status, inclusion: { in: %w[pending active completed cancelled] }
  validates :position, presence: true, numericality: { greater_than: 0 }
  validates :job_id, presence: true
  
  # Enums
  enum status: {
    pending: 'pending',
    active: 'active',
    completed: 'completed',
    cancelled: 'cancelled'
  }
  
  # Scopes
  scope :root_tasks, -> { where(parent_id: nil) }
  scope :subtasks, -> { where.not(parent_id: nil) }
  scope :by_status, ->(status) { where(status: status) }
  scope :ordered, -> { order(:position) }
  scope :incomplete, -> { where.not(status: 'completed') }
  
  # Acts as list for positioning
  acts_as_list scope: [:job_id, :parent_id]
  
  # Callbacks
  before_save :set_completed_at
  after_update :update_job_progress
  
  # Instance methods
  def completed?
    status == 'completed'
  end
  
  def has_subtasks?
    subtasks.any?
  end
  
  def all_subtasks_completed?
    return true if subtasks.empty?
    subtasks.all?(&:completed?)
  end
  
  def completion_percentage
    return 100 if completed?
    return 0 if subtasks.empty?
    
    (subtasks.completed.count.to_f / subtasks.count * 100).round(2)
  end
  
  def depth
    parent ? parent.depth + 1 : 0
  end
  
  def move_to_position(new_position)
    insert_at(new_position)
  end
  
  def duplicate
    new_task = self.dup
    new_task.title = "#{title} (Copy)"
    new_task.status = 'pending'
    new_task.completed_at = nil
    new_task.save!
    
    # Duplicate subtasks
    subtasks.each do |subtask|
      duplicated_subtask = subtask.dup
      duplicated_subtask.parent = new_task
      duplicated_subtask.status = 'pending'
      duplicated_subtask.completed_at = nil
      duplicated_subtask.save!
    end
    
    new_task
  end
  
  private
  
  def set_completed_at
    if status_changed? && status == 'completed'
      self.completed_at = Time.current
    elsif status_changed? && status != 'completed'
      self.completed_at = nil
    end
  end
  
  def update_job_progress
    job.touch # Updates job's updated_at timestamp
    
    # Mark parent task as completed if all subtasks are completed
    if parent && parent.all_subtasks_completed?
      parent.update!(status: 'completed')
    end
  end
end
```

### 3.3 Advanced Model Patterns

#### Polymorphic Associations
```ruby
# app/models/note.rb
class Note < ApplicationRecord
  belongs_to :notable, polymorphic: true
  belongs_to :user
  
  validates :content, presence: true, length: { minimum: 1, maximum: 2000 }
  
  scope :recent, -> { order(created_at: :desc) }
  scope :by_user, ->(user) { where(user: user) }
  
  def excerpt(length = 100)
    content.truncate(length)
  end
end
```

#### Concern for Shared Behavior
```ruby
# app/models/concerns/has_unique_id.rb
module HasUniqueId
  extend ActiveSupport::Concern
  
  included do
    validates :id, presence: true, uniqueness: true
    before_create :generate_unique_id
  end
  
  private
  
  def generate_unique_id
    self.id = SecureRandom.uuid if id.blank?
  end
end
```

---

## 🔐 Phase 4: Authentication and Authorization (45-60 minutes)

### 4.1 JWT Authentication Service
```ruby
# app/services/jwt_service.rb
class JwtService
  HMAC_SECRET = Rails.application.credentials.jwt_secret || 'dev-secret-change-in-production'
  ALGORITHM = 'HS256'.freeze
  
  def self.encode(payload, exp = 24.hours.from_now)
    payload[:exp] = exp.to_i
    JWT.encode(payload, HMAC_SECRET, ALGORITHM)
  end
  
  def self.decode(token)
    body = JWT.decode(token, HMAC_SECRET, true, { algorithm: ALGORITHM })[0]
    HashWithIndifferentAccess.new(body)
  rescue JWT::DecodeError => e
    raise AuthenticationError, "Invalid token: #{e.message}"
  end
  
  def self.valid_payload?(payload)
    payload[:exp] > Time.current.to_i
  end
  
  def self.expired?(token)
    payload = decode(token)
    payload[:exp] < Time.current.to_i
  rescue AuthenticationError
    true
  end
end
```

### 4.2 Authentication Controller
```ruby
# app/controllers/api/v1/auth_controller.rb
module Api
  module V1
    class AuthController < BaseController
      skip_before_action :authenticate_request!, only: [:login]
      
      # POST /api/v1/auth/login
      def login
        user = User.find_by(email: params[:email])
        
        if user&.authenticate(params[:password])
          token = JwtService.encode(user_id: user.id)
          refresh_token = generate_refresh_token(user)
          
          render json: {
            token: token,
            refresh_token: refresh_token.token,
            expires_in: 24.hours.to_i,
            user: UserSerializer.new(user)
          }
        else
          render_error('Invalid email or password', :unauthorized)
        end
      end
      
      # POST /api/v1/auth/refresh
      def refresh
        refresh_token = RefreshToken.find_by(token: params[:refresh_token])
        
        if refresh_token&.valid?
          new_token = JwtService.encode(user_id: refresh_token.user_id)
          new_refresh_token = generate_refresh_token(refresh_token.user)
          
          # Revoke old refresh token
          refresh_token.destroy
          
          render json: {
            token: new_token,
            refresh_token: new_refresh_token.token,
            expires_in: 24.hours.to_i,
            user: UserSerializer.new(refresh_token.user)
          }
        else
          render_error('Invalid refresh token', :unauthorized)
        end
      end
      
      # POST /api/v1/auth/logout
      def logout
        # Revoke all refresh tokens for user
        current_user.refresh_tokens.destroy_all
        
        # Add current token to revoked tokens
        RevokedToken.create(
          jti: extract_jti_from_token,
          exp: Time.current + 24.hours
        )
        
        render json: { message: 'Logged out successfully' }
      end
      
      private
      
      def generate_refresh_token(user)
        user.refresh_tokens.create!(
          token: SecureRandom.hex(32),
          expires_at: 30.days.from_now
        )
      end
      
      def extract_jti_from_token
        token = request.headers['Authorization']&.split(' ')&.last
        return nil unless token
        
        payload = JwtService.decode(token)
        payload[:jti] || Digest::SHA256.hexdigest(token)
      end
    end
  end
end
```

### 4.3 Authentication Concern
```ruby
# app/controllers/concerns/authenticatable.rb
module Authenticatable
  extend ActiveSupport::Concern
  
  included do
    attr_reader :current_user
    before_action :authenticate_request!
  end
  
  private
  
  def authenticate_request!
    @current_user = authorized_user
    raise AuthenticationError, 'Authentication required' unless @current_user
  end
  
  def authorized_user
    return nil unless auth_header.present?
    
    token = auth_header.split(' ').last
    return nil if token_revoked?(token)
    
    payload = JwtService.decode(token)
    
    if JwtService.valid_payload?(payload)
      User.find(payload[:user_id])
    else
      nil
    end
  rescue ActiveRecord::RecordNotFound, AuthenticationError
    nil
  end
  
  def auth_header
    request.headers['Authorization']
  end
  
  def token_revoked?(token)
    jti = Digest::SHA256.hexdigest(token)
    RevokedToken.exists?(jti: jti)
  end
end
```

### 4.4 Authorization Patterns
```ruby
# app/controllers/concerns/authorizable.rb
module Authorizable
  extend ActiveSupport::Concern
  
  def authorize_resource!(resource, action)
    case action
    when :read
      authorize_read!(resource)
    when :write
      authorize_write!(resource)
    when :delete
      authorize_delete!(resource)
    else
      raise AuthorizationError, "Unknown action: #{action}"
    end
  end
  
  def authorize_read!(resource)
    return if current_user.owner?
    
    case resource
    when Client
      unless current_user.can_access_client?(resource)
        raise AuthorizationError, 'Access denied to this client'
      end
    when Job
      unless current_user.can_access_job?(resource)
        raise AuthorizationError, 'Access denied to this job'
      end
    end
  end
  
  def authorize_write!(resource)
    return if current_user.owner?
    
    unless current_user.admin? || current_user.manager?
      raise AuthorizationError, 'Insufficient permissions for this action'
    end
  end
  
  def authorize_delete!(resource)
    unless current_user.owner?
      raise AuthorizationError, 'Only owners can delete resources'
    end
  end
end
```

---

## 📊 Phase 5: Serializers and API Responses (30-45 minutes)

### 5.1 Base Serializer
```ruby
# app/serializers/application_serializer.rb
class ApplicationSerializer < ActiveModel::Serializer
  include Rails.application.routes.url_helpers
  
  def created_at
    object.created_at&.iso8601
  end
  
  def updated_at
    object.updated_at&.iso8601
  end
  
  protected
  
  def current_user
    scope
  end
  
  def include_association?(association)
    instance_options[:include]&.include?(association.to_s)
  end
end
```

### 5.2 Resource Serializers
```ruby
# app/serializers/client_serializer.rb
class ClientSerializer < ApplicationSerializer
  attributes :id, :name, :email, :phone, :address, :client_type,
             :active, :created_at, :updated_at
  
  has_many :jobs, if: -> { include_association?(:jobs) }
  has_many :devices, if: -> { include_association?(:devices) }
  has_many :people, if: -> { include_association?(:people) }
  
  def jobs
    object.jobs.limit(10).map { |job| JobSerializer.new(job) }
  end
  
  def devices
    object.devices.limit(10).map { |device| DeviceSerializer.new(device) }
  end
  
  def people
    object.people.limit(10).map { |person| PersonSerializer.new(person) }
  end
end
```

```ruby
# app/serializers/job_serializer.rb
class JobSerializer < ApplicationSerializer
  attributes :id, :title, :description, :status, :priority,
             :due_at, :completed_at, :created_at, :updated_at,
             :progress_percentage, :overdue
  
  belongs_to :client
  has_many :tasks, if: -> { include_association?(:tasks) }
  has_many :assigned_users, if: -> { include_association?(:assigned_users) }
  
  def due_at
    object.due_at&.iso8601
  end
  
  def completed_at
    object.completed_at&.iso8601
  end
  
  def progress_percentage
    object.progress_percentage
  end
  
  def overdue
    object.overdue?
  end
  
  def assigned_users
    object.users.map { |user| UserSerializer.new(user) }
  end
  
  def client
    {
      id: object.client.id,
      name: object.client.name
    }
  end
end
```

### 5.3 Nested Serialization
```ruby
# app/serializers/task_serializer.rb
class TaskSerializer < ApplicationSerializer
  attributes :id, :title, :description, :status, :position,
             :completed_at, :created_at, :updated_at,
             :depth, :has_subtasks
  
  belongs_to :job
  belongs_to :parent, if: -> { object.parent.present? }
  has_many :subtasks, if: -> { include_association?(:subtasks) }
  
  def completed_at
    object.completed_at&.iso8601
  end
  
  def depth
    object.depth
  end
  
  def has_subtasks
    object.has_subtasks?
  end
  
  def parent
    return nil unless object.parent
    
    {
      id: object.parent.id,
      title: object.parent.title
    }
  end
  
  def subtasks
    object.subtasks.ordered.map { |subtask| 
      TaskSerializer.new(subtask, include: ['subtasks'])
    }
  end
  
  def job
    {
      id: object.job.id,
      title: object.job.title,
      client: {
        id: object.job.client.id,
        name: object.job.client.name
      }
    }
  end
end
```

---

## 🧪 Phase 6: Testing Backend APIs (60-75 minutes)

### 6.1 Test Setup and Helpers
```ruby
# test/test_helper.rb
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
require 'rails/test_help'

class ActiveSupport::TestCase
  # Run tests in parallel with specified workers
  parallelize(workers: :number_of_processors)
  
  # Setup all fixtures in test/fixtures/*.yml
  fixtures :all
  
  # Test helpers
  include AuthTestHelpers
  include ApiTestHelpers
  
  def setup
    # Clean database between tests
    DatabaseCleaner.clean
  end
end

class ActionDispatch::IntegrationTest
  include ApiTestHelpers
  include AuthTestHelpers
end
```

### 6.2 Authentication Test Helpers
```ruby
# test/support/auth_test_helpers.rb
module AuthTestHelpers
  def generate_jwt_token(user)
    JwtService.encode(user_id: user.id)
  end
  
  def auth_headers(user)
    token = generate_jwt_token(user)
    {
      'Authorization' => "Bearer #{token}",
      'Content-Type' => 'application/json',
      'Accept' => 'application/json'
    }
  end
  
  def authenticated_user
    @authenticated_user ||= users(:john)
  end
  
  def admin_user
    @admin_user ||= users(:admin)
  end
  
  def owner_user
    @owner_user ||= users(:owner)
  end
end
```

### 6.3 API Test Helpers
```ruby
# test/support/api_test_helpers.rb
module ApiTestHelpers
  def json_response
    JSON.parse(response.body)
  end
  
  def assert_success_response(expected_status = 200)
    assert_equal expected_status, response.status
    assert_equal 'application/json; charset=utf-8', response.content_type
  end
  
  def assert_error_response(expected_status = 422)
    assert_equal expected_status, response.status
    assert json_response.key?('error')
    assert json_response['error'].key?('message')
  end
  
  def assert_validation_error(field, message)
    assert_error_response(422)
    assert json_response['error']['details'].key?(field.to_s)
    assert_includes json_response['error']['details'][field.to_s], message
  end
  
  def assert_unauthorized
    assert_error_response(401)
    assert_includes json_response['error']['message'], 'Authentication'
  end
  
  def assert_forbidden
    assert_error_response(403)
    assert_includes json_response['error']['message'], 'Access denied'
  end
end
```

### 6.4 Controller Tests
```ruby
# test/controllers/api/v1/clients_controller_test.rb
require 'test_helper'

class Api::V1::ClientsControllerTest < ActionDispatch::IntegrationTest
  def setup
    @client = clients(:acme_corp)
    @user = authenticated_user
  end
  
  test "should get index" do
    get '/api/v1/clients', headers: auth_headers(@user)
    
    assert_success_response
    assert json_response.key?('clients')
    assert json_response.key?('meta')
    assert json_response['clients'].is_a?(Array)
  end
  
  test "should get index with search" do
    get '/api/v1/clients', 
        params: { search: 'acme' },
        headers: auth_headers(@user)
    
    assert_success_response
    clients = json_response['clients']
    assert clients.any? { |c| c['name'].downcase.include?('acme') }
  end
  
  test "should get index with pagination" do
    get '/api/v1/clients',
        params: { page: 1, per_page: 5 },
        headers: auth_headers(@user)
    
    assert_success_response
    assert json_response['meta']['current_page'] == 1
    assert json_response['meta']['per_page'] == 5
    assert json_response['clients'].length <= 5
  end
  
  test "should show client" do
    get "/api/v1/clients/#{@client.id}", headers: auth_headers(@user)
    
    assert_success_response
    client_data = json_response['client']
    assert_equal @client.id, client_data['id']
    assert_equal @client.name, client_data['name']
  end
  
  test "should create client" do
    client_params = {
      name: 'New Client',
      email: 'new@client.com',
      client_type: 'business'
    }
    
    assert_difference('Client.count') do
      post '/api/v1/clients',
           params: { client: client_params },
           headers: auth_headers(@user)
    end
    
    assert_success_response(201)
    client_data = json_response['client']
    assert_equal client_params[:name], client_data['name']
    assert_equal client_params[:email], client_data['email']
  end
  
  test "should not create client without required fields" do
    client_params = { name: '' }
    
    assert_no_difference('Client.count') do
      post '/api/v1/clients',
           params: { client: client_params },
           headers: auth_headers(@user)
    end
    
    assert_validation_error(:name, "can't be blank")
  end
  
  test "should update client" do
    new_name = 'Updated Client Name'
    
    put "/api/v1/clients/#{@client.id}",
        params: { client: { name: new_name } },
        headers: auth_headers(@user)
    
    assert_success_response
    assert_equal new_name, json_response['client']['name']
    assert_equal new_name, @client.reload.name
  end
  
  test "should destroy client" do
    assert_difference('Client.count', -1) do
      delete "/api/v1/clients/#{@client.id}", headers: auth_headers(@user)
    end
    
    assert_success_response
    assert_includes json_response['message'], 'deleted successfully'
  end
  
  test "should require authentication" do
    get '/api/v1/clients'
    assert_unauthorized
  end
  
  test "should return 404 for non-existent client" do
    get '/api/v1/clients/non-existent-id', headers: auth_headers(@user)
    assert_error_response(404)
  end
end
```

### 6.5 Model Tests
```ruby
# test/models/client_test.rb
require 'test_helper'

class ClientTest < ActiveSupport::TestCase
  def setup
    @client = clients(:acme_corp)
  end
  
  test "should be valid" do
    assert @client.valid?
  end
  
  test "should require name" do
    @client.name = nil
    assert_not @client.valid?
    assert_includes @client.errors[:name], "can't be blank"
  end
  
  test "should require email" do
    @client.email = nil
    assert_not @client.valid?
    assert_includes @client.errors[:email], "can't be blank"
  end
  
  test "should validate email format" do
    @client.email = 'invalid-email'
    assert_not @client.valid?
    assert_includes @client.errors[:email], 'is invalid'
  end
  
  test "should validate client type" do
    @client.client_type = 'invalid'
    assert_not @client.valid?
    assert_includes @client.errors[:client_type], 'is not included in the list'
  end
  
  test "should normalize name before save" do
    @client.name = '  test client  '
    @client.save!
    assert_equal 'Test Client', @client.name
  end
  
  test "should have many jobs" do
    assert_respond_to @client, :jobs
    assert_kind_of ActiveRecord::Associations::CollectionProxy, @client.jobs
  end
  
  test "should have many devices" do
    assert_respond_to @client, :devices
    assert_kind_of ActiveRecord::Associations::CollectionProxy, @client.devices
  end
  
  test "should calculate active jobs count" do
    # Create some jobs
    3.times { jobs(:server_maintenance).dup.tap { |j| j.client = @client; j.save! } }
    
    assert_equal 3, @client.active_jobs_count
  end
  
  test "should calculate total revenue" do
    # Create completed jobs with amounts
    job1 = jobs(:server_maintenance).dup
    job1.client = @client
    job1.status = 'completed'
    job1.total_amount = 1000
    job1.save!
    
    job2 = jobs(:server_maintenance).dup
    job2.client = @client
    job2.status = 'completed'
    job2.total_amount = 2000
    job2.save!
    
    assert_equal 3000, @client.total_revenue
  end
  
  test "should search by name and email" do
    results = Client.search('acme')
    assert_includes results, @client
    
    results = Client.search(@client.email)
    assert_includes results, @client
  end
end
```

### 6.6 Integration Tests
```ruby
# test/integration/job_workflow_test.rb
require 'test_helper'

class JobWorkflowTest < ActionDispatch::IntegrationTest
  def setup
    @user = authenticated_user
    @client = clients(:acme_corp)
  end
  
  test "complete job workflow" do
    # Create a job
    job_params = {
      title: 'Integration Test Job',
      description: 'Test job for integration testing',
      client_id: @client.id,
      priority: 'high'
    }
    
    post '/api/v1/jobs',
         params: { job: job_params },
         headers: auth_headers(@user)
    
    assert_success_response(201)
    job_id = json_response['job']['id']
    
    # Get the job
    get "/api/v1/jobs/#{job_id}", headers: auth_headers(@user)
    assert_success_response
    assert_equal job_params[:title], json_response['job']['title']
    
    # Add tasks to the job
    task_params = {
      title: 'Test Task',
      description: 'Test task description'
    }
    
    post "/api/v1/jobs/#{job_id}/tasks",
         params: { task: task_params },
         headers: auth_headers(@user)
    
    assert_success_response(201)
    task_id = json_response['task']['id']
    
    # Complete the task
    put "/api/v1/tasks/#{task_id}",
        params: { task: { status: 'completed' } },
        headers: auth_headers(@user)
    
    assert_success_response
    assert_equal 'completed', json_response['task']['status']
    
    # Complete the job
    put "/api/v1/jobs/#{job_id}",
        params: { job: { status: 'completed' } },
        headers: auth_headers(@user)
    
    assert_success_response
    assert_equal 'completed', json_response['job']['status']
    assert json_response['job']['completed_at'].present?
  end
end
```

---

## 🚀 Phase 7: Performance and Optimization (45-60 minutes)

### 7.1 Database Optimization
```ruby
# config/database.yml - Production optimizations
production:
  adapter: postgresql
  database: bos_production
  username: <%= ENV['DATABASE_USERNAME'] %>
  password: <%= ENV['DATABASE_PASSWORD'] %>
  host: <%= ENV['DATABASE_HOST'] %>
  port: <%= ENV['DATABASE_PORT'] || 5432 %>
  pool: <%= ENV['DATABASE_POOL'] || 20 %>
  timeout: 5000
  
  # Performance optimizations
  prepared_statements: true
  advisory_locks: true
  
  # Connection pooling
  checkout_timeout: 5
  reaping_frequency: 10
  
  # Logging
  log_slow_queries: true
  slow_query_threshold: 1000 # 1 second
```

### 7.2 Query Optimization
```ruby
# app/models/concerns/query_optimization.rb
module QueryOptimization
  extend ActiveSupport::Concern
  
  included do
    # Eager loading scopes
    scope :with_associations, -> { includes(:client, :tasks, :assigned_users) }
    scope :with_client, -> { includes(:client) }
    scope :with_tasks, -> { includes(:tasks) }
    
    # Counter cache optimizations
    counter_cache :jobs_count, column: :jobs_count
    counter_cache :completed_jobs_count, column: :completed_jobs_count
  end
  
  class_methods do
    def search_optimized(query)
      return none if query.blank?
      
      # Use full-text search for better performance
      where("to_tsvector('english', name || ' ' || description) @@ plainto_tsquery(?)", query)
    end
    
    def paginate_efficiently(page, per_page)
      offset = (page - 1) * per_page
      limit(per_page).offset(offset)
    end
  end
end
```

### 7.3 Caching Strategies
```ruby
# app/models/concerns/cache_invalidation.rb
module CacheInvalidation
  extend ActiveSupport::Concern
  
  included do
    after_save :invalidate_cache
    after_destroy :invalidate_cache
  end
  
  def cache_key_prefix
    "#{self.class.name.underscore}_#{id}"
  end
  
  def invalidate_cache
    Rails.cache.delete("#{cache_key_prefix}_serialized")
    Rails.cache.delete("#{cache_key_prefix}_stats")
    
    # Invalidate related caches
    invalidate_related_caches if respond_to?(:invalidate_related_caches, true)
  end
  
  def cached_serialize(options = {})
    Rails.cache.fetch("#{cache_key_prefix}_serialized", expires_in: 1.hour) do
      serializer_class = "#{self.class.name}Serializer".constantize
      serializer_class.new(self, options).as_json
    end
  end
end
```

### 7.4 Background Jobs
```ruby
# app/jobs/application_job.rb
class ApplicationJob < ActiveJob::Base
  include ActiveJob::Retry.new(attempts: 3)
  
  queue_as :default
  
  retry_on StandardError, wait: :exponentially_longer, attempts: 3
  discard_on ActiveRecord::RecordNotFound
  
  around_perform do |job, block|
    Rails.logger.info "Starting job: #{job.class.name}"
    start_time = Time.current
    
    block.call
    
    duration = Time.current - start_time
    Rails.logger.info "Completed job: #{job.class.name} in #{duration.round(2)}s"
  end
end
```

### 7.5 API Response Caching
```ruby
# app/controllers/concerns/etag_support.rb
module EtagSupport
  extend ActiveSupport::Concern
  
  def set_etag(resource)
    etag = generate_etag(resource)
    response.headers['ETag'] = etag
    
    if request.headers['If-None-Match'] == etag
      head :not_modified
      return true
    end
    
    false
  end
  
  private
  
  def generate_etag(resource)
    if resource.respond_to?(:updated_at)
      Digest::MD5.hexdigest("#{resource.class.name}-#{resource.id}-#{resource.updated_at}")
    else
      Digest::MD5.hexdigest(resource.to_json)
    end
  end
end
```

---

## 📚 Phase 8: Documentation and Resources (15-30 minutes)

### 8.1 API Documentation
```ruby
# Generate API documentation
# Use gems like rswag or grape-swagger

# config/initializers/rswag.rb
Rswag::Api.configure do |c|
  c.swagger_root = Rails.root.join('swagger').to_s
  c.swagger_filter = lambda { |swagger, env| swagger['host'] = env['HTTP_HOST'] }
end

# In controller
# @api {get} /api/v1/clients Get all clients
# @apiName GetClients
# @apiGroup Clients
# @apiVersion 1.0.0
```

### 8.2 Essential Resources
- **[Rails API Documentation](https://guides.rubyonrails.org/api_app.html)** - Official Rails API guide
- **[PostgreSQL Documentation](https://www.postgresql.org/docs/)** - Database documentation
- **[JWT Documentation](https://jwt.io/)** - JSON Web Token specifications
- **[ActiveJob Guide](https://guides.rubyonrails.org/active_job_basics.html)** - Background job processing

### 8.3 Development Tools
- **Pry**: Interactive debugging console
- **Rails Console**: Interactive Rails environment
- **Database Console**: Direct database access
- **Byebug**: Ruby debugger

---

## ✅ Success Criteria

You've successfully completed backend developer onboarding when you can:
- [ ] Build and maintain RESTful API endpoints following Rails conventions
- [ ] Design and implement efficient database models and relationships
- [ ] Implement secure authentication and authorization systems
- [ ] Write comprehensive tests for models, controllers, and integrations
- [ ] Optimize API performance and implement caching strategies
- [ ] Handle errors gracefully and provide meaningful error messages

---

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database status
rails db:migrate:status

# Reset database
rails db:reset

# Check database configuration
rails db:version
```

#### Authentication Issues
```ruby
# Test JWT token generation
user = User.first
token = JwtService.encode(user_id: user.id)
payload = JwtService.decode(token)
```

#### Performance Issues
```ruby
# Enable query logging
ActiveRecord::Base.logger = Logger.new(STDOUT)

# Use explain to analyze queries
User.joins(:jobs).explain
```

---

**You're now ready to build robust, scalable backend systems with the bŏs Rails API!**

*Remember: Focus on security, performance, and maintainability in everything you build.*