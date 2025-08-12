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
  regulator: string; // Enum value
  regulationRegistrationNumber: string;
  
  // Location Information
  countryId: string; // Country ID from lookup
  stateId: string;   // State ID from lookup
  cityId: string;    // City ID from lookup
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

##### 2.1 Organization Submission
```
POST /orgs/register
```
**Purpose**: Submit organization for approval
**Headers**: Authorization Bearer token
**Body**: `OrganizationRegistrationRequest`
**Response**: 
```json
{
  "statusCode": 201,
  "message": "Organization submitted for review",
  "data": {
    "organizationId": "uuid",
    "status": "pending",
    "submittedAt": "2025-08-12T10:30:00Z"
  }
}
```

##### 2.2 Get User's Organization Status
```
GET /orgs/my-organization
```
**Purpose**: Get current user's organization submission status
**Headers**: Authorization Bearer token
**Response**:
```json
{
  "statusCode": 200,
  "data": {
    "organizationId": "uuid",
    "status": "pending|approved|rejected",
    "submittedAt": "2025-08-12T10:30:00Z",
    "reviewedAt": "2025-08-13T14:20:00Z",
    "organizationDetails": { /* full org details */ }
  }
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
- `regulator` (optional filter)

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
        "regulator": "Central Bank of Nigeria",
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
    "organization": { /* Full organization details */ },
    "submittedBy": { /* User details */ },
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
**Body**:
```json
{
  "approvalNotes": "Organization meets all requirements"
}
```
**Response**:
```json
{
  "statusCode": 200,
  "message": "Organization approved successfully",
  "data": {
    "organizationId": "uuid",
    "status": "approved",
    "approvedAt": "2025-08-13T14:20:00Z"
  }
}
```

**Backend Actions on Approval**:
1. Update organization status to 'approved'
2. Elevate user role to 'owner' for this organization
3. Send approval email to submitter
4. Enable full organization features

##### 3.4 Reject Organization
```
POST /admin/orgs/{organizationId}/reject
```
**Purpose**: Reject pending organization
**Headers**: Authorization Bearer token (Platform Admin only)
**Body**:
```json
{
  "rejectionReason": "Invalid company registration number",
  "rejectionNotes": "Please provide valid registration documentation"
}
```
**Response**:
```json
{
  "statusCode": 200,
  "message": "Organization rejected",
  "data": {
    "organizationId": "uuid",
    "status": "rejected",
    "rejectedAt": "2025-08-13T14:20:00Z",
    "rejectionReason": "Invalid company registration number"
  }
}
```

**Backend Actions on Rejection**:
1. Update organization status to 'rejected'
2. Send rejection email with reason to submitter
3. Allow resubmission (optional)

---

### 4. Email Notification System

#### Required Email Templates & Triggers

##### 4.1 Organization Submission Confirmation
**Trigger**: After successful organization submission
**Template**: 
- Subject: "Organization Registration Submitted - Under Review"
- Content: Confirmation of submission, review timeline, next steps

##### 4.2 Organization Approval Notification
**Trigger**: When admin approves organization
**Template**:
- Subject: "Organization Approved - Welcome to [Platform Name]"
- Content: Approval confirmation, access instructions, owner role details

##### 4.3 Organization Rejection Notification
**Trigger**: When admin rejects organization
**Template**:
- Subject: "Organization Registration - Additional Information Required"
- Content: Rejection reason, required corrections, resubmission instructions

##### 4.4 Admin Notification (Optional)
**Trigger**: New organization submission
**Template**:
- Subject: "New Organization Pending Review"
- Content: New submission alert for platform administrators

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
ADD COLUMN regulator VARCHAR(255),
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
ADD COLUMN rejection_reason TEXT NULL;
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
// Regulator options
export enum NigerianRegulators {
  NUC = "National Universities Commission",
  CBN = "Central Bank of Nigeria", 
  PENCOM = "The National Pension Commission PENCOM",
  MDCN = "Medical and Dental Council of Nigeria - MDCN",
  FAAN = "Federal Airports Authority of Nigeria -FAAN",
  NCC = "Nigerian Communications Commission",
  NCCE = "National Commission for Colleges of Education",
  NABTEB = "National Business and Technical Examinations Board (NABTEB)",
  PCN = "Pharmacists Council of Nigeria - PCN"
}

// Organization statuses
export enum OrganizationStatus {
  PENDING = "pending",
  APPROVED = "approved", 
  REJECTED = "rejected"
}
```

---

### 9. Error Handling

#### New Error Codes Required

- `ORG_ALREADY_SUBMITTED` - User already has organization submission
- `ORG_APPROVAL_REQUIRED` - Organization approval required for action
- `INSUFFICIENT_ADMIN_PRIVILEGES` - Not authorized for admin actions
- `ORG_NOT_FOUND` - Organization not found for review
- `INVALID_REGULATOR` - Invalid regulator selection

---

### 10. API Security Considerations

1. **Rate Limiting**: Implement rate limiting on organization submission
2. **Data Validation**: Strict validation on all organization fields
3. **File Upload Security**: If supporting document uploads
4. **Audit Logging**: Track all admin approval actions
5. **Data Encryption**: Sensitive organization data encryption

---

## Implementation Priority

### Phase 1 (Critical)
1. Modify user registration to include phone number
2. Create organization registration endpoint
3. Implement basic approval workflow
4. Add organization status checking

### Phase 2 (Important)
1. Admin approval interface APIs
2. Email notification system
3. Role elevation system
4. Enhanced error handling

### Phase 3 (Enhancement)
1. Audit logging
2. Advanced filtering and search
3. Bulk approval operations
4. Document upload support

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
