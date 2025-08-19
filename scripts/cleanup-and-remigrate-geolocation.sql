-- Cleanup and Re-migration Script for Geolocation Data
-- This script will clean up the existing corrupted data and properly migrate using code-based relationships

-- Step 1: Backup the current data counts for verification
CREATE TEMP TABLE migration_log AS
SELECT 
    'Before cleanup' as stage,
    (SELECT COUNT(*) FROM countries) as countries_count,
    (SELECT COUNT(*) FROM states) as states_count,
    (SELECT COUNT(*) FROM cities) as cities_count,
    (SELECT COUNT(*) FROM cities WHERE country_code = 'NG') as ng_cities_count,
    NOW() as timestamp;

-- Step 2: Clean up corrupted city data
-- Remove cities that don't belong to the correct country based on their state
DELETE FROM cities 
WHERE id IN (
    SELECT c.id 
    FROM cities c 
    LEFT JOIN states s ON c.state_code = s.state_code 
    WHERE c.country_code != s.country_code
);

-- Step 3: Clean up orphaned cities (cities with no matching state)
DELETE FROM cities 
WHERE state_code NOT IN (SELECT state_code FROM states);

-- Step 4: Clean up orphaned states (states with no matching country)
DELETE FROM states 
WHERE country_code NOT IN (SELECT country_code FROM countries);

-- Step 5: Update city codes to ensure they follow the proper format (STATE_CODE_CITYID)
-- For Nigerian cities, ensure they have the proper hierarchical codes
UPDATE cities 
SET city_code = state_code || '_' || LPAD(CAST(id AS TEXT), 5, '0')
WHERE country_code = 'NG' 
AND (city_code IS NULL OR city_code = '' OR NOT city_code LIKE state_code || '_%');

-- Step 6: Verify data integrity constraints
-- Check that all cities belong to valid states in the same country
DO $$
DECLARE
    integrity_issues INT;
BEGIN
    SELECT COUNT(*) INTO integrity_issues
    FROM cities c 
    LEFT JOIN states s ON c.state_code = s.state_code 
    WHERE c.country_code != s.country_code;
    
    IF integrity_issues > 0 THEN
        RAISE EXCEPTION 'Data integrity issue: % cities have mismatched country codes with their states', integrity_issues;
    END IF;
END $$;

-- Step 7: Log the final state
INSERT INTO migration_log
SELECT 
    'After cleanup' as stage,
    (SELECT COUNT(*) FROM countries) as countries_count,
    (SELECT COUNT(*) FROM states) as states_count,
    (SELECT COUNT(*) FROM cities) as cities_count,
    (SELECT COUNT(*) FROM cities WHERE country_code = 'NG') as ng_cities_count,
    NOW() as timestamp;

-- Step 8: Show migration summary
SELECT * FROM migration_log ORDER BY timestamp;

-- Step 9: Show Nigerian states and their city counts after cleanup
SELECT 
    s.state_code,
    s.name as state_name,
    COUNT(c.id) as city_count
FROM states s 
LEFT JOIN cities c ON s.state_code = c.state_code 
WHERE s.country_code = 'NG' 
GROUP BY s.state_code, s.name 
ORDER BY s.state_code;

-- Step 10: Show sample of corrected Nigerian cities
SELECT 
    c.name,
    c.city_code,
    c.state_code,
    s.name as state_name,
    c.country_code
FROM cities c
JOIN states s ON c.state_code = s.state_code
WHERE c.country_code = 'NG'
ORDER BY c.state_code, c.name
LIMIT 20;
