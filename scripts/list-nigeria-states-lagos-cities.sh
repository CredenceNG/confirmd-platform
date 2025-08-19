#!/bin/bash

echo "=== NIGERIAN STATES AND LAGOS CITIES REPORT ==="
echo "Generated on: $(date)"
echo ""

echo "1. ALL NIGERIAN STATES (37 total):"
echo "State Code | State Name"
echo "-----------|----------------------------------"
docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "
SELECT 
    state_code || '         | ' || name as state_info
FROM states 
WHERE country_code = 'NG' 
ORDER BY name;
" 2>/dev/null | grep -E '^[A-Z]{2}' | head -40

echo ""
echo "2. ALL CITIES IN LAGOS STATE (36 total):"
echo "City Name           | City Code"
echo "--------------------|----------------------------------"
docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "
SELECT 
    RPAD(name, 19) || ' | ' || city_code as city_info
FROM cities 
WHERE state_code = 'LA' AND country_code = 'NG' 
ORDER BY name;
" 2>/dev/null | grep -E '| LA_' | head -40

echo ""
echo "=== REPORT COMPLETE ==="
