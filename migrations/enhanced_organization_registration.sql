-- Migration: Enhanced Organization Registration with Approval Workflow
-- Description: Add approval status, enhanced registration fields, regulator table, and phone number to user table

-- Create regulators table first (must be before organization table changes)
CREATE TABLE regulators (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  abbreviation VARCHAR(10),
  country_id INT NOT NULL,
  sector VARCHAR(100),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX regulators_countryId_idx ON regulators(country_id);
CREATE INDEX regulators_isActive_idx ON regulators(is_active);

-- Add organization status and approval workflow fields
ALTER TABLE organisation 
ADD COLUMN status VARCHAR(20) DEFAULT 'approved',
ADD COLUMN submittedAt TIMESTAMPTZ(6),
ADD COLUMN reviewedAt TIMESTAMPTZ(6),
ADD COLUMN reviewedBy VARCHAR REFERENCES "user"(id),
ADD COLUMN rejectionReason TEXT;

-- Add enhanced organization registration fields
ALTER TABLE organisation
ADD COLUMN legalName VARCHAR(500),
ADD COLUMN publicName VARCHAR(500),
ADD COLUMN companyRegistrationNumber VARCHAR(100),
ADD COLUMN regulatorId VARCHAR(20),
ADD COLUMN regulationRegistrationNumber VARCHAR(100),
ADD COLUMN address TEXT,
ADD COLUMN officialContactFirstName VARCHAR(100),
ADD COLUMN officialContactLastName VARCHAR(100),
ADD COLUMN officialContactPhoneNumber VARCHAR(20);

-- Add foreign key constraint for regulator
ALTER TABLE organisation 
ADD CONSTRAINT fk_organisation_regulator 
FOREIGN KEY (regulatorId) REFERENCES regulators(id);

-- Add phone number to user table
ALTER TABLE "user" 
ADD COLUMN phoneNumber VARCHAR(20);

-- Update existing organizations to have 'approved' status
UPDATE organisation SET status = 'approved' WHERE status IS NULL;

-- Create index for organization status for efficient querying
CREATE INDEX idx_organisation_status ON organisation(status);
CREATE INDEX idx_organisation_submitted_at ON organisation(submittedAt);

-- Add constraint to ensure status is one of the allowed values
ALTER TABLE organisation 
ADD CONSTRAINT chk_organisation_status 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Insert sample regulator data for Nigeria (country_id = 161 for Nigeria in most standard datasets)
-- Note: Adjust country_id based on your actual countries table data
INSERT INTO regulators (id, name, abbreviation, country_id, sector, description) VALUES
('ng-cbn', 'Central Bank of Nigeria', 'CBN', 161, 'Banking & Finance', 'Regulates banking and financial institutions in Nigeria'),
('ng-nuc', 'National Universities Commission', 'NUC', 161, 'Education', 'Regulates universities and higher education institutions'),
('ng-ncc', 'Nigerian Communications Commission', 'NCC', 161, 'Telecommunications', 'Regulates telecommunications and communications services'),
('ng-pencom', 'National Pension Commission', 'PENCOM', 161, 'Pension & Insurance', 'Regulates pension fund administrators and retirement savings'),
('ng-mdcn', 'Medical and Dental Council of Nigeria', 'MDCN', 161, 'Healthcare', 'Regulates medical and dental practice in Nigeria'),
('ng-faan', 'Federal Airports Authority of Nigeria', 'FAAN', 161, 'Aviation', 'Manages and regulates federal airports in Nigeria'),
('ng-ncce', 'National Commission for Colleges of Education', 'NCCE', 161, 'Education', 'Regulates colleges of education and teacher training'),
('ng-nabteb', 'National Business and Technical Examinations Board', 'NABTEB', 161, 'Education', 'Conducts and regulates technical and business examinations'),
('ng-pcn', 'Pharmacists Council of Nigeria', 'PCN', 161, 'Healthcare', 'Regulates pharmaceutical practice and education in Nigeria'),
('ng-cac', 'Corporate Affairs Commission', 'CAC', 161, 'Corporate Registry', 'Regulates company registration and corporate affairs in Nigeria');

-- Create audit trail table for organization reviews
CREATE TABLE organization_review_history (
  id VARCHAR(36) PRIMARY KEY,
  organization_id VARCHAR(36) NOT NULL,
  admin_user_id VARCHAR(36) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rejected', 'requested_changes')),
  notes TEXT,
  created_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organisation(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

-- Create indexes for audit trail
CREATE INDEX idx_review_history_org_id ON organization_review_history(organization_id);
CREATE INDEX idx_review_history_admin_id ON organization_review_history(admin_user_id);
CREATE INDEX idx_review_history_created_at ON organization_review_history(created_at);
