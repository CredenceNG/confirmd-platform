-- Migration: Add ALL missing columns to sync Prisma schema with database
-- This migration adds columns that exist in the Prisma schema but are missing from the database
-- Generated from schema drift detection on 2025-11-21

-- ============================================================================
-- Organisation table - Add missing columns
-- ============================================================================
ALTER TABLE "organisation"
  ADD COLUMN IF NOT EXISTS "did" VARCHAR,
  ADD COLUMN IF NOT EXISTS "legalName" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "ownDid" VARCHAR,
  ADD COLUMN IF NOT EXISTS "publicName" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "regulatorId" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "verkey" VARCHAR,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "notificationWebhook" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "officialContactFirstName" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "officialContactLastName" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "officialContactPhoneNumber" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "regulatoryRegistrationNumber" VARCHAR(100);

-- Add foreign key for regulatorId if regulators table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'regulators') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'organisation_regulatorId_fkey'
    ) THEN
      ALTER TABLE "organisation"
        ADD CONSTRAINT "organisation_regulatorId_fkey"
        FOREIGN KEY ("regulatorId") REFERENCES "regulators"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- Create indexes for organisation columns
CREATE INDEX IF NOT EXISTS "organisation_did_idx" ON "organisation"("did");
CREATE INDEX IF NOT EXISTS "organisation_status_idx" ON "organisation"("status");
CREATE INDEX IF NOT EXISTS "organisation_regulatorId_idx" ON "organisation"("regulatorId");

-- ============================================================================
-- Agent Invitations table - Add missing columns
-- ============================================================================
ALTER TABLE "agent_invitations"
  ADD COLUMN IF NOT EXISTS "resolvedInvitationUrl" TEXT;

-- ============================================================================
-- Countries table - Add missing columns
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'countries') THEN
    ALTER TABLE "countries"
      ADD COLUMN IF NOT EXISTS "countryCode" VARCHAR(10);

    -- Create index
    CREATE INDEX IF NOT EXISTS "countries_countryCode_idx" ON "countries"("countryCode");
  END IF;
END $$;

-- ============================================================================
-- States table - Add missing columns
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'states') THEN
    ALTER TABLE "states"
      ADD COLUMN IF NOT EXISTS "countryId" INTEGER,
      ADD COLUMN IF NOT EXISTS "countryCode" VARCHAR(10),
      ADD COLUMN IF NOT EXISTS "stateCode" VARCHAR(10);

    -- Create indexes
    CREATE INDEX IF NOT EXISTS "states_countryCode_idx" ON "states"("countryCode");
    CREATE INDEX IF NOT EXISTS "states_stateCode_idx" ON "states"("stateCode");
    CREATE INDEX IF NOT EXISTS "states_countryId_idx" ON "states"("countryId");
  END IF;
END $$;

-- ============================================================================
-- Cities table - Add missing columns
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cities') THEN
    ALTER TABLE "cities"
      ADD COLUMN IF NOT EXISTS "stateId" INTEGER,
      ADD COLUMN IF NOT EXISTS "stateCode" VARCHAR(10),
      ADD COLUMN IF NOT EXISTS "countryId" INTEGER,
      ADD COLUMN IF NOT EXISTS "countryCode" VARCHAR(10),
      ADD COLUMN IF NOT EXISTS "cityCode" VARCHAR(20);

    -- Create indexes
    CREATE INDEX IF NOT EXISTS "cities_stateCode_idx" ON "cities"("stateCode");
    CREATE INDEX IF NOT EXISTS "cities_countryCode_idx" ON "cities"("countryCode");
    CREATE INDEX IF NOT EXISTS "cities_cityCode_idx" ON "cities"("cityCode");
    CREATE INDEX IF NOT EXISTS "cities_stateId_idx" ON "cities"("stateId");
    CREATE INDEX IF NOT EXISTS "cities_countryId_idx" ON "cities"("countryId");
  END IF;
END $$;

-- ============================================================================
-- Verification: Log completion
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added missing columns to organisation, agent_invitations, countries, states, and cities tables';
END $$;
