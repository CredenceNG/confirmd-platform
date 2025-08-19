# Backend API Requirements for Enhanced Registration & Organization Approval

## Current API Structure Review

### Existing APIs (Working)

1. **Authentication APIs**
   - `POST /auth/verification-mail` - Send verification email
   - `POST /auth/signup` - Complete user registration
   - `GET /users/{email}` - Check if user exists

2. **Organization APIs**
   - `POST /orgs` - Create organization
   - `PUT /orgs/{id}` - Update organization
   - `GET /orgs` - Get organizations list
   - `GET /orgs/{id}` - Get organization by ID

3. **User Management APIs**
   - `GET /users/profile` - Get user profile
   - `PUT /users` - Update user profile

## Required API Modifications & New Endpoints

### 1. Enhanced User Registration

#### Modify Existing Interface

```typescript
// Current AddPasswordDetails interface needs phone number
export interface AddPasswordDetails {
  email: string;
  password: string;
  isPasskey: boolean;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string; // NEW FIELD
}
```

#### Backend Changes Required:

- **Modify**: `POST /auth/signup` endpoint to accept and store phone number
- **Database**: Add `phone_number` field to users table
- **Validation**: Add phone number format validation (international format support)
- **Required Field**: Make phone number mandatory for new registrations
- **Migration**: Handle existing users without phone numbers gracefully

---

### 2. Organization Registration with Approval Workflow

#### New Organization Registration Interface

```typescript
export interface OrganizationRegistrationRequest {
  // Basic Information
  legalName: string;
  publicName: string;
  companyRegistrationNumber: string;
  website: string;

  // Regulatory Information
  regulatorId: string; // Regulator ID from lookup API
  regulationRegistrationNumber: string;

  // Location Information
  countryId: string; // Country ID from lookup
  stateId: string; // State ID from lookup
  cityId: string; // City ID from lookup
  address: string;

  // Official Contact Information
  officialContactFirstName: string;
  officialContactLastName: string;
  officialContactPhoneNumber: string;
}

export interface Country {
  id: string;
  name: string;
  code: string;
}

export interface State {
  id: string;
  name: string;
  countryId: string;
}

export interface City {
  id: string;
  name: string;
  stateId: string;
}

export interface Regulator {
  id: string;
  name: string;
  abbreviation: string;
  countryId: string;
  sector: string;
  description: string;
}

export interface OrganizationResponse {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  // ... all organization fields
}
```

#### Required New Endpoints:

##### 2.0 Location Lookup APIs

```
GET /locations/countries
```

**Purpose**: Get list of supported countries
**Headers**: No authentication required (public endpoint)
**Response**:

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "ng",
      "name": "Nigeria",
      "code": "NG"
    }
  ]
}
```

```
GET /locations/states?countryId={countryId}
```

**Purpose**: Get states for a specific country
**Headers**: No authentication required (public endpoint)
**Query Parameters**:

- `countryId` (required): Country ID
  **Response**:

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "ng-la",
      "name": "Lagos",
      "countryId": "ng"
    },
    {
      "id": "ng-ab",
      "name": "Abia",
      "countryId": "ng"
    }
  ]
}
```

```
GET /locations/cities?stateId={stateId}
```

**Purpose**: Get cities for a specific state
**Headers**: No authentication required (public endpoint)
**Query Parameters**:

- `stateId` (required): State ID
  **Response**:

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "ng-la-lag",
      "name": "Lagos Island",
      "stateId": "ng-la"
    },
    {
      "id": "ng-la-ike",
      "name": "Ikeja",
      "stateId": "ng-la"
    }
  ]
}
```

```
GET /locations/regulators?countryId={countryId}
```

**Purpose**: Get list of regulatory bodies for a specific country
**Headers**: No authentication required (public endpoint)
**Query Parameters**:

- `countryId` (required): Country ID
  **Response**:

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "ng-cbn",
      "name": "Central Bank of Nigeria",
      "abbreviation": "CBN",
      "countryId": "ng",
      "sector": "Banking & Finance",
      "description": "Regulates banking and financial institutions in Nigeria"
    },
    {
      "id": "ng-nuc",
      "name": "National Universities Commission",
      "abbreviation": "NUC",
      "countryId": "ng",
      "sector": "Education",
      "description": "Regulates universities and higher education institutions"
    },
    {
      "id": "ng-ncc",
      "name": "Nigerian Communications Commission",
      "abbreviation": "NCC",
      "countryId": "ng",
      "sector": "Telecommunications",
      "description": "Regulates telecommunications and communications services"
    }
  ]
}
```

##### 2.1 Organization Submission

```
POST /orgs/register
```

**Purpose**: Submit organization for approval
**Headers**: Authorization Bearer token
**Body**: `OrganizationRegistrationRequest`
**Business Logic**:

- Validate all required fields and data formats
- Check if user already has a pending/approved organization (prevent duplicates)
- Auto-assign status as 'pending'
- Store submitter user ID from JWT token
- Trigger automatic email notifications (submission confirmation + admin alerts)
  **Response**:

```json
{
  "statusCode": 201,
  "message": "Organization submitted for review",
  "data": {
    "organizationId": "uuid",
    "referenceNumber": "ORG-2025-001234", // Auto-generated reference
    "status": "pending",
    "submittedAt": "2025-08-12T10:30:00Z",
    "estimatedReviewTime": "3-5 business days"
  }
}
```

**Error Responses**:

- `400`: Validation errors (missing fields, invalid formats)
- `409`: User already has pending/approved organization
- `422`: Invalid regulator, location IDs, or unsupported country

##### 2.2 Get User's Organization Status

```
GET /orgs/my-organization
```

**Purpose**: Get current user's organization submission status
**Headers**: Authorization Bearer token
**Business Logic**:

- Return organization data for the authenticated user (from JWT)
- Include rejection details if status is 'rejected'
- Support resubmission workflow for rejected organizations
  **Response**:

```json
{
  "statusCode": 200,
  "data": {
    "organizationId": "uuid",
    "referenceNumber": "ORG-2025-001234",
    "status": "pending|approved|rejected",
    "submittedAt": "2025-08-12T10:30:00Z",
    "reviewedAt": "2025-08-13T14:20:00Z",
    "rejectionReason": "Invalid registration number", // Only if rejected
    "rejectionNotes": "Please provide valid documentation", // Only if rejected
    "canResubmit": true, // Only if rejected
    "organizationDetails": {
      "legalName": "Example Corp",
      "publicName": "Example",
      "website": "https://example.com"
      // ... all submitted org details
    }
  }
}
```

**Response when no organization**:

```json
{
  "statusCode": 404,
  "message": "No organization found for user",
  "data": null
}
```

---

### 3. Admin Organization Approval System

#### Admin Interface APIs

##### 3.1 Get Pending Organizations

```
GET /admin/orgs/pending
```

**Purpose**: Get list of organizations awaiting approval
**Headers**: Authorization Bearer token (Platform Admin only)
**Query Parameters**:

- `pageNumber` (default: 1)
- `pageSize` (default: 10)
- `search` (optional)
- `regulatorId` (optional filter by regulator ID)
- `countryId` (optional filter by country)

**Response**:

```json
{
  "statusCode": 200,
  "data": {
    "organizations": [
      {
        "id": "uuid",
        "legalName": "Example Corp Ltd",
        "publicName": "Example Corp",
        "submittedAt": "2025-08-12T10:30:00Z",
        "submittedBy": {
          "id": "user-uuid",
          "email": "user@example.com",
          "firstName": "John",
          "lastName": "Doe"
        },
        "regulator": {
          "id": "ng-cbn",
          "name": "Central Bank of Nigeria",
          "abbreviation": "CBN",
          "sector": "Banking & Finance"
        },
        "status": "pending"
      }
    ],
    "totalItems": 25,
    "totalPages": 3,
    "currentPage": 1
  }
}
```

##### 3.2 Get Organization Details for Review

```
GET /admin/orgs/{organizationId}/details
```

**Purpose**: Get full organization details for admin review
**Headers**: Authorization Bearer token (Platform Admin only)
**Response**:

```json
{
  "statusCode": 200,
  "data": {
    "organization": {
      /* Full organization details */
    },
    "submittedBy": {
      /* User details */
    },
    "submissionHistory": [
      {
        "action": "submitted",
        "timestamp": "2025-08-12T10:30:00Z",
        "details": "Initial submission"
      }
    ]
  }
}
```

##### 3.3 Approve Organization

```
POST /admin/orgs/{organizationId}/approve
```

**Purpose**: Approve pending organization
**Headers**: Authorization Bearer token (Platform Admin only)
**Authorization**: Verify user has `APPROVE_ORGANIZATION` permission
**Body**:

```json
{
  "approvalNotes": "Organization meets all requirements"
}
```

**Business Logic**:

1. Validate organization exists and is in 'pending' status
2. Update organization status to 'approved'
3. **Critical**: Leverage existing organization creation workflow to assign owner role to submitter
4. Log approval action with admin details in audit trail
5. Trigger automatic approval email to submitter and organization contact
6. Enable full organization features for the submitter user
   **Response**:

```json
{
  "statusCode": 200,
  "message": "Organization approved successfully",
  "data": {
    "organizationId": "uuid",
    "status": "approved",
    "approvedAt": "2025-08-13T14:20:00Z",
    "approvedBy": {
      "adminId": "uuid",
      "adminName": "John Admin"
    }
  }
}
```

**Error Responses**:

- `404`: Organization not found
- `400`: Organization not in pending status
- `403`: Insufficient admin privileges

##### 3.4 Reject Organization

```
POST /admin/orgs/{organizationId}/reject
```

**Purpose**: Reject pending organization
**Headers**: Authorization Bearer token (Platform Admin only)
**Authorization**: Verify user has `APPROVE_ORGANIZATION` permission
**Body**:

```json
{
  "rejectionReason": "Invalid company registration number", // Required
  "rejectionNotes": "Please provide valid registration documentation" // Optional
}
```

**Business Logic**:

1. Validate organization exists and is in 'pending' status
2. Validate rejectionReason is provided (mandatory field)
3. Update organization status to 'rejected'
4. Store rejection reason and notes
5. Log rejection action with admin details in audit trail
6. Trigger automatic rejection email with feedback to submitter
7. Enable resubmission workflow (organization can be edited and resubmitted)
   **Response**:

```json
{
  "statusCode": 200,
  "message": "Organization rejected",
  "data": {
    "organizationId": "uuid",
    "status": "rejected",
    "rejectedAt": "2025-08-13T14:20:00Z",
    "rejectedBy": {
      "adminId": "uuid",
      "adminName": "Jane Admin"
    },
    "rejectionReason": "Invalid company registration number",
    "canResubmit": true
  }
}
```

**Error Responses**:

- `404`: Organization not found
- `400`: Organization not in pending status or missing rejection reason
- `403`: Insufficient admin privileges

---

### 4. Email Notification System (Backend-Driven Architecture)

#### Backend-Managed Email Triggers

All email notifications should be automatically triggered by the backend as part of the business logic workflow, not requested from the frontend. This ensures reliability, security, and transactional integrity.

##### 4.1 Organization Submission Confirmation

**Backend Trigger**: Automatically triggered after successful `POST /orgs/register` completion
**Recipients**: Submitter (identified from JWT token)
**Email Content**:

- Subject: "Organization Registration Submitted - Under Review"
- Content: Confirmation with reference number, submission details, estimated review timeline
  **Backend Implementation**: Send email after database commit of organization record

##### 4.2 Organization Approval Notification

**Backend Trigger**: Automatically triggered after successful `POST /admin/orgs/{id}/approve` completion
**Recipients**:

- Primary: Submitter (from organization record)
- Secondary: Organization official contact (from organization data)
  **Email Content**:
- Subject: "Organization Approved - Welcome to [Platform Name]"
- Content: Approval confirmation, platform access instructions, organization owner role information, next steps
  **Backend Implementation**: Send email after status update and role assignment completion

##### 4.3 Organization Rejection Notification

**Backend Trigger**: Automatically triggered after successful `POST /admin/orgs/{id}/reject` completion
**Recipients**: Submitter (from organization record)
**Email Content**:

- Subject: "Organization Registration - Additional Information Required"
- Content: Specific rejection reason, detailed feedback for correction, resubmission instructions and link
  **Backend Implementation**: Send email after status update with rejection details

##### 4.4 Admin New Submission Alert

**Backend Trigger**: Automatically triggered after successful `POST /orgs/register` completion
**Recipients**: All platform users with `APPROVE_ORGANIZATION` feature/permission
**Email Content**:

- Subject: "New Organization Pending Review - [Organization Name]"
- Content: New submission summary, organization basic details, direct link to admin review interface
  **Backend Implementation**: Query admin users and send batch notification email

#### Backend Email Service Architecture

The backend should implement an internal email service that handles all notifications:

```typescript
// Internal backend email service (not exposed as API)
interface BackendEmailService {
  // Called internally by organization registration endpoint
  sendOrganizationSubmissionConfirmation(organizationId: string, submitterId: string): Promise<void>;

  // Called internally by admin approval endpoint
  sendOrganizationApprovalNotification(organizationId: string, adminNotes?: string): Promise<void>;

  // Called internally by admin rejection endpoint
  sendOrganizationRejectionNotification(organizationId: string, reason: string, notes?: string): Promise<void>;

  // Called internally by organization registration endpoint
  sendAdminNewSubmissionAlert(organizationId: string): Promise<void>;
}
```

#### Frontend Simplification

With backend-driven notifications, the frontend is simplified to:

- ✅ Display success/error messages for user actions
- ✅ Show loading states during API calls
- ❌ No email-specific API calls needed
- ❌ No email template management required
- ❌ No notification triggering logic needed

The frontend can trust that all appropriate notifications are automatically sent by the backend.

#### Backend Implementation Requirements:

- **Email Service Integration**: SMTP/SendGrid/AWS SES configuration
- **Async Processing**: Email queue system (Redis/Bull) for reliable delivery
- **Template Engine**: Server-side email template rendering with variables
- **Email Audit Trail**: Log all sent emails with delivery status
- **Error Handling**: Retry failed emails, alert admins of delivery issues
- **Template Management**: Backend admin interface for email template customization

---

### 5. Role & Permission Management

#### Required Backend Changes

The organization approval process should leverage the **existing organization creation workflow** where the submitter automatically becomes the organization owner upon approval.

##### 5.1 Organization Approval Process

When an admin approves an organization via `POST /admin/orgs/{organizationId}/approve`:

**Backend Actions on Approval**:

1. Update organization status from 'pending' to 'approved'
2. **Use existing organization creation process** to complete organization setup
3. **Automatic role assignment**: The submitter becomes organization 'owner' (existing functionality)
4. Send approval email to submitter
5. Enable full organization features for the user

This approach leverages the existing proven workflow instead of creating new role elevation mechanisms.

##### 5.2 Check User Organization Status

```
GET /users/organization-status
```

**Purpose**: Check if user has pending/approved organization
**Headers**: Authorization Bearer token
**Response**:

```json
{
  "statusCode": 200,
  "data": {
    "hasOrganization": true,
    "organizationStatus": "pending|approved|rejected",
    "requiresOrganizationRegistration": false
  }
}
```

---

### 6. Database Schema Changes

#### Users Table Modifications

```sql
ALTER TABLE users
ADD COLUMN phone_number VARCHAR(20);
```

#### Organizations Table Modifications

```sql
ALTER TABLE organizations
ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
ADD COLUMN legal_name VARCHAR(255) NOT NULL,
ADD COLUMN public_name VARCHAR(255) NOT NULL,
ADD COLUMN company_registration_number VARCHAR(100),
ADD COLUMN website VARCHAR(255),
ADD COLUMN regulator_id VARCHAR(20),
ADD COLUMN regulation_registration_number VARCHAR(100),
ADD COLUMN country_id VARCHAR(10),
ADD COLUMN state_id VARCHAR(20),
ADD COLUMN city_id VARCHAR(30),
ADD COLUMN address TEXT,
ADD COLUMN official_contact_first_name VARCHAR(100),
ADD COLUMN official_contact_last_name VARCHAR(100),
ADD COLUMN official_contact_phone VARCHAR(20),
ADD COLUMN submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN reviewed_at TIMESTAMP NULL,
ADD COLUMN reviewed_by VARCHAR(36) NULL,
ADD COLUMN rejection_reason TEXT NULL,
ADD FOREIGN KEY (regulator_id) REFERENCES regulators(id);
```

#### Location Tables (New)

```sql
CREATE TABLE countries (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(3) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE states (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  country_id VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (country_id) REFERENCES countries(id)
);

CREATE TABLE cities (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  state_id VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (state_id) REFERENCES states(id)
);

CREATE TABLE regulators (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  abbreviation VARCHAR(10),
  country_id VARCHAR(10) NOT NULL,
  sector VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (country_id) REFERENCES countries(id)
);

-- Sample data for Nigeria
INSERT INTO countries (id, name, code) VALUES ('ng', 'Nigeria', 'NG');

INSERT INTO states (id, name, country_id) VALUES
('ng-ab', 'Abia', 'ng'),
('ng-ad', 'Adamawa', 'ng'),
('ng-ak', 'Akwa Ibom', 'ng'),
('ng-an', 'Anambra', 'ng'),
('ng-ba', 'Bauchi', 'ng'),
('ng-by', 'Bayelsa', 'ng'),
('ng-be', 'Benue', 'ng'),
('ng-bo', 'Borno', 'ng'),
('ng-cr', 'Cross River', 'ng'),
('ng-de', 'Delta', 'ng'),
('ng-eb', 'Ebonyi', 'ng'),
('ng-ed', 'Edo', 'ng'),
('ng-ek', 'Ekiti', 'ng'),
('ng-en', 'Enugu', 'ng'),
('ng-fc', 'FCT - Abuja', 'ng'),
('ng-go', 'Gombe', 'ng'),
('ng-im', 'Imo', 'ng'),
('ng-ji', 'Jigawa', 'ng'),
('ng-kd', 'Kaduna', 'ng'),
('ng-kn', 'Kano', 'ng'),
('ng-kt', 'Katsina', 'ng'),
('ng-ke', 'Kebbi', 'ng'),
('ng-ko', 'Kogi', 'ng'),
('ng-kw', 'Kwara', 'ng'),
('ng-la', 'Lagos', 'ng'),
('ng-na', 'Nasarawa', 'ng'),
('ng-ni', 'Niger', 'ng'),
('ng-og', 'Ogun', 'ng'),
('ng-on', 'Ondo', 'ng'),
('ng-os', 'Osun', 'ng'),
('ng-oy', 'Oyo', 'ng'),
('ng-pl', 'Plateau', 'ng'),
('ng-ri', 'Rivers', 'ng'),
('ng-so', 'Sokoto', 'ng'),
('ng-ta', 'Taraba', 'ng'),
('ng-yo', 'Yobe', 'ng'),
('ng-za', 'Zamfara', 'ng');

-- Sample regulator data for Nigeria
INSERT INTO regulators (id, name, abbreviation, country_id, sector, description) VALUES
('ng-cbn', 'Central Bank of Nigeria', 'CBN', 'ng', 'Banking & Finance', 'Regulates banking and financial institutions in Nigeria'),
('ng-nuc', 'National Universities Commission', 'NUC', 'ng', 'Education', 'Regulates universities and higher education institutions'),
('ng-ncc', 'Nigerian Communications Commission', 'NCC', 'ng', 'Telecommunications', 'Regulates telecommunications and communications services'),
('ng-pencom', 'National Pension Commission', 'PENCOM', 'ng', 'Pension & Insurance', 'Regulates pension fund administrators and retirement savings'),
('ng-mdcn', 'Medical and Dental Council of Nigeria', 'MDCN', 'ng', 'Healthcare', 'Regulates medical and dental practice in Nigeria'),
('ng-faan', 'Federal Airports Authority of Nigeria', 'FAAN', 'ng', 'Aviation', 'Manages and regulates federal airports in Nigeria'),
('ng-ncce', 'National Commission for Colleges of Education', 'NCCE', 'ng', 'Education', 'Regulates colleges of education and teacher training'),
('ng-nabteb', 'National Business and Technical Examinations Board', 'NABTEB', 'ng', 'Education', 'Conducts and regulates technical and business examinations'),
('ng-pcn', 'Pharmacists Council of Nigeria', 'PCN', 'ng', 'Healthcare', 'Regulates pharmaceutical practice and education in Nigeria');
```

#### Organization Review History Table (New)

```sql
CREATE TABLE organization_review_history (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  admin_user_id VARCHAR(36) NOT NULL,
  action ENUM('approved', 'rejected', 'requested_changes') NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (admin_user_id) REFERENCES users(id)
);
```

---

### 7. Authentication & Authorization

#### Route Protection Requirements

1. **Organization Registration**: Requires authenticated user with 'holder' role
2. **Admin Approval Interface**: Requires 'platform_admin' role
3. **Pending Review Page**: Requires authenticated user with pending organization

#### Middleware Updates Required

1. **Check Organization Status Middleware**: Redirect users with pending organizations to review page
2. **Admin Access Middleware**: Verify platform admin role for approval routes
3. **Registration Flow Middleware**: Guide users through complete registration process

---

### 8. Configuration & Constants

#### New Enums/Constants Required

```typescript
// Organization statuses
export enum OrganizationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

// Note: Regulators are now dynamically loaded from the database
// via GET /locations/regulators?countryId={countryId} endpoint
// instead of being hardcoded as enums
```

---

### 9. Error Handling

#### New Error Codes Required

- `ORG_ALREADY_SUBMITTED` - User already has organization submission
- `ORG_APPROVAL_REQUIRED` - Organization approval required for action
- `INSUFFICIENT_ADMIN_PRIVILEGES` - Not authorized for admin actions
- `ORG_NOT_FOUND` - Organization not found for review
- `INVALID_REGULATOR_ID` - Invalid regulator ID for selected country
- `INVALID_LOCATION_ID` - Invalid country, state, or city ID

---

### 10. Audit Logging APIs

#### Get Organization Audit Logs

```typescript
GET /admin/organizations/audit-logs?page=1&limit=20&organizationId=<id>&action=<action>&startDate=<date>&endDate=<date>

// Response
export interface AuditLogEntry {
  id: string;
  organizationId: string;
  organizationName: string;
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'UPDATED' | 'DELETED';
  adminId?: string;
  adminName?: string;
  reason?: string;
  notes?: string;
  timestamp: string;
  previousStatus?: string;
  newStatus: string;
  metadata?: Record<string, any>; // Additional context data
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  totalPages: number;
  totalItems: number;
  currentPage: number;
}
```

#### Backend Implementation Requirements:

- **Database Table**: Create audit_logs table with proper indexing
- **Triggers**: Auto-log on organization status changes
- **Permissions**: Admin-only access
- **Data Retention**: Consider log retention policies

---

---

### 12. Additional Backend Implementation Considerations

#### 12.1 Data Validation & Business Rules

```typescript
// Backend validation rules to implement
interface ValidationRules {
  // Phone number validation
  phoneNumber: {
    format: 'International format (+234...)' | 'Local format (081...)';
    required: true;
    maxLength: 20;
  };

  // Organization validation
  organization: {
    legalName: { required: true; minLength: 2; maxLength: 255 };
    publicName: { required: true; minLength: 2; maxLength: 255 };
    companyRegistrationNumber: { required: true; pattern: '^[A-Z0-9-]+$' };
    website: { required: true; pattern: 'URL_REGEX' };
    regulatorId: { required: true; validateAgainstCountry: true }; // Must be valid regulator for selected country

    // Prevent duplicate submissions
    uniqueConstraints: [
      'companyRegistrationNumber', // Company reg number must be unique
      'submitterId' // One pending/approved org per user
    ];
  };
}
```

#### 12.2 Performance Optimization

```sql
-- Recommended database indexes for performance
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_submitter ON organizations(submitted_by_user_id);
CREATE INDEX idx_organizations_submitted_at ON organizations(submitted_at);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Composite indexes for admin queries
CREATE INDEX idx_organizations_status_submitted ON organizations(status, submitted_at DESC);
CREATE INDEX idx_organizations_regulator_status ON organizations(regulator, status);
```

#### 12.3 Security Implementation

```typescript
// Security measures to implement
interface SecurityMeasures {
  // Rate limiting
  rateLimits: {
    organizationSubmission: '1 submission per user per day';
    adminActions: '100 requests per admin per hour';
    locationLookup: '1000 requests per IP per hour';
  };

  // Input sanitization
  sanitization: {
    htmlStripping: ['organization.notes', 'rejectionReason', 'approvalNotes'];
    sqlInjectionPrevention: 'All database queries';
    xssPrevention: 'All text inputs';
  };

  // Authorization checks
  authorization: {
    organizationSubmission: 'Authenticated user with holder role';
    adminApproval: 'User with APPROVE_ORGANIZATION permission';
    auditLogs: 'Admin-only access';
    locationLookup: 'Public endpoint (no auth required)';
  };
}
```

#### 12.4 Error Handling Standards

```typescript
// Standardized error responses
interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: any;
  timestamp: string;
  path: string;
}

// Common error scenarios to handle
enum ErrorScenarios {
  // Organization submission errors
  ORG_ALREADY_EXISTS = 'User already has pending or approved organization',
  INVALID_REGULATOR = 'Selected regulator is not supported',
  INVALID_LOCATION = 'Country, state, or city ID is invalid',
  DUPLICATE_COMPANY_REG = 'Company registration number already exists',

  // Admin approval errors
  ORG_NOT_PENDING = 'Organization is not in pending status',
  ADMIN_INSUFFICIENT_PERMISSIONS = 'User lacks admin approval permissions',

  // General errors
  RATE_LIMIT_EXCEEDED = 'Too many requests, please try again later',
  VALIDATION_FAILED = 'Input validation failed',
  DATABASE_ERROR = 'Internal server error'
}
```

#### 12.5 Email Template Variables

```typescript
// Template variables for email content
interface EmailTemplateVariables {
  // Organization submission confirmation
  submissionConfirmation: {
    userName: string;
    organizationName: string;
    referenceNumber: string;
    submissionDate: string;
    estimatedReviewTime: string;
    supportEmail: string;
  };

  // Organization approval notification
  approvalNotification: {
    userName: string;
    organizationName: string;
    approvalDate: string;
    loginUrl: string;
    platformName: string;
    supportEmail: string;
    approvalNotes?: string;
  };

  // Organization rejection notification
  rejectionNotification: {
    userName: string;
    organizationName: string;
    rejectionDate: string;
    rejectionReason: string;
    rejectionNotes?: string;
    resubmissionUrl: string;
    supportEmail: string;
  };

  // Admin new submission alert
  adminAlert: {
    organizationName: string;
    submitterName: string;
    submitterEmail: string;
    submissionDate: string;
    regulator: string;
    reviewUrl: string;
    adminDashboardUrl: string;
  };
}
```

#### 12.6 Audit Trail Implementation

```sql
-- Comprehensive audit logging table
CREATE TABLE organization_audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  organization_name VARCHAR(255) NOT NULL,
  action ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'UPDATED', 'RESUBMITTED') NOT NULL,

  -- Admin details (null for system actions like SUBMITTED)
  admin_id VARCHAR(36),
  admin_name VARCHAR(255),

  -- Action details
  reason TEXT, -- For rejections
  notes TEXT,  -- For approvals/rejections
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,

  -- Metadata for additional context
  metadata JSON, -- Store additional context (IP address, user agent, etc.)

  -- Timestamps
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (admin_id) REFERENCES users(id),

  -- Indexes for performance
  INDEX idx_audit_org_id (organization_id),
  INDEX idx_audit_timestamp (timestamp DESC),
  INDEX idx_audit_action (action),
  INDEX idx_audit_admin (admin_id)
);
```

#### 12.7 Configuration Management

```typescript
// Environment-specific configurations
interface BackendConfig {
  email: {
    provider: 'SMTP' | 'SendGrid' | 'AWS_SES';
    fromAddress: string;
    fromName: string;
    replyToAddress: string;
    templates: {
      submissionConfirmation: string;
      approvalNotification: string;
      rejectionNotification: string;
      adminAlert: string;
    };
  };

  organization: {
    maxSubmissionsPerUser: number;
    reviewTimeEstimate: string; // "3-5 business days"
    autoReferenceNumberPrefix: string; // "ORG"
    allowResubmission: boolean;
  };

  admin: {
    maxAdminActionsPerHour: number;
    notifyAllAdminsOnSubmission: boolean;
    requireApprovalNotes: boolean;
    requireRejectionReason: boolean;
  };
}
```

---

### 13. Testing Requirements

#### 13.1 Unit Testing

- [ ] Organization registration validation
- [ ] Email notification triggers
- [ ] Role assignment on approval
- [ ] Audit logging functionality
- [ ] Location lookup APIs

#### 13.2 Integration Testing

- [ ] Complete organization approval workflow
- [ ] Email delivery testing
- [ ] Database transaction integrity
- [ ] Authentication and authorization
- [ ] Error handling scenarios

#### 13.3 Performance Testing

- [ ] Location lookup API performance
- [ ] Admin dashboard with large datasets
- [ ] Email queue processing under load
- [ ] Database query optimization
- [ ] Concurrent user submissions

---

### 11. API Security Considerations

1. **Rate Limiting**: Implement rate limiting on organization submission
2. **Data Validation**: Strict validation on all organization fields
3. **File Upload Security**: If supporting document uploads
4. **Audit Logging**: Track all admin approval actions
5. **Data Encryption**: Sensitive organization data encryption

---

## Implementation Priority & Timeline

### Phase 1: Foundation (Week 1) - CRITICAL

**Database & Core APIs**

1. ✅ **Database Schema Updates**:
   - Add `phone_number` to users table with validation
   - Extend organizations table with all new fields
   - Create location tables (countries, states, cities) with Nigerian data
   - Create audit_logs table with proper indexing

2. ✅ **Location Lookup APIs** (Public endpoints):
   - `GET /locations/countries`
   - `GET /locations/states?countryId={id}`
   - `GET /locations/cities?stateId={id}`

3. ✅ **Enhanced User Registration**:
   - Modify `POST /auth/signup` to accept phone number
   - Add phone number validation and storage

4. ✅ **Organization Registration**:
   - Implement `POST /orgs/register` with full validation
   - Implement `GET /orgs/my-organization` for status checking
   - Add business logic for duplicate prevention

### Phase 2: Admin Workflow (Week 2) - CRITICAL

**Admin APIs & Email System**

1. ✅ **Admin Approval APIs**:
   - `GET /admin/orgs/pending` with filtering and pagination
   - `GET /admin/orgs/{id}/details` for detailed review
   - `POST /admin/orgs/{id}/approve` with role elevation
   - `POST /admin/orgs/{id}/reject` with feedback system

2. ✅ **Email Notification System**:
   - Configure email service (SMTP/SendGrid/AWS SES)
   - Implement async email queue (Redis/Bull)
   - Create email templates with variable substitution
   - Integrate email triggers with all organization status changes

3. ✅ **Role Management Integration**:
   - Leverage existing organization creation workflow
   - Automatic owner role assignment on approval
   - Proper permission checking for admin operations

### Phase 3: Audit & Enhancement (Week 3) - IMPORTANT

**Audit Trail & Advanced Features**

1. ✅ **Audit Logging System**:
   - `GET /admin/organizations/audit-logs` with filtering
   - Automatic audit trail creation for all actions
   - Admin action tracking and reporting

2. ✅ **Advanced Features**:
   - Organization resubmission workflow for rejected applications
   - Enhanced error handling with specific error codes
   - Rate limiting and security measures

3. ✅ **Performance Optimization**:
   - Database indexing for admin queries
   - Caching for location lookups
   - Query optimization for large datasets

### Phase 4: Testing & Polish (Week 4) - IMPORTANT

**Quality Assurance & Documentation**

1. 🔄 **Comprehensive Testing**:
   - Unit tests for all new endpoints
   - Integration tests for complete workflows
   - Performance testing with realistic data volumes
   - Email delivery testing

2. 🔄 **Security Implementation**:
   - Input validation and sanitization
   - Rate limiting configuration
   - Authorization middleware for admin endpoints
   - SQL injection and XSS prevention

3. 🔄 **Documentation & Deployment**:
   - API documentation updates
   - Database migration scripts
   - Environment configuration guides
   - Monitoring and logging setup

**✅ = Frontend Ready | 🔄 = Backend Implementation Required**

---

## Backend Team Coordination

### Questions for Backend Team

1. **Database**: Which database system is being used? Do we need migration scripts?
2. **Email Service**: What email service is currently configured?
3. **File Storage**: If document uploads are needed, what storage solution?
4. **Authentication**: Is JWT token-based auth sufficient for role elevation?
5. **Caching**: Should organization status be cached for performance?
6. **Webhooks**: Do we need webhook support for external integrations?

### Delivery Timeline Suggestion

- **Week 1**: Database schema changes, basic endpoints
- **Week 2**: Admin approval APIs, email notifications
- **Week 3**: Role elevation, advanced features
- **Week 4**: Testing, optimization, documentation

This comprehensive API specification provides the foundation for implementing the enhanced registration and organization approval workflow.
