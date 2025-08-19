# Core Features

## 1. Client Management

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

## 2. Job Management

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

## 3. Task Management

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

## 4. Personnel Tracking

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

## 5. Device Management

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

## 6. Activity Logging

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

## 7. Financial Management

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

## 8. User Management

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

## 9. Search & Navigation

**Purpose:** Quickly find any information

**Key Capabilities:**
- Global search from header
- Type-ahead suggestions
- Filtered list views
- Quick navigation
- Recent items (planned)
