SQL_QUERIES = {
    "regions": """
        SELECT slug, name, city
        FROM flowerxi_regions
        ORDER BY name ASC;
    """,
    "dashboard_snapshot": """
        SELECT
          reg.name AS region_name,
          w.observed_on,
          w.temp_mean_c,
          w.precipitation_mm,
          r.fungal_risk,
          r.waterlogging_risk,
          r.heat_risk,
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
        SELECT
          w.observed_on,
          w.temp_mean_c,
          w.precipitation_mm,
          r.fungal_risk,
          r.waterlogging_risk,
          r.heat_risk,
          r.global_risk_level,
          rec.title AS recommendation_title,
          rec.message AS recommendation_message
        FROM flowerxi_weather_daily w
        LEFT JOIN flowerxi_risk_signals r
          ON r.region_slug = w.region_slug AND r.observed_on = w.observed_on
        LEFT JOIN flowerxi_recommendations rec
          ON rec.region_slug = w.region_slug AND rec.observed_on = w.observed_on
        WHERE w.region_slug = %s
        ORDER BY w.observed_on DESC
        LIMIT %s;
    """,
    "municipalities": """
        SELECT
            r.slug,
            r.name,
            mp.flower_area_ha,
            mp.workers
        FROM flowerxi_regions r
        LEFT JOIN LATERAL (
            SELECT flower_area_ha, workers
            FROM flowerxi_municipality_profile
            WHERE region_slug = r.slug
            ORDER BY year DESC NULLS LAST
            LIMIT 1
        ) mp ON TRUE
        WHERE r.department = 'CUNDINAMARCA'
        ORDER BY r.name ASC;
    """,
    "regions_compare": """
        SELECT
            r.slug,
            r.name,
            r.city,
            r.production_share,
            mp.flower_area_ha,
            mp.workers,
            rs.fungal_risk,
            rs.waterlogging_risk,
            rs.heat_risk,
            rs.risk_score
        FROM flowerxi_regions r
        LEFT JOIN LATERAL (
            SELECT flower_area_ha, workers
            FROM flowerxi_municipality_profile
            WHERE region_slug = r.slug
            ORDER BY year DESC NULLS LAST
            LIMIT 1
        ) mp ON TRUE
        LEFT JOIN LATERAL (
            SELECT
                fungal_risk,
                waterlogging_risk,
                heat_risk,
                ROUND((fungal_risk * 0.5) + (waterlogging_risk * 0.3) + (heat_risk * 0.2))::int AS risk_score
            FROM flowerxi_risk_signals
            WHERE region_slug = r.slug
            ORDER BY observed_on DESC
            LIMIT 1
        ) rs ON TRUE
        WHERE r.department = 'CUNDINAMARCA'
        ORDER BY r.production_share DESC NULLS LAST, r.name ASC;
    """,
    "exports": """
        SELECT 
            year_month,
            country_dest,
            fob_usd,
            net_tons
        FROM flowerxi_exports_monthly
        ORDER BY year_month DESC, fob_usd DESC
        LIMIT %s;
    """,
    "stations": """
        SELECT station_name, region_slug, distance_km
        FROM flowerxi_weather_stations
        WHERE region_slug = %s
        ORDER BY distance_km ASC;
    """,
    "stations_fallback": """
        WITH requested AS (
            SELECT slug, latitude, longitude
            FROM flowerxi_regions
            WHERE slug = %s
            LIMIT 1
        )
        SELECT
            ws.station_name,
            ws.region_slug,
            ROUND(
                (
                    SQRT(
                        POWER(req.latitude - rs.latitude, 2) +
                        POWER(req.longitude - rs.longitude, 2)
                    ) * 111.0
                )::numeric,
                1
            ) AS distance_km
        FROM requested req
        JOIN flowerxi_weather_stations ws ON TRUE
        JOIN flowerxi_regions rs ON rs.slug = ws.region_slug
        ORDER BY distance_km ASC
        LIMIT 3;
    """,
    "risk_explain": """
        WITH last_7 AS (
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
            AVG(precipitation_mm) AS avg_precip,
            AVG(temp_mean_c) AS avg_temp,
            SUM(CASE WHEN precipitation_mm >= 4 THEN 1 ELSE 0 END)::int AS rainy_days,
            AVG(prev_precip) AS prev_avg_precip
          FROM last_7
        )
        SELECT 
          s.avg_precip,
          s.avg_temp,
          s.rainy_days,
          s.prev_avg_precip,
          s.avg_precip - s.prev_avg_precip AS precip_change,
          CASE 
            WHEN s.rainy_days >= 4 THEN 'Alta precipitación acumulada (≥4 días con lluvia)'
            WHEN s.avg_precip > (s.prev_avg_precip * 1.3) THEN 'Aumento significativo de precipitación vs semana anterior'
            WHEN s.avg_temp <= 12 THEN 'Temperaturas bajas favorecen humedad relativa alta'
            WHEN s.avg_temp >= 22 THEN 'Temperaturas elevadas aumentan estrés hídrico'
            ELSE 'Condiciones dentro de rangos normales'
          END AS primary_driver,
          CASE 
            WHEN s.rainy_days >= 4 THEN 'Revisar drenajes, aplicar fungicida preventivo, intensificar monitoreo fitosanitario'
            WHEN s.avg_precip > (s.prev_avg_precip * 1.3) THEN 'Verificar acumulaciones de agua, mejorar ventilación'
            WHEN s.avg_temp <= 12 THEN 'Controlar humedad, evitar condensación en invernadero'
            WHEN s.avg_temp >= 22 THEN 'Aumentar riego por goteo, sombra temporal si aplica'
            ELSE 'Mantener protocolo habitual de vigilancia'
          END AS recommendation
        FROM summary s;
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
          t.trend_7d,
          CASE 
            WHEN t.risk_score <= 30 THEN 'rutina'
            WHEN t.risk_score <= 60 THEN 'vigilancia'
            ELSE 'accion'
          END AS status,
          CASE 
            WHEN t.rainy_days >= 5 THEN 'Acumulación crítica de lluvia (5+ días)'
            WHEN t.rainy_days >= 3 AND t.avg_temp BETWEEN 15 AND 22 THEN 'Humedad + temperatura templada = riesgo fungal elevado'
            WHEN t.rainy_days >= 3 AND t.avg_temp < 12 THEN 'Frío + humedad = estrés para las plantas'
            WHEN t.rainy_days >= 3 AND t.avg_temp >= 22 THEN 'Lluvia + calor = condiciones favorables para hongos'
            WHEN t.avg_precip > (t.prev_avg_precip * 3) THEN 'Aumento crítico de precipitación (300%+)'
            WHEN t.avg_precip > (t.prev_avg_precip * 2) THEN 'Aumento significativo de lluvia'
            WHEN t.avg_temp > 28 THEN 'Temperatura muy alta (>28°C) - estrés térmico'
            WHEN t.avg_temp < 8 THEN 'Temperatura muy baja (<8°C) - riesgo de frío'
            WHEN t.avg_temp <= 12 AND t.rainy_days >= 2 THEN 'Temperatura baja + humedad = vigilancia por hongos'
            WHEN t.avg_temp >= 22 AND t.days_with_precip > 0 THEN 'Calor + humedad - aumentar ventilación'
            ELSE 'Condiciones dentro de rangos normales'
          END AS reason,
          CASE 
            WHEN t.rainy_days >= 5 THEN 'Aplicar fungicida inmediatamente + revisar sistema de drenaje. Registra inspección.'
            WHEN t.rainy_days >= 3 AND t.avg_temp BETWEEN 15 AND 22 THEN 'Inspección fitosanitaria prioritaria hoy. Aumenta ventilación 20 min extra.'
            WHEN t.rainy_days >= 3 AND t.avg_temp < 12 THEN 'Revisa calefacción o protección anticongelante. Controla condensación.'
            WHEN t.rainy_days >= 3 AND t.avg_temp >= 22 THEN 'Aumenta ventilación y revisa sombreado. Monitorea estrés hídrico.'
            WHEN t.avg_precip > (t.prev_avg_precip * 3) THEN 'Revisa drenajes inmediatamente. Elimina acumulaciones de agua.'
            WHEN t.avg_precip > (t.prev_avg_precip * 2) THEN 'Verifica acumulaciones de agua. Mejora ventilación.'
            WHEN t.avg_temp > 28 THEN 'Activa sombreado de emergencia. Aumenta riego por goteo.'
            WHEN t.avg_temp < 8 THEN 'Activa protección anticongelante. Revisa estado de plantas sensibles.'
            WHEN t.avg_temp <= 12 AND t.rainy_days >= 2 THEN 'Aumenta ventilación para reducir condensación. Controla humedad.'
            WHEN t.avg_temp >= 22 AND t.days_with_precip > 0 THEN 'Ventila más de lo normal. Evita condensación.'
            ELSE 'Mantén rutina habitual. Revisa humedad del suelo.'
          END AS action_today,
          CASE 
            WHEN t.rainy_days >= 5 THEN 'Si no actúas, la presión fungal puede elevarse en 48h. Registra inspección.'
            WHEN t.rainy_days >= 3 THEN 'Si se acumulan 2-3 días más de lluvia, el nivel podría pasar a Acción requerida.'
            WHEN t.avg_temp > 28 THEN 'El estrés térmico puede acelerar envejecimiento de flores. Revisa riego.'
            WHEN t.avg_temp < 8 THEN 'Temperaturas bajo 8°C pueden dañar botones florales. Monitorea.'
            WHEN t.avg_precip > (t.prev_avg_precip * 2) THEN 'Si las lluvias continúan, revisa drenajes mañana.'
            ELSE 'Condiciones estables. Sin señal crítica.'
          END AS attention,
          CASE 
            WHEN t.days_available >= 7 THEN 'alta'
            WHEN t.days_available >= 4 THEN 'media'
            ELSE 'baja'
          END AS confidence
        FROM trend_calc t;
    """,
    "recommendations_week": """
        SELECT
          COALESCE(rec.title,
            CASE
              WHEN COALESCE(r.fungal_risk, 0) >= COALESCE(r.waterlogging_risk, 0)
                   AND COALESCE(r.fungal_risk, 0) >= COALESCE(r.heat_risk, 0)
                THEN 'Control fungico en rosa'
              WHEN COALESCE(r.waterlogging_risk, 0) >= COALESCE(r.fungal_risk, 0)
                   AND COALESCE(r.waterlogging_risk, 0) >= COALESCE(r.heat_risk, 0)
                THEN 'Drenaje prioritario'
              ELSE 'Manejo termico de invernadero'
            END
          ) AS title,
          COALESCE(rec.message, 'Mantener monitoreo operativo diario.') AS message,
          r.global_risk_level,
          r.fungal_risk,
          r.waterlogging_risk,
          r.heat_risk
        FROM flowerxi_weather_daily w
        LEFT JOIN flowerxi_risk_signals r
          ON r.region_slug = w.region_slug AND r.observed_on = w.observed_on
        LEFT JOIN flowerxi_recommendations rec
          ON rec.region_slug = w.region_slug AND rec.observed_on = w.observed_on
        WHERE w.region_slug = %s
        ORDER BY w.observed_on DESC
        LIMIT %s;
    """,
}
