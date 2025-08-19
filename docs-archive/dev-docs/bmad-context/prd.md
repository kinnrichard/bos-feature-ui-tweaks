# bŏs Product Requirements Document

## Executive Summary

bŏs is a client and job management system designed for IT service providers and managed service providers (MSPs). It enables efficient tracking of clients, work orders (jobs), tasks, devices, and personnel while maintaining a comprehensive audit trail of all activities.

## Product Vision

### Mission
To provide IT service teams with a streamlined, intuitive system for managing client relationships and service delivery, reducing administrative overhead while improving service quality and accountability.

### Target Users
- **Primary:** Small to medium IT service providers (1-50 technicians)
- **Secondary:** In-house IT departments managing multiple locations/departments
- **Tertiary:** Technical consultants and freelancers

### Core Values
1. **Simplicity** - Minimal clicks to complete common tasks
2. **Visibility** - Clear status of all work at a glance
3. **Accountability** - Complete audit trail of all actions
4. **Flexibility** - Adaptable to different work styles
5. **Reliability** - Rock-solid performance and data integrity

## Problem Statement

IT service providers struggle with:
- **Scattered Information** - Client details across emails, spreadsheets, and memory
- **Task Management** - No clear view of work status and assignments
- **Communication Gaps** - Technicians unaware of client history or preferences
- **Accountability Issues** - No audit trail of who did what and when
- **Manual Processes** - Time wasted on administrative tasks

## Solution Overview

bŏs addresses these challenges by providing:
- **Centralized Client Database** - All client information in one place
- **Structured Job Management** - Clear workflow from request to completion
- **Real-time Status Tracking** - Everyone knows current work state
- **Comprehensive Activity Logging** - Full audit trail for accountability
- **Efficient UI** - Designed for speed and minimal friction

## Pricing & Revenue Model

### Pricing Structure
- **Standard Pricing**: $99-250 per user per month
- **Non-Profit Discount**: $250 flat rate per month (regardless of user count)
- **Billing**: Monthly billing with 1-month free annual discount
- **No Trial Period**: Direct onboarding with immediate value delivery

### Revenue Strategy
- **Primary Revenue**: Monthly recurring subscriptions
- **Growth Model**: Network-based expansion through satisfied customers
- **Value Proposition**: Replace both PSA tools AND accounting software
- **Pricing Philosophy**: Premium pricing for premium UX and comprehensive functionality

### Competitive Pricing Advantage
- **Higher Value**: Replaces multiple tools (PSA + accounting)
- **Lower Total Cost**: Eliminates need for separate accounting software
- **Simplified Billing**: One system, one bill

## Core Features

### 1. Client Management

**Purpose:** Central repository for all client information

**Key Capabilities:**
- Client profiles with contact information
- Unique client codes for quick reference
- Client type classification (business/individual)
- Associated people and their roles
- Device inventory per client
- Activity history and notes

**Success Metrics:**
- Time to find client information < 5 seconds
- Zero duplicate client records
- 100% of client interactions logged

### 2. Job Management

**Purpose:** Track and manage all work requests

**Key Capabilities:**
- Create jobs linked to clients
- Assign multiple technicians
- Set priority levels (Critical → Proactive)
- Track status through lifecycle
- Schedule appointments
- Due date management
- Job templates (future)

**Status Workflow:**
```
Open → In Progress → Completed
  ↓         ↓           ↑
  └──→ Paused ←─────────┘
         ↓
    Waiting States
         ↓
     Cancelled
```

### 3. Task Management

**Purpose:** Break jobs into actionable items

**Key Capabilities:**
- Create tasks within jobs
- Assign to specific technicians
- Drag-and-drop reordering
- Subtask support
- Progress tracking
- Auto-sort by status (optional)

**Benefits:**
- Clear work breakdown
- Parallel work assignment
- Progress visibility

### 4. Personnel Tracking

**Purpose:** Manage client contacts and relationships

**Key Capabilities:**
- Multiple contacts per client
- Contact method storage
- Role identification
- Notes and preferences
- Job associations

**Use Cases:**
- Know who to call for access
- Track decision makers
- Maintain contact history

### 5. Device Management

**Purpose:** Track client IT assets

**Key Capabilities:**
- Device inventory per client
- Model and serial tracking
- Location information
- Person assignment
- Service history (via jobs)
- Warranty tracking (planned)

**Benefits:**
- Quick device lookup
- Preventive maintenance planning
- Asset lifecycle management

### 6. Activity Logging

**Purpose:** Maintain audit trail and accountability

**Key Capabilities:**
- Automatic action logging
- User attribution
- Timestamp tracking
- Change detail capture
- Filterable log views

**Logged Actions:**
- All creates, updates, deletes
- User logins
- Job status changes
- Task completions

### 7. Financial Management

**Purpose:** Replace QuickBooks with simple accounting for small businesses

**Key Capabilities:**
- Basic general ledger
- Invoice generation and tracking
- Payment tracking and reconciliation
- Expense management
- Financial reporting (P&L, cash flow)
- Bank transaction import (Plaid integration)

**Target Users:**
- Small IT service providers with simple accounting needs
- Business owners frustrated with QuickBooks complexity
- Second customer: Financial advisor with basic ledger requirements

**Benefits:**
- Eliminate separate accounting software subscription
- Integrated billing for IT services
- Simplified financial management
- One system for operations and finances

### 8. User Management

**Purpose:** Control system access and permissions

**Roles:**
- **Owner** - Full system control, user management
- **Administrator** - All features except user management  
- **Member** - Standard technician access

**Capabilities:**
- Role-based permissions
- Personal preferences
- Activity tracking
- Password management

### 9. Search & Navigation

**Purpose:** Quickly find any information

**Key Capabilities:**
- Global search from header
- Type-ahead suggestions
- Filtered list views
- Quick navigation
- Recent items (planned)

## User Experience Principles

### 1. Dark Theme Design
- Reduces eye strain during long sessions
- Professional appearance
- High contrast for readability
- Consistent with modern dev tools

### 2. Information Density
- Show maximum useful information
- Minimize scrolling
- Use space efficiently
- Progressive disclosure for details

### 3. Minimal Friction
- Common tasks in 1-2 clicks
- Smart defaults
- Inline editing where possible
- No unnecessary confirmations

### 4. Visual Hierarchy
- Status badges for quick scanning
- Color-coded priorities
- Clear typography scale
- Consistent spacing

### 5. Responsive Design
- Desktop-first optimization
- Functional on tablets
- Basic mobile support
- Touch-friendly targets

## Technical Requirements

### Performance
- Page loads < 200ms
- Search results < 100ms
- No perceived lag on interactions
- Support 10,000+ clients
- Handle 100+ concurrent users

### Security
- Session-based authentication
- Role-based authorization
- CSRF protection
- SQL injection prevention
- XSS protection
- Encrypted passwords (bcrypt)

### Reliability
- **99.9% uptime target** - Monitored with external tools
- **Automated backups** - DigitalOcean Managed Postgres + B2 archival
- **Database transactions** - ACID compliance for data integrity
- **Graceful error handling** - User-friendly error messages
- **Data validation** - Input sanitization and business rule enforcement

### Quality Assurance Framework
- **Backend Testing**: Minitest for Rails API test coverage
- **Frontend Testing**: Playwright for end-to-end user journey testing
- **Integration Testing**: API endpoint testing with realistic data flows
- **Performance Monitoring**: Sentry for both Rails and Svelte error tracking
- **Database Backup Strategy**:
  - **Primary**: DigitalOcean Managed Postgres (automated daily backups, 35-day retention)
  - **Archival**: Daily pg_dump exports to Backblaze B2 (long-term storage)
  - **Recovery**: Point-in-time recovery with tested restore procedures
- **Deployment Safety**: Staging environment mirrors production for pre-release testing
- **User Feedback**: In-app feedback widget for real-time issue reporting

### Scalability
- Horizontal scaling ready
- Database indexing
- Caching strategy
- Background job processing
- CDN support (future)

### Integration
- **RESTful API design** - JSON responses for all endpoints
- **RMM/MDM Integration** - Native Addigy integration (developed separately)
- **Accounting Replacement** - Built-in general ledger and financial management
- **Payment Processing** - Plaid bank integration for automated transaction import
- **Email Notifications** - Customer communication (Phase 2)
- **Webhook Support** - Third-party integrations (future)
- **Calendar Sync** - Appointment scheduling (future)

### Integration Philosophy
- **Replace, Don't Integrate**: Focus on replacing PSA and accounting tools entirely
- **Selective Integration**: Only integrate with RMM/MDM tools (Addigy, Level, Ninja)
- **API-First**: All features accessible via REST API
- **Future Extensibility**: Webhook architecture for third-party connections

## Success Metrics

### Adoption Metrics
- Daily active users
- Jobs created per day
- Tasks completed per technician
- Client records maintained

### Efficiency Metrics
- Time to create job < 30 seconds
- Time to update task < 5 seconds
- Search to result < 2 seconds
- Login to productive < 10 seconds

### Quality Metrics
- Zero data loss incidents
- < 0.1% error rate
- 100% audit trail coverage
- < 1 second page loads

### Business Metrics
- Reduced administrative time by 50%
- Improved job completion rate
- Better client satisfaction scores
- Increased technician utilization

## Competitive Analysis

### Strengths vs Competitors
- **Simplicity** - Not over-engineered
- **Speed** - Optimized for quick actions
- **Focus** - IT service specific
- **Modern** - Current tech stack
- **Extensible** - Clean architecture

### Key Differentiators
1. Dark theme optimized for technical users
2. Minimal clicks to complete tasks
3. Comprehensive activity logging
4. Flexible status/priority system
5. No feature bloat

## Go-to-Market Strategy

### Launch Timeline
- **Beta Phase**: Current - 1 month
- **First Paying Customer**: 1 month (financial advisor)
- **Market Expansion**: Tampa Bay area network

### Customer Acquisition Strategy
- **Phase 1**: Internal team as first users (immediate validation)
- **Phase 2**: Financial advisor customer (proven business model)
- **Phase 3**: Tampa Bay network expansion (end-users and small businesses)
- **Phase 4**: Referral-based growth through satisfied customers

### Target Market Penetration
- **Primary Market**: Small to medium IT service providers (1-50 technicians)
- **Geographic Focus**: Tampa Bay area initially, expanding regionally
- **Customer Profile**: Business owners frustrated with complex PSA tools
- **Network Leverage**: Existing relationships with end-users and small businesses

### Sales Process
- **Direct Sales**: Personal network outreach
- **Consultative Approach**: Understand specific pain points
- **Concierge Onboarding**: White-glove service for early customers
- **Referral Program**: Incentivize satisfied customers to refer others

### Marketing Channels
- **Word of Mouth**: Primary growth driver
- **Professional Networks**: Local business associations
- **Industry Events**: Tampa Bay technology meetups
- **Content Marketing**: Case studies and success stories

## Data Migration & Customer Onboarding

### Migration Strategy
- **Concierge IT Services**: Full-service data migration for early customers
- **Data Sources**: Import from existing PSA tools, spreadsheets, and legacy systems
- **Migration Timeline**: 1-2 weeks per customer with dedicated support
- **Data Validation**: Comprehensive testing before go-live

### Onboarding Process
- **Multi-Modal Training**: In-person, Zoom sessions, and interactive documentation
- **Personalized Setup**: Customized workflows based on customer needs
- **White-Glove Service**: Dedicated success manager for first 30 days
- **Ongoing Support**: Email and SMS support channels

### Customer Success Framework
- **Implementation Phases**:
  1. **Discovery** (Week 1): Understand current workflows and pain points
  2. **Migration** (Week 2): Data import and system configuration
  3. **Training** (Week 3): Team training and workflow optimization
  4. **Go-Live** (Week 4): Production deployment with monitoring
- **Success Metrics**: Time to value < 30 days, 90% user adoption
- **Feedback Loop**: Weekly check-ins for first month, monthly thereafter

## Future Roadmap

### Phase 1 (Current - Beta Launch)
- ✅ Core client/job/task management
- ✅ User authentication and roles
- ✅ Activity logging
- ✅ Basic search
- ✅ Device tracking
- [ ] Basic general ledger (for second customer)
- [ ] First paying customer onboarding

### Phase 2 (Next 3 months)
- [ ] Enhanced financial management (P&L, cash flow reporting)
- [ ] Plaid bank integration for transaction import
- [ ] Email notifications
- [ ] Job templates and recurring jobs
- [ ] Basic invoicing and payment tracking
- [ ] Time tracking integration

### Phase 3 (6 months)
- [ ] Advanced financial reporting
- [ ] Customer payment portals
- [ ] Mobile app for technicians
- [ ] Advanced scheduling and calendar sync
- [ ] Expense management
- [ ] Multi-tenant architecture

### Phase 4 (12 months)
- [ ] White labeling for larger MSPs
- [ ] API marketplace and webhooks
- [ ] Advanced accounting features (tax prep support)
- [ ] AI assistance for scheduling and routing
- [ ] Predictive analytics and insights

## Constraints & Assumptions

### Technical Constraints
- Ruby on Rails back end provides the API
- PostgreSQL database
- Svelte 5 front end
- Zero client-side data store

### Business Constraints
- **Small development team**: 2 human developers + 11 AI agents
- **Limited marketing budget**: Network-based growth strategy
- **Self-funded growth**: Bootstrap approach with early revenue
- **B2B sales cycle**: Direct sales through personal relationships

### Development Approach
- **Innovative Team Structure**: 2 humans + 11 AI agents for rapid development
- **Competitive Advantage**: AI-assisted development enables faster iteration
- **Quality Focus**: Human oversight with AI acceleration
- **Scalable Process**: Proven methodology for complex feature development

### Assumptions
- Users have modern browsers
- Desktop/laptop primary usage
- Reliable internet connectivity
- English-speaking users (initially)
- Technical user base

## Risk Analysis

### Technical Risks
- **Data Loss** - Mitigated by backups and transactions
- **Security Breach** - Mitigated by best practices and auditing
- **Performance** - Mitigated by caching and indexing
- **Scaling** - Mitigated by horizontal architecture

### Business Risks
- **Low Adoption** - Mitigated by user feedback and iteration
- **Feature Creep** - Mitigated by focused roadmap
- **Competition** - Mitigated by differentiation
- **Support Burden** - Mitigated by good UX and docs

## Success Criteria

The product will be considered successful when:
1. **First paying customer within 1 month** (financial advisor)
2. **50+ active companies using the system within 1 year**
3. **90% user satisfaction rating** through customer feedback
4. **< 5% monthly churn rate** with strong customer retention
5. **50% reduction in administrative overhead** for IT service providers
6. **Positive cash flow achieved within 6 months**
7. **Successful accounting replacement** for small business customers

## Appendices

### A. User Personas

**Tech Tom - Senior Technician**
- 10+ years experience
- Manages complex projects
- Values efficiency and clarity
- Needs quick access to history

**Admin Alice - Service Manager**
- Oversees team of 5-10
- Focuses on metrics and SLAs
- Needs visibility and reporting
- Makes assignment decisions

**Owner Owen - Business Owner**
- Runs MSP with 20 employees
- Cares about profitability
- Needs high-level insights
- Makes strategic decisions

### B. Use Case Examples

**Emergency Support Request**
1. Client calls with server down
2. Admin creates critical job
3. Assigns to available tech
4. Tech updates progress
5. Client notified of resolution

**Preventive Maintenance**
1. Monthly task appears
2. Tech reviews device list
3. Schedules client visit
4. Completes checklist
5. Documents findings

### C. Competitive Landscape

**Direct Competitors:**
- ConnectWise Manage
- Autotask PSA
- Syncro MSP
- Atera

**Indirect Competitors:**
- Generic ticketing systems
- Project management tools
- Spreadsheets and email

### D. Technical Stack Rationale

**Why Rails?**
- Rapid development
- Convention over configuration
- Mature ecosystem
- Strong security defaults

**Why PostgreSQL?**
- ACID compliance
- JSON support
- Full-text search
- Proven reliability