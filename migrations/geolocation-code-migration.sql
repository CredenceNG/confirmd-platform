-- Migration: Convert geolocation relationships from ID-based to code-based
-- Date: 2025-08-12
-- Purpose: Fix geolocation misalignment by using country_code and state_code

-- Step 1: Add country_code to countries table
ALTER TABLE countries ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) UNIQUE;

-- Step 2: Create a mapping of country IDs to country codes based on existing state data
-- This will help us populate the country_code field
WITH country_codes AS (
  SELECT DISTINCT 
    country_id,
    country_code
  FROM states 
  WHERE country_code IS NOT NULL AND country_code != ''
)
UPDATE countries 
SET country_code = cc.country_code
FROM country_codes cc
WHERE countries.id = cc.country_id;

-- Step 3: Add temporary columns to organisation table for codes
ALTER TABLE organisation ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);
ALTER TABLE organisation ADD COLUMN IF NOT EXISTS state_code VARCHAR(10);
ALTER TABLE organisation ADD COLUMN IF NOT EXISTS city_code VARCHAR(20);

-- Step 4: Populate the code fields in organisation table based on existing ID relationships
UPDATE organisation 
SET country_code = c.country_code
FROM countries c
WHERE organisation."countryId" = c.id AND c.country_code IS NOT NULL;

UPDATE organisation 
SET state_code = s.state_code  
FROM states s
WHERE organisation."stateId" = s.id AND s.state_code IS NOT NULL;

-- For cities, we'll create a city_code based on state_code + city name (simplified)
UPDATE organisation 
SET city_code = CONCAT(ci.state_code, '_', LOWER(REPLACE(ci.name, ' ', '_')))
FROM cities ci
WHERE organisation."cityId" = ci.id;

-- Step 5: Add state_code to states table if not exists (it should already exist)
-- This is just to ensure consistency
-- ALTER TABLE states ADD COLUMN IF NOT EXISTS state_code VARCHAR(10);

-- Step 6: Create indexes on the new code fields for performance
CREATE INDEX IF NOT EXISTS idx_countries_country_code ON countries(country_code);
CREATE INDEX IF NOT EXISTS idx_states_country_code ON states(country_code);
CREATE INDEX IF NOT EXISTS idx_states_state_code ON states(state_code);
CREATE INDEX IF NOT EXISTS idx_cities_country_code ON cities(country_code);
CREATE INDEX IF NOT EXISTS idx_cities_state_code ON cities(state_code);
CREATE INDEX IF NOT EXISTS idx_organisation_country_code ON organisation(country_code);
CREATE INDEX IF NOT EXISTS idx_organisation_state_code ON organisation(state_code);
CREATE INDEX IF NOT EXISTS idx_organisation_city_code ON organisation(city_code);

-- Note: The actual FK constraint changes will be done in the Prisma schema
-- This migration prepares the data for the schema changes
