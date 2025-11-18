-- Add missing geo-location code columns and other fields to organisation table
ALTER TABLE "organisation"
ADD COLUMN IF NOT EXISTS "cityCode" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "countryCode" VARCHAR(2),
ADD COLUMN IF NOT EXISTS "stateCode" VARCHAR(10),
ADD COLUMN IF NOT EXISTS "companyRegistrationNumber" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

-- Create indexes for the code columns as per Prisma schema
CREATE INDEX IF NOT EXISTS "organisation_countryCode_idx" ON "organisation"("countryCode");
CREATE INDEX IF NOT EXISTS "organisation_stateCode_idx" ON "organisation"("stateCode");
CREATE INDEX IF NOT EXISTS "organisation_cityCode_idx" ON "organisation"("cityCode");

-- Add foreign key constraints to link with geo-location tables
-- Note: Using DO $$ block to safely add constraints only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organisation_cityCode_fkey'
    ) THEN
        ALTER TABLE "organisation"
        ADD CONSTRAINT "organisation_cityCode_fkey"
        FOREIGN KEY ("cityCode") REFERENCES "cities"("city_code")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organisation_countryCode_fkey'
    ) THEN
        ALTER TABLE "organisation"
        ADD CONSTRAINT "organisation_countryCode_fkey"
        FOREIGN KEY ("countryCode") REFERENCES "countries"("country_code")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'organisation_stateCode_fkey'
    ) THEN
        ALTER TABLE "organisation"
        ADD CONSTRAINT "organisation_stateCode_fkey"
        FOREIGN KEY ("stateCode") REFERENCES "states"("state_code")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
