#!/bin/bash

echo "=== GEOLOCATION DATA MIGRATION VERIFICATION REPORT ==="
echo "Generated on: $(date)"
echo ""

echo "1. OVERALL DATA COUNTS:"
docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "
SELECT 
    'Countries' as table_name, COUNT(*) as total_count FROM countries
UNION ALL
SELECT 
    'States' as table_name, COUNT(*) as total_count FROM states  
UNION ALL
SELECT 
    'Cities' as table_name, COUNT(*) as total_count FROM cities
UNION ALL
SELECT 
    'Nigerian States' as table_name, COUNT(*) as total_count FROM states WHERE country_code = 'NG'
UNION ALL
SELECT 
    'Nigerian Cities' as table_name, COUNT(*) as total_count FROM cities WHERE country_code = 'NG';
" 2>/dev/null

echo ""
echo "2. DATA INTEGRITY CHECK:"
docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS: No data integrity issues found'
        ELSE 'FAIL: ' || COUNT(*) || ' cities have mismatched country codes with their states'
    END as integrity_status
FROM cities c 
LEFT JOIN states s ON c.state_code = s.state_code 
WHERE c.country_code != s.country_code;
" 2>/dev/null

echo ""
echo "3. NIGERIAN STATES AND CITY COUNTS:"
docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "
SELECT 
    s.state_code,
    LEFT(s.name, 25) as state_name,
    COUNT(c.id) as city_count
FROM states s 
LEFT JOIN cities c ON s.state_code = c.state_code 
WHERE s.country_code = 'NG' 
GROUP BY s.state_code, s.name 
ORDER BY s.state_code;
" 2>/dev/null

echo ""
echo "4. SAMPLE KANO STATE CITIES:"
docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "
SELECT name, city_code, state_code, country_code 
FROM cities 
WHERE state_code = 'KN' AND country_code = 'NG' 
ORDER BY name;
" 2>/dev/null

echo ""
echo "5. SAMPLE LAGOS STATE CITIES:"
docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "
SELECT name, city_code, state_code, country_code 
FROM cities 
WHERE state_code = 'LA' AND country_code = 'NG' 
ORDER BY name 
LIMIT 10;
" 2>/dev/null

echo ""
echo "=== MIGRATION VERIFICATION COMPLETE ==="
