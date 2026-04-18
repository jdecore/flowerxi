SQL_QUERIES = {
    "regions": """
        SELECT slug, name, city, crop_focus, department, production_share
        FROM flowerxi_regions
        ORDER BY production_share DESC NULLS LAST, name ASC;
    """,
    
    "dashboard_snapshot": """
        SELECT
          reg.name AS region_name,
          reg.city AS region_city,
          reg.crop_focus,
          w.observed_on,
          w.temp_mean_c,
          w.precipitation_mm,
          r.fungal_risk,
          r.waterlogging_risk,
          r.heat_risk,
          r.global_risk_level,
          rec.title AS recommendation_title,
          rec.message AS recommendation_message
        FROM flowerxi_regions reg
        JOIN flowerxi_weather_daily w
          ON w.region_slug = reg.slug
        LEFT JOIN flowerxi_risk_signals r
          ON r.region_slug = w.region_slug AND r.observed_on = w.observed_on
        LEFT JOIN flowerxi_recommendations rec
          ON rec.region_slug = w.region_slug AND rec.observed_on = w.observed_on
        WHERE reg.slug = %s
        ORDER BY w.observed_on DESC
        LIMIT 1;
    """,
    
    "weather_history": """
        SELECT observed_on, temp_mean_c, precipitation_mm
        FROM flowerxi_weather_daily w
        WHERE region_slug = %s
        ORDER BY w.observed_on DESC
        LIMIT %s;
    """,
    
    "weather_7days": """
        SELECT 
            observed_on,
            precipitation_mm,
            temp_mean_c,
            LAG(precipitation_mm) OVER (ORDER BY observed_on DESC) AS prev_precip
        FROM flowerxi_weather_daily
        WHERE region_slug = %s
        ORDER BY observed_on DESC
        LIMIT 7;
    """,
    
    "weather_summary": """
        SELECT 
            COUNT(*) as days_available,
            AVG(precipitation_mm) AS avg_precip,
            AVG(temp_mean_c) AS avg_temp,
            SUM(CASE WHEN precipitation_mm >= 4 THEN 1 ELSE 0 END)::int AS rainy_days,
            SUM(CASE WHEN precipitation_mm > 0 THEN 1 ELSE 0 END)::int AS days_with_precip,
            MAX(prev_precip) AS prev_avg_precip,
            ARRAY_AGG(precipitation_mm ORDER BY observed_on DESC) as precip_array
        FROM weather_data;
    """,
    
    "risk_operativo": """
        WITH weather_data AS (
            SELECT 
                observed_on,
                precipitation_mm,
                temp_mean_c,
                LAG(precipitation_mm) OVER (ORDER BY observed_on DESC) AS prev_precip
            FROM flowerxi_weather_daily
            WHERE region_slug = %s
            ORDER BY observed_on DESC
            LIMIT 7
        ),
        summary AS (
            SELECT 
                COUNT(*) as days_available,
                AVG(precipitation_mm) AS avg_precip,
                AVG(temp_mean_c) AS avg_temp,
                SUM(CASE WHEN precipitation_mm >= 4 THEN 1 ELSE 0 END)::int AS rainy_days,
                SUM(CASE WHEN precipitation_mm > 0 THEN 1 ELSE 0 END)::int AS days_with_precip,
                MAX(prev_precip) AS prev_avg_precip,
                ARRAY_AGG(precipitation_mm ORDER BY observed_on DESC) as precip_array
            FROM weather_data
        ),
        risk_calc AS (
            SELECT 
                s.*,
                CASE 
                    WHEN s.avg_precip > (s.prev_avg_precip * 1) AND s.rainy_days >= 3 THEN (s.rainy_days * 15 + s.days_with_precip * 8)::int
                    WHEN s.rainy_days >= 5 THEN 85
                    WHEN s.rainy_days >= 4 THEN 72
                    WHEN s.rainy_days >= 3 AND s.avg_temp BETWEEN 15 AND 22 THEN 68
                    WHEN s.rainy_days >= 3 AND s.avg_temp < 12 THEN 55
                    WHEN s.avg_temp > 28 THEN 78
                    WHEN s.avg_temp < 8 THEN 45
                    WHEN s.avg_temp <= 12 AND s.rainy_days >= 2 THEN 52
                    WHEN s.avg_temp >= 22 AND s.days_with_precip > 0 THEN 48
                    ELSE 22
                END AS risk_score
            FROM summary s
        ),
        trend_calc AS (
            SELECT 
                r.*,
                CASE 
                    WHEN array_length(r.precip_array, 1) >= 7 THEN
                        CASE 
                            WHEN (r.precip_array[1] + COALESCE(r.precip_array[2], 0) + COALESCE(r.precip_array[3], 0)) > 
                                 (COALESCE(r.precip_array[4], 0) + COALESCE(r.precip_array[5], 0) + COALESCE(r.precip_array[6], 0) + COALESCE(r.precip_array[7], 0)) * 1.15
                            THEN 'up'
                            WHEN (r.precip_array[1] + COALESCE(r.precip_array[2], 0) + COALESCE(r.precip_array[3], 0)) < 
                                 (COALESCE(r.precip_array[4], 0) + COALESCE(r.precip_array[5], 0) + COALESCE(r.precip_array[6], 0) + COALESCE(r.precip_array[7], 0)) * 0.85
                            THEN 'down'
                            ELSE 'stable'
                        END
                    ELSE 'stable'
                END AS trend_7d
            FROM risk_calc r
        )
        SELECT 
            t.days_available,
            t.avg_precip,
            t.avg_temp,
            t.rainy_days,
            t.days_with_precip,
            t.prev_avg_precip,
            t.risk_score,
            t.trend_7d
        FROM trend_calc t;
    """,
    
    "municipalities": """
        SELECT 
            r.slug,
            r.name,
            r.city,
            r.department,
            r.crop_focus,
            r.production_share,
            r.latitude,
            r.longitude,
            mp.year,
            mp.flower_area_ha,
            mp.greenhouse_area_ha,
            mp.workers,
            mp.workers_female,
            mp.workers_male,
            mp.fisanicitary_context,
            mp.waste_management,
            mp.main_varieties
        FROM flowerxi_regions r
        LEFT JOIN flowerxi_municipality_profile mp ON mp.region_slug = r.slug
        WHERE r.department = 'CUNDINAMARCA'
        ORDER BY r.production_share DESC NULLS LAST;
    """,
    
    "exports": """
        SELECT 
            year_month,
            subpartida,
            country_dest,
            fob_usd,
            net_tons,
            unit_value,
            source
        FROM flowerxi_exports_monthly
        ORDER BY year_month DESC, fob_usd DESC
        LIMIT %s;
    """,
    
    "stations": """
        SELECT station_code, station_name, region_slug, elevation_m, 
               latitude, longitude, distance_km, data_quality, source
        FROM flowerxi_weather_stations
        ORDER BY distance_km ASC;
    """,
    
    "calendar": """
        SELECT event_date, event_name, local_name, country_code
        FROM flowerxi_market_calendar
        WHERE EXTRACT(YEAR FROM event_date) = %s
        ORDER BY event_date ASC;
    """,
}