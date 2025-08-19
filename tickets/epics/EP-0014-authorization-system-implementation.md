# EP-0014: Comprehensive Authorization System with Action Policy and Zero Permissions Integration

## Epic Summary
Implement a comprehensive authorization system using Action Policy for Rails backend authorization and integrate it with Zero.js permissions for real-time data synchronization. This creates a unified, type-safe authorization system across the entire stack with proper role-based access control (RBAC) and field-level security.

## Problem Statement
The current application has:
- Basic role-based authentication but no proper authorization framework
- Ad-hoc permission checks scattered across controllers
- No unified permission system between Rails API and Zero.js real-time sync
- Missing field-level security implementation
- No audit trail for authorization decisions
- Lack of organization-based multi-tenancy

## Solution Overview
Implement Action Policy as the authorization framework for Rails, then generate Zero.js permissions from these policies to maintain a single source of truth for authorization across the entire application stack.

## Business Requirements

### User Roles & Permissions Matrix

| Role                | Clients       | Jobs                        | Tasks               | People       | Devices      | Users |
|---------------------|---------------|----------------------------|---------------------|--------------|--------------|-------|
| Owner               | Full          | Full                       | Full                | Full         | Full         | Full  |
| Admin               | Full          | Full                       | Anything but delete | Full         | Full         | Manage |
| Customer Specialist | View/Edit All | View/Edit/Create           | Anything but delete | Full         | Full         | View All |
| Senior Technician   | View/Edit All | View/Edit/Create           | Anything but delete | Full         | Full         | View All |
| Technician          | View Assigned | View/Edit assigned/Create  | View/Edit Assigned  | View Related | View Related | View self and those also assigned to my jobs |

### Permission Definitions
- **Full**: Create, Read, Update, Delete (CRUD)
- **Manage**: Create, Read, Update (no Delete)
- **View/Edit All**: Read and Update all records
- **View/Edit Assigned**: Read and Update only assigned records
- **View Related**: Read only records related to assigned work
- **View All**: Read all records
- **View self**: Read own record only

## Acceptance Criteria

### Phase 1: Action Policy Implementation
- [ ] Action Policy gem installed and configured
- [ ] Base ApplicationPolicy with common authorization patterns
- [ ] Organization-based multi-tenancy implemented
- [ ] Role and Permission models with proper associations
- [ ] Policies created for all models (Job, Client, Task, Person, Device, User)
- [ ] Field-level security implemented based on permission matrix
- [ ] All controllers using Action Policy authorization
- [ ] Comprehensive policy tests with 100% coverage
- [ ] Authorization audit trail implemented

### Phase 2: Zero Permissions Integration
- [ ] Zero permission generator that converts Action Policy to Zero permissions
- [ ] Generated TypeScript permissions file with proper types
- [ ] ReactiveRecord generator extended to update permissions
- [ ] Zero permissions deployed and synchronized
- [ ] JWT tokens include required authorization data
- [ ] Real-time sync respects authorization rules
- [ ] Integration tests for Rails + Zero authorization

### Phase 3: Advanced Features
- [ ] Senior Technician role fully implemented
- [ ] Complex job assignment permissions working
- [ ] Field-level permissions for sensitive data
- [ ] Cross-organization access for owners
- [ ] Permission caching for performance
- [ ] Admin interface for permission management

## Technical Design

### 1. Database Schema Updates

```ruby
# Migration: Add Organizations and Enhanced Roles
class AddAuthorizationInfrastructure < ActiveRecord::Migration[7.0]
  def change
    # Organizations for multi-tenancy
    create_table :organizations, id: :uuid do |t|
      t.string :name, null: false
      t.string :subdomain
      t.jsonb :settings, default: {}
      t.boolean :active, default: true
      t.timestamps
      t.index :subdomain, unique: true
    end
    
    # Add organization to users
    add_reference :users, :organization, type: :uuid, foreign_key: true, null: false
    
    # Add organization to clients for data isolation
    add_reference :clients, :organization, type: :uuid, foreign_key: true, null: false
    
    # Roles table for flexible permission system
    create_table :roles, id: :uuid do |t|
      t.string :name, null: false
      t.string :description
      t.boolean :system_role, default: false
      t.timestamps
      t.index :name, unique: true
    end
    
    # Permissions table
    create_table :permissions, id: :uuid do |t|
      t.string :name, null: false # Format: "resource.action"
      t.string :description
      t.timestamps
      t.index :name, unique: true
    end
    
    # Join tables
    create_table :user_roles, id: :uuid do |t|
      t.references :user, type: :uuid, foreign_key: true, null: false
      t.references :role, type: :uuid, foreign_key: true, null: false
      t.timestamps
      t.index [:user_id, :role_id], unique: true
    end
    
    create_table :role_permissions, id: :uuid do |t|
      t.references :role, type: :uuid, foreign_key: true, null: false
      t.references :permission, type: :uuid, foreign_key: true, null: false
      t.timestamps
      t.index [:role_id, :permission_id], unique: true
    end
    
    # Authorization audit log
    create_table :authorization_audits, id: :uuid do |t|
      t.references :user, type: :uuid, foreign_key: true, null: false
      t.string :action, null: false
      t.string :auditable_type
      t.uuid :auditable_id
      t.boolean :allowed, null: false
      t.string :policy_class
      t.string :ip_address
      t.string :user_agent
      t.jsonb :metadata, default: {}
      t.timestamps
      t.index [:user_id, :created_at]
      t.index [:auditable_type, :auditable_id]
    end
    
    # Add Senior Technician to existing role enum
    # Note: Update User model role enum to include 'senior_technician'
  end
end
```

### 2. Action Policy Configuration

```ruby
# app/policies/application_policy.rb
class ApplicationPolicy < ActionPolicy::Base
  authorize :user
  
  # Common authorization patterns
  def owner?
    user.has_role?('owner')
  end
  
  def admin?
    user.has_role?('admin') || owner?
  end
  
  def senior_technician?
    user.has_role?('senior_technician')
  end
  
  def technician?
    user.has_role?('technician') || senior_technician?
  end
  
  def customer_specialist?
    user.has_role?('customer_specialist')
  end
  
  def same_organization?
    return true if owner? # Owners can access across organizations
    return false unless record.respond_to?(:organization_id)
    
    record.organization_id == user.organization_id
  end
  
  # Default deny all
  def index?; false; end
  def show?; false; end
  def create?; false; end
  def update?; false; end
  def destroy?; false; end
  
  # Audit trail integration
  def authorize_with_audit(action)
    allowed = public_send("#{action}?")
    
    AuthorizationAudit.log(
      user: user,
      action: action,
      resource: record,
      allowed: allowed,
      policy: self
    )
    
    allowed
  end
  
  # Zero permission metadata
  class_attribute :zero_permissions_config
  
  class << self
    def zero_permissions(&block)
      config = ZeroPermissionsDSL.new
      config.instance_eval(&block)
      self.zero_permissions_config = config.to_h
    end
  end
end
```

### 3. Model-Specific Policies

```ruby
# app/policies/job_policy.rb
class JobPolicy < ApplicationPolicy
  # Action Policy rules
  cache :show?, :update?
  
  # Zero permissions configuration
  zero_permissions do
    table_name "jobs"
    map_rule :index?, to: :select
    map_rule :create?, to: :insert
    map_rule :update?, to: [:update_pre, :update_post]
    map_rule :destroy?, to: :delete
  end
  
  def index?
    true # But scoped by relation_scope
  end
  
  def show?
    return false unless same_organization?
    
    admin? || 
    senior_technician? ||
    customer_specialist? ||
    (technician? && (assigned_to_job? || has_job_assignment?))
  end
  
  def create?
    return false unless same_organization?
    
    admin? || senior_technician? || customer_specialist? || technician?
  end
  
  def update?
    return false unless same_organization?
    
    admin? || 
    senior_technician? ||
    customer_specialist? ||
    (technician? && assigned_to_job?)
  end
  
  def destroy?
    return false unless same_organization?
    
    owner? || admin?
  end
  
  # Scoping for index actions
  relation_scope do |scope|
    if owner?
      scope.all
    elsif admin? || senior_technician? || customer_specialist?
      scope.joins(:client).where(clients: { organization_id: user.organization_id })
    elsif technician?
      scope.joins(:client)
           .where(clients: { organization_id: user.organization_id })
           .left_joins(:job_assignments)
           .where(
             scope.arel_table[:assigned_to_id].eq(user.id)
             .or(JobAssignment.arel_table[:user_id].eq(user.id))
           )
    else
      scope.none
    end
  end
  
  private
  
  def assigned_to_job?
    record.assigned_to_id == user.id
  end
  
  def has_job_assignment?
    record.job_assignments.exists?(user_id: user.id)
  end
end

# app/policies/client_policy.rb
class ClientPolicy < ApplicationPolicy
  include FieldAuthorizable
  
  zero_permissions do
    table_name "clients"
    map_rule :index?, to: :select
    map_rule :create?, to: :insert
    map_rule :update?, to: [:update_pre, :update_post]
    map_rule :destroy?, to: :delete
  end
  
  def index?
    same_organization? && (admin? || senior_technician? || customer_specialist? || technician?)
  end
  
  def show?
    index?
  end
  
  def create?
    same_organization? && (admin? || senior_technician? || customer_specialist?)
  end
  
  def update?
    same_organization? && (admin? || senior_technician? || customer_specialist?)
  end
  
  def destroy?
    same_organization? && (owner? || admin?)
  end
  
  # Field-level permissions
  def permitted_attributes
    base = [:name, :address_1, :address_2, :city, :state, :zip, :phone, :email]
    
    if admin?
      base + [:billing_address, :billing_rate, :payment_terms, :credit_limit]
    else
      base
    end
  end
  
  relation_scope do |scope|
    if owner?
      scope.all
    else
      scope.where(organization_id: user.organization_id)
    end
  end
end

# app/policies/user_policy.rb
class UserPolicy < ApplicationPolicy
  zero_permissions do
    table_name "users"
    map_rule :index?, to: :select
    map_rule :create?, to: :insert
    map_rule :update?, to: [:update_pre, :update_post]
    map_rule :destroy?, to: :delete
  end
  
  def index?
    true # But scoped
  end
  
  def show?
    owner? || 
    (admin? && same_organization?) ||
    record.id == user.id ||
    shares_job_assignment?
  end
  
  def create?
    owner? || (admin? && same_organization?)
  end
  
  def update?
    owner? || 
    (admin? && same_organization? && !record.owner?) ||
    record.id == user.id
  end
  
  def destroy?
    owner? && record.id != user.id # Can't delete self
  end
  
  def permitted_attributes
    if owner? || admin?
      [:name, :email, :role, :organization_id]
    else
      [:name, :email] # Users can only update their own name/email
    end
  end
  
  relation_scope do |scope|
    if owner?
      scope.all
    elsif admin? || senior_technician? || customer_specialist?
      scope.where(organization_id: user.organization_id)
    elsif technician?
      # See self and other technicians assigned to same jobs
      job_ids = user.assigned_jobs.pluck(:id) + 
                user.job_assignments.pluck(:job_id)
      
      user_ids = JobAssignment.where(job_id: job_ids).pluck(:user_id) +
                 Job.where(id: job_ids).pluck(:assigned_to_id)
      
      scope.where(id: (user_ids + [user.id]).uniq)
    else
      scope.where(id: user.id)
    end
  end
  
  private
  
  def shares_job_assignment?
    return false unless technician?
    
    user_job_ids = user.assigned_jobs.pluck(:id) + 
                   user.job_assignments.pluck(:job_id)
    
    record_job_ids = record.assigned_jobs.pluck(:id) + 
                     record.job_assignments.pluck(:job_id)
    
    (user_job_ids & record_job_ids).any?
  end
end
```

### 4. Zero Permission Generator

```ruby
# lib/generators/zero_permissions_generator.rb
class ZeroPermissionsGenerator
  def self.generate
    Rails.application.eager_load!
    
    auth_data_type = generate_auth_data_type
    permissions = generate_permissions_object
    
    File.write(
      Rails.root.join('frontend/src/lib/models/generated-permissions.ts'),
      render_typescript(auth_data_type, permissions)
    )
    
    puts "✅ Generated Zero permissions from Action Policies"
  end
  
  private
  
  def self.generate_auth_data_type
    <<~TYPESCRIPT
      export type AuthData = {
        sub: string;
        role: 'owner' | 'admin' | 'senior_technician' | 'customer_specialist' | 'technician';
        organization_id: string;
        permissions?: string[];
      };
    TYPESCRIPT
  end
  
  def self.generate_permissions_object
    permissions = {}
    
    ApplicationPolicy.descendants.each do |policy_class|
      next unless policy_class.zero_permissions_config
      
      config = policy_class.zero_permissions_config
      table_name = config[:table_name]
      
      permissions[table_name] = {
        row: {
          select: generate_select_rules(policy_class),
          insert: generate_insert_rules(policy_class),
          update: {
            preMutation: generate_update_pre_rules(policy_class),
            postMutation: generate_update_post_rules(policy_class)
          },
          delete: generate_delete_rules(policy_class)
        }
      }
    end
    
    permissions
  end
  
  def self.generate_select_rules(policy_class)
    # Convert Ruby policy logic to Zero ZQL expressions
    <<~JAVASCRIPT
      [
        (auth: AuthData, {cmp, or, exists}: ExpressionBuilder<Schema, '#{policy_class.zero_permissions_config[:table_name]}'>) => {
          switch (auth.role) {
            case 'owner':
              return true; // Owners see everything
            case 'admin':
            case 'senior_technician':  
            case 'customer_specialist':
              return cmp('organization_id', auth.organization_id);
            case 'technician':
              // Complex technician rules based on model
              #{generate_technician_select_rule(policy_class)}
            default:
              return false;
          }
        }
      ]
    JAVASCRIPT
  end
  
  def self.render_typescript(auth_data_type, permissions)
    <<~TYPESCRIPT
      // 🤖 AUTO-GENERATED PERMISSIONS FROM ACTION POLICIES
      // Generated at: #{Time.current.iso8601}
      // 
      // ⚠️  DO NOT EDIT THIS FILE DIRECTLY
      // Edit the corresponding Action Policy in app/policies/
      
      import { definePermissions, ExpressionBuilder } from '@rocicorp/zero';
      import type { Schema } from './schema';
      
      #{auth_data_type}
      
      export const permissions = definePermissions<AuthData, Schema>(schema, () => {
        return #{permissions.to_json};
      });
    TYPESCRIPT
  end
end
```

### 5. Controller Integration

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::Base
  include ActionPolicy::Controller
  
  # Automatic verification in development/test
  verify_authorized except: :index
  
  rescue_from ActionPolicy::Unauthorized do |ex|
    respond_to do |format|
      format.html { redirect_to root_path, alert: "Not authorized" }
      format.json { 
        render json: { 
          error: 'Not authorized',
          details: Rails.env.development? ? ex.result.details : nil
        }, status: :forbidden
      }
    end
  end
  
  private
  
  # Context for policies
  def implicit_authorization_context
    { user: current_user }
  end
end

# app/controllers/api/v1/jobs_controller.rb
class Api::V1::JobsController < Api::V1::BaseController
  def index
    @jobs = authorized_scope(Job)
            .includes(:client, :assigned_to, :job_assignments)
    render json: @jobs
  end
  
  def show
    @job = authorize! Job.find(params[:id])
    render json: @job
  end
  
  def create
    @job = authorize! Job.new(job_params)
    
    if @job.save
      render json: @job, status: :created
    else
      render json: { errors: @job.errors }, status: :unprocessable_entity
    end
  end
  
  def update
    @job = authorize! Job.find(params[:id])
    
    if @job.update(policy_params(@job))
      render json: @job
    else
      render json: { errors: @job.errors }, status: :unprocessable_entity
    end
  end
  
  def destroy
    @job = authorize! Job.find(params[:id])
    @job.destroy
    head :no_content
  end
  
  private
  
  def job_params
    params.require(:job).permit(policy_for(Job).permitted_attributes)
  end
  
  def policy_params(job)
    params.require(:job).permit(*policy_for(job).permitted_attributes)
  end
end
```

### 6. JWT Integration for Zero

```ruby
# app/controllers/concerns/authenticatable.rb
module Authenticatable
  extend ActiveSupport::Concern
  
  def generate_zero_jwt
    payload = {
      sub: current_user.id,
      role: current_user.primary_role_name, # owner, admin, etc.
      organization_id: current_user.organization_id,
      permissions: current_user.permissions.pluck(:name),
      exp: 24.hours.from_now.to_i,
      iat: Time.current.to_i
    }
    
    JWT.encode(
      payload, 
      Rails.application.credentials.zero_auth_secret,
      'HS256'
    )
  end
  
  def zero_auth_response
    {
      token: generate_zero_jwt,
      userID: current_user.id,
      expiresAt: 24.hours.from_now.iso8601
    }
  end
end

# app/controllers/api/v1/auth_controller.rb
class Api::V1::AuthController < Api::V1::BaseController
  skip_before_action :authenticate_user!, only: [:login]
  
  def login
    user = User.find_by(email: params[:email])
    
    if user&.authenticate(params[:password])
      # Set session for Rails
      session[:user_id] = user.id
      
      # Return Zero JWT
      render json: {
        user: UserSerializer.new(user),
        zero: zero_auth_response
      }
    else
      render json: { error: 'Invalid credentials' }, status: :unauthorized
    end
  end
  
  def refresh_zero_token
    render json: { zero: zero_auth_response }
  end
end
```

### 7. ReactiveRecord Generator Extension

```ruby
# lib/generators/reactive_record/reactive_record_generator.rb
class ReactiveRecordGenerator < Rails::Generators::NamedBase
  def generate_model_files
    # ... existing generation logic
    
    # Generate Action Policy if it doesn't exist
    unless File.exist?("app/policies/#{file_name}_policy.rb")
      template "policy.rb.erb", "app/policies/#{file_name}_policy.rb"
    end
    
    # Regenerate Zero permissions
    invoke_zero_permissions_generator
  end
  
  private
  
  def invoke_zero_permissions_generator
    say "Regenerating Zero permissions...", :green
    ZeroPermissionsGenerator.generate
    
    if Rails.env.development?
      say "Deploying permissions to Zero...", :green
      system("npx zero-deploy-permissions") || 
        say("Failed to deploy permissions", :red)
    end
  end
end
```

## Implementation Tasks

### Phase 1: Foundation (Week 1)
- [ ] Install and configure Action Policy gem
- [ ] Create database migrations for organizations, roles, permissions
- [ ] Implement base ApplicationPolicy with common patterns
- [ ] Create seed data for roles and permissions
- [ ] Update User model with new role system
- [ ] Implement organization-based multi-tenancy

### Phase 2: Core Policies (Week 2)
- [ ] Create JobPolicy with full authorization rules
- [ ] Create ClientPolicy with field-level security
- [ ] Create TaskPolicy with assignment logic
- [ ] Create UserPolicy with visibility rules
- [ ] Create PersonPolicy and DevicePolicy
- [ ] Write comprehensive policy tests

### Phase 3: Controller Integration (Week 3)
- [ ] Update ApplicationController with Action Policy
- [ ] Add authorization to all API controllers
- [ ] Implement field-level filtering in controllers
- [ ] Add authorization audit logging
- [ ] Update error handling for authorization failures
- [ ] Test all endpoints with different roles

### Phase 4: Zero Integration (Week 4)
- [ ] Build Zero permissions generator
- [ ] Create TypeScript type definitions
- [ ] Extend ReactiveRecord generator
- [ ] Update JWT generation with auth data
- [ ] Deploy and test Zero permissions
- [ ] Integration tests for real-time sync

### Phase 5: Advanced Features (Week 5)
- [ ] Implement permission caching strategy
- [ ] Build admin interface for permission management
- [ ] Add authorization performance monitoring
- [ ] Create permission migration tools
- [ ] Document authorization system
- [ ] Training materials for team

## Testing Strategy

### Unit Tests
```ruby
# spec/policies/job_policy_spec.rb
RSpec.describe JobPolicy do
  let(:organization) { create(:organization) }
  let(:job) { create(:job, client: create(:client, organization: organization)) }
  
  describe_rule :update? do
    let(:user) { create(:user, organization: organization) }
    
    succeed 'when user is admin' do
      let(:user) { create(:user, :admin, organization: organization) }
    end
    
    succeed 'when user is senior technician' do
      let(:user) { create(:user, :senior_technician, organization: organization) }
    end
    
    succeed 'when user is assigned technician' do
      let(:user) { create(:user, :technician, organization: organization) }
      let(:job) { create(:job, assigned_to: user, client: create(:client, organization: organization)) }
    end
    
    failed 'when user is unassigned technician' do
      let(:user) { create(:user, :technician, organization: organization) }
    end
    
    failed 'when user is from different organization' do
      let(:user) { create(:user, :admin, organization: create(:organization)) }
    end
  end
end
```

### Integration Tests
```typescript
// frontend/src/lib/models/__tests__/authorization-integration.test.ts
describe('Authorization Integration', () => {
  it('enforces technician job visibility in Zero', async () => {
    const technician = await createUser({ role: 'technician' });
    const otherTech = await createUser({ role: 'technician' });
    
    const assignedJob = await createJob({ assigned_to_id: technician.id });
    const unassignedJob = await createJob({ assigned_to_id: otherTech.id });
    
    // Login as technician
    await loginAs(technician);
    
    // Should only see assigned job
    const jobs = await Job.all();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(assignedJob.id);
  });
  
  it('prevents unauthorized field access', async () => {
    const technician = await createUser({ role: 'technician' });
    const client = await createClient({ 
      billing_rate: 150.00,
      credit_limit: 10000
    });
    
    await loginAs(technician);
    
    const retrievedClient = await Client.find(client.id);
    expect(retrievedClient.billing_rate).toBeUndefined();
    expect(retrievedClient.credit_limit).toBeUndefined();
  });
});
```

## Success Metrics
- 100% authorization coverage on all endpoints
- Zero unauthorized data access incidents
- < 50ms authorization overhead per request
- Unified permissions across Rails and Zero
- Improved developer experience with clear policies
- Audit trail for all authorization decisions

## Risks & Mitigations
- **Risk**: Performance impact from complex authorization
  - **Mitigation**: Implement caching at policy and database levels
- **Risk**: Breaking existing functionality
  - **Mitigation**: Gradual rollout with feature flags
- **Risk**: Zero permission sync failures
  - **Mitigation**: Automated testing and monitoring
- **Risk**: Complex technician visibility rules
  - **Mitigation**: Comprehensive testing and clear documentation

## Dependencies
- Action Policy gem (~0.7.0)
- Zero.js with permission support
- JWT authentication (existing)
- Rails 7.0+
- PostgreSQL with JSONB support

## Definition of Done
- [ ] All endpoints have proper authorization
- [ ] Zero permissions generated from Action Policies
- [ ] All roles working as specified in matrix
- [ ] Field-level security implemented
- [ ] Authorization audit trail active
- [ ] Performance within acceptable limits
- [ ] Documentation complete
- [ ] Team trained on new system
- [ ] Deployed to production with monitoring