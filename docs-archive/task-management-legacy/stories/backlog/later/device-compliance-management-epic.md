# Device Compliance Management Epic

## Overview
This epic outlines the implementation of a comprehensive device compliance management system within the existing Job/Task framework. The system will track device state goals (both automated and manual), identify non-compliant devices, and facilitate remediation through task assignment to technicians.

**Business Value**: Streamline device management by automating compliance tracking and remediation workflows, reducing manual overhead and ensuring consistent device configurations across the organization.

**Total Estimated Time**: 8 weeks (phased approach)
**Initial MVP Time**: 2 weeks

## Core Concept

The system leverages the existing Job/Task infrastructure by treating device compliance as a specialized job type. Each compliance check becomes a task, with failures triggering remediation workflows. This approach minimizes new infrastructure while providing flexibility for future enhancements.

### Key Requirements
- Track 20+ automated device state checks via MDM integration
- Support manual compliance checks requiring technician verification  
- Generate remediation tasks for non-compliant devices
- Provide clear visibility into device compliance status
- Enable bulk remediation operations
- Maintain audit trail of compliance changes

## Implementation Phases

### Phase 1: Job-Task Extension Pattern (Weeks 1-2)
**Goal**: Establish basic compliance tracking using existing infrastructure

#### Database Schema Changes
```ruby
# Add to existing schema
add_column :jobs, :device_id, :integer
add_column :jobs, :job_type, :string, default: 'standard'
add_index :jobs, :device_id
add_index :jobs, [:job_type, :device_id]

# New columns for tasks
add_column :tasks, :check_name, :string
add_column :tasks, :automated, :boolean, default: true
add_column :tasks, :expected_result, :jsonb
add_column :tasks, :actual_result, :jsonb  
add_column :tasks, :remediation_required, :boolean, default: false
add_index :tasks, :remediation_required

# Device model (if not exists)
create_table :devices do |t|
  t.string :serial_number, null: false
  t.string :device_name
  t.string :mdm_id
  t.jsonb :mdm_data
  t.timestamps
end
add_index :devices, :serial_number, unique: true
add_index :devices, :mdm_id, unique: true
```

#### User Stories

**Story 1.1: View Device Compliance Status**
- **As a** technician
- **I want** to see a list of devices with their compliance status
- **So that** I can quickly identify which devices need attention

**Acceptance Criteria**:
- Device list shows compliance summary (e.g., "18/23 checks passing")
- Devices are sortable by compliance percentage
- Non-compliant devices are visually highlighted
- List is filterable by compliance status

**Technical Notes**:
- Create `DeviceComplianceJob` class inheriting from Job
- Implement compliance calculation in Device model
- Add compliance status to device serializer

**Time Estimate**: 2 days

---

**Story 1.2: MDM Data Synchronization**
- **As a** system administrator
- **I want** automated synchronization with MDM data
- **So that** compliance checks reflect current device state

**Acceptance Criteria**:
- MDM sync runs every 4 hours via scheduled job
- Creates/updates DeviceComplianceJob for each device
- Generates DeviceCheckTask for each compliance rule
- Handles MDM API failures gracefully

**Technical Notes**:
- Implement MDM gem integration service
- Use Sidekiq for background processing
- Store raw MDM data in device.mdm_data

**Time Estimate**: 3 days

---

**Story 1.3: Remediation Task Assignment**
- **As a** technician
- **I want** to claim and complete remediation tasks
- **So that** I can fix non-compliant devices

**Acceptance Criteria**:
- Remediation tasks appear in standard task queue
- Tasks include device information and remediation instructions
- Completing a task triggers re-check of compliance
- Bulk assignment for similar tasks across devices

**Technical Notes**:
- Extend Task views to show device context
- Add remediation instructions to task description
- Implement completion callback to trigger re-check

**Time Estimate**: 2 days

---

**Story 1.4: Manual Compliance Checks**
- **As a** technician  
- **I want** to complete manual compliance checks
- **So that** non-automated requirements are tracked

**Acceptance Criteria**:
- Manual check tasks clearly marked in UI
- Technician can mark check as pass/fail with notes
- System tracks who performed check and when
- Manual checks expire after 30 days

**Technical Notes**:
- Add `manual_check_expires_at` to tasks
- Create ManualCheckTask subclass
- Add validation for manual check completion

**Time Estimate**: 3 days

### Phase 2: Rule-Based Configuration (Weeks 3-4)
**Goal**: Replace hardcoded checks with configurable compliance rules

#### Database Schema Changes
```ruby
create_table :compliance_rules do |t|
  t.string :name, null: false
  t.string :check_type, null: false # 'automated' or 'manual'
  t.jsonb :expected_value
  t.text :remediation_instructions
  t.integer :priority, default: 0
  t.string :category # 'security', 'storage', 'configuration', 'software'
  t.string :mdm_field_path # JSONPath to extract from MDM data
  t.timestamps
end

create_table :device_compliance_profiles do |t|
  t.references :device
  t.references :compliance_rule
  t.boolean :enabled, default: true
  t.timestamps
end

add_column :tasks, :compliance_rule_id, :integer
add_index :tasks, :compliance_rule_id
```

#### User Stories

**Story 2.1: Compliance Rule Management**
- **As an** administrator
- **I want** to create and manage compliance rules
- **So that** I can adjust requirements without code changes

**Acceptance Criteria**:
- CRUD interface for compliance rules
- Rules support various comparison operators
- Preview shows which devices would fail
- Import/export rules as JSON

**Time Estimate**: 3 days

---

**Story 2.2: Dynamic Check Evaluation**
- **As a** system
- **I want** to evaluate rules against MDM data dynamically
- **So that** checks adapt to rule changes

**Acceptance Criteria**:
- JSONPath extraction from MDM data
- Support for numeric, boolean, string comparisons
- Handle missing/null data gracefully
- Performance remains under 100ms per device

**Time Estimate**: 3 days

---

**Story 2.3: Rule Categories and Filtering**
- **As a** technician
- **I want** to filter compliance issues by category
- **So that** I can focus on specific types of problems

**Acceptance Criteria**:
- Rules organized into logical categories
- Task queue filterable by category
- Dashboard shows breakdown by category
- Bulk operations per category

**Time Estimate**: 2 days

### Phase 3: Visual State Management (Weeks 5-6)
**Goal**: Add intuitive visualization and state tracking

#### Database Schema Changes
```ruby
add_column :devices, :compliance_state, :string, default: 'unknown'
add_column :devices, :last_compliance_check, :datetime
add_column :devices, :compliance_score, :integer

create_table :compliance_state_changes do |t|
  t.references :device
  t.string :from_state
  t.string :to_state
  t.string :trigger # 'check_completed', 'remediation_started', etc
  t.jsonb :details
  t.timestamps
end
```

#### User Stories

**Story 3.1: Compliance Dashboard**
- **As a** manager
- **I want** a visual dashboard of fleet compliance
- **So that** I can monitor overall device health

**Acceptance Criteria**:
- Traffic light visualization (green/yellow/red)
- Compliance trends over time
- Drill-down to specific issues
- Export compliance reports

**Time Estimate**: 3 days

---

**Story 3.2: Real-time Status Updates**
- **As a** technician
- **I want** to see compliance status update in real-time
- **So that** I know when remediation is successful

**Acceptance Criteria**:
- WebSocket updates for status changes
- Toast notifications for critical issues
- Activity feed shows recent changes
- No page refresh required

**Time Estimate**: 3 days

---

**Story 3.3: Compliance History**
- **As an** auditor
- **I want** to see historical compliance data
- **So that** I can track improvement over time

**Acceptance Criteria**:
- Timeline view per device
- State change audit log
- Compliance score trends
- Export to CSV/PDF

**Time Estimate**: 2 days

### Phase 4: Template System (Weeks 7-8)
**Goal**: Enable reusable compliance profiles for device groups

#### Database Schema Changes
```ruby
create_table :compliance_templates do |t|
  t.string :name, null: false
  t.text :description
  t.boolean :active, default: true
  t.timestamps
end

create_table :compliance_template_rules do |t|
  t.references :compliance_template
  t.references :compliance_rule
  t.timestamps
end

add_column :devices, :compliance_template_id, :integer
```

#### User Stories

**Story 4.1: Template Creation**
- **As an** administrator
- **I want** to create compliance templates
- **So that** I can apply consistent rules to device groups

**Acceptance Criteria**:
- Create templates with multiple rules
- Preview affected devices before applying
- Clone existing templates
- Version control for templates

**Time Estimate**: 3 days

---

**Story 4.2: Bulk Template Assignment**
- **As an** administrator
- **I want** to assign templates to multiple devices
- **So that** I can efficiently manage large fleets

**Acceptance Criteria**:
- Select devices by various criteria
- Apply template with confirmation
- Schedule template changes
- Rollback capability

**Time Estimate**: 2 days

---

**Story 4.3: Template-based Reporting**
- **As a** manager
- **I want** reports grouped by compliance template
- **So that** I can see patterns across device types

**Acceptance Criteria**:
- Compliance breakdown by template
- Compare templates side-by-side
- Identify common failure patterns
- Suggest rule adjustments

**Time Estimate**: 3 days

## Technical Considerations

### Performance
- Implement caching for compliance calculations
- Use database views for complex queries
- Consider read replicas for reporting
- Batch MDM API calls

### Security
- Encrypt sensitive MDM data at rest
- Audit log all compliance changes
- Role-based access to rule management
- Secure API endpoints

### Scalability
- Design for 10,000+ devices
- Horizontal scaling for check processing
- Queue system for remediation tasks
- Archival strategy for old compliance data

### Integration Points
- MDM API (read-only access)
- Existing Job/Task system
- Authentication/authorization system
- Notification system
- Reporting infrastructure

## Success Metrics
- **Compliance Visibility**: Time to identify non-compliant devices < 5 seconds
- **Remediation Efficiency**: Average time to remediation reduced by 50%
- **Automation Rate**: 80% of checks fully automated
- **User Satisfaction**: Technician NPS > 8
- **System Reliability**: 99.9% uptime for compliance checks

## Migration Strategy
Since this is greenfield, no migration needed. However, consider:
- Gradual rollout by device groups
- Beta testing with subset of devices
- Parallel run with manual processes initially
- Clear rollback procedures

## Future Enhancements
- Machine learning for predictive compliance
- Integration with ticketing systems
- Mobile app for field technicians
- Automated remediation for safe operations
- Compliance as a service for other systems

## Risk Mitigation
- **MDM API Changes**: Abstract API calls behind service layer
- **Performance Issues**: Start with small device groups
- **User Adoption**: Involve technicians in design process
- **Data Quality**: Implement validation and error handling
- **Scope Creep**: Stick to phased approach

## Dependencies
- MDM API access and documentation
- Ruby gem for MDM integration
- Background job processing (Sidekiq)
- WebSocket infrastructure (for Phase 3)
- Reporting system access

## Team Resources
- 1 Full-stack developer (lead)
- 1 Backend developer (MDM integration)
- 0.5 Frontend developer (dashboard)
- 0.25 DevOps (infrastructure)
- 0.25 QA Engineer
- Product Owner for requirements