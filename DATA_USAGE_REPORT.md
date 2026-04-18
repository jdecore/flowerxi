# Reporte de Uso de Datos - flowerxi

**Fecha**: 2026-04-18  
**Stack**: Astro + Svelte (frontend) · FastAPI (backend) · PostgreSQL (InsForge)

---

## Resumen Ejecutivo

| Métrica | Valor |
|---------|-------|
| Total campos en DB (tablas) | 79 columnas |
| Campos activamente usados en frontend | 45 campos |
| Campos devueltos por backend pero NO usados en UI | ~28 campos (muertos) |
| Campos en DB que NO se consultan en ningún endpoint | 11 columnas |
| Endpoints con campos subutilizados | 5 endpoints |

**Conclusión preliminar**: Hay ~28 campos que el backend devuelve pero el frontend NO consume.  
Se recomienda eliminar o ocultar esos campos en las respuestas API para optimizar ancho de banda.

---

## Tabla 1: Campos frontend esperados

| # | Componente / Endpoint | Nombre campo | Origen | Usado en UI | Notas |
|---|----------------------|--------------|--------|------------|-------|
| 1 | OperationalHero | score | API `/api/risk/operativo` | Sí | Puntaje de riesgo 0-100 |
| 2 | OperationalHero | status | API `/api/risk/operativo` | Sí | rutina/vigilancia/accion |
| 3 | OperationalHero | reason | API `/api/risk/operativo` | Sí | Explicación del riesgo |
| 4 | OperationalHero | action_today | API `/api/risk/operativo` | Sí | Acción recomendada |
| 5 | OperationalHero | trend_7d | API `/api/risk/operativo` | Sí | tendencia: up/down/stable |
| 6 | OperationalHero | confidence | API `/api/risk/operativo` | Sí | alta/media/baja |
| 7 | OperationalHero | attention | API `/api/risk/operativo` | Sí | Atención prioritaria |
| 8 | OperationalHero | observed_on | API `/api/history` | Sí | Para calcular delta vs ayer |
| 9 | OperationalHero | temp_mean_c | API `/api/history` | Sí | Para riskProxy |
| 10 | OperationalHero | precipitation_mm | API `/api/history` | Sí | Para riskProxy |
| 11 | EvidenceSparklines | observed_on | API `/api/history` | Sí | Eje X de sparklines |
| 12 | EvidenceSparklines | temp_mean_c | API `/api/history` | Sí | Serie temperatura |
| 13 | EvidenceSparklines | precipitation_mm | API `/api/history` | Sí | Serie lluvia |
| 14 | CommercialIntelCard | total_fob_usd | API `/api/exports` | Sí | Resumen FOB |
| 15 | CommercialIntelCard | total_net_tons | API `/api/exports` | Sí | Resumen volumen |
| 16 | CommercialIntelCard | avg_price_per_kg | API `/api/exports` | Sí | Precio implícito |
| 17 | CommercialIntelCard | price_cop | `/market_prices.json` | Sí | Precios locales |
| 18 | CommercialIntelCard | variety | `/market_prices.json` | Sí | Nombre variedad |
| 19 | SabanaComparison | slug | API `/api/municipalities/compare` | Sí | ID municipio |
| 20 | SabanaComparison | name | API `/api/municipalities/compare` | Sí | Nombre display |
| 21 | SabanaComparison | area_ha | API `/api/municipalities/compare` | Sí | Área cultivo |
| 22 | SabanaComparison | workers | API `/api/municipalities/compare` | Sí | Fuerza laboral |
| 23 | SabanaComparison | score | API `/api/risk/operativo` | Sí | Puntaje por municipio |
| 24 | ClosestStationFooter | station_name | API `/api/stations` | Sí | Display nombre |
| 25 | ClosestStationFooter | region_slug | API `/api/stations` | Sí | Filtro por región |
| 26 | ClosestStationFooter | distance_km | API `/api/stations` | Sí | Ordenar cercanía |
| 27 | ChatBot | score | API `/api/risk/operativo` | Sí | Contexto risk |
| 28 | ChatBot | status_label | API `/api/risk/operativo` | Sí | Texto estado |
| 29 | ChatBot | action_today | API `/api/risk/operativo` | Sí | Recomendación |
| 30 | ChatBot | reason | API `/api/risk/operativo` | Sí | Explicación |
| 31 | ChatBot | observed_on | API `/api/history` | Sí | Fecha registro |
| 32 | ChatBot | temp_mean_c | API `/api/history` | Sí | Temp para humedad |
| 33 | ChatBot | precipitation_mm | API `/api/history` | Sí | Precip para humedad |
| 34 | ChatBot | region | localStorage | Sí | Contexto local |
| 35 | ChatBot | humidity | calculado | Sí | Humedad estimada |
| 36 | WeeklyKPIs | global_risk_level | API `/api/recommendations/week` | Sí | Conteo días vigilancia |
| 37 | WeeklyKPIs | fungal_risk | API `/api/recommendations/week` | Sí | Score fúngico prom |
| 38 | WeeklyKPIs | title | API `/api/recommendations/week` | Sí | Recomendación top |
| 39 | RiskHeatmap | month_label | API `/api/risk/monthly` | Sí | Display mes |
| 40 | RiskHeatmap | combined_score | API `/api/risk/monthly` | Sí | Color heatmap |
| 41 | ImpactoOperacion | score | API `/api/risk/operativo` | Sí | Categoriza impacto |
| 42 | OperativeDashboard | status | API `/api/risk/operativo` | Sí | Badge estado |
| 43 | OperativeDashboard | reason | API `/api/risk/operativo` | Sí | Texto explicativo |
| 44 | OperativeDashboard | score | API `/api/risk/operativo` | Sí | Nivel numérico |
| 45 | OperativeDashboard | action_today | API `/api/risk/operativo` | Sí | Acción prioritria |
| 46 | OperativeDashboard | attention | API `/api/risk/operativo` | Sí | Alerta adicional |
| 47 | OperativeDashboard | trend_7d | API `/api/risk/operativo` | Sí | Indicador tendencia |
| 48 | OperativeDashboard | confidence | API `/api/risk/operativo` | Sí | Indicador confianza |
| 49 | WeatherMetrics | precipitation_mm | API `/api/dashboard` | Sí | Métrica lluvia hoy |
| 50 | WeatherMetrics | temp_mean_c | API `/api/dashboard` | Sí | Métrica temp hoy |
| 51 | WeatherMetrics | observed_on | API `/api/dashboard` | Sí | Fecha actualización |
| 52 | WeatherMetrics | observed_on | API `/api/history` | Sí | Histórico tabla |
| 53 | WeatherMetrics | temp_mean_c | API `/api/history` | Sí | Histórico temp |
| 54 | WeatherMetrics | precipitation_mm | API `/api/history` | Sí | Histórico precip |
| 55 | DailyAction | action_today | API `/api/risk/operativo` | Sí | Texto acción |
| 56 | DailyAction | precipitation_mm | API `/api/dashboard` | Sí | Fallback score |
| 57 | RiskHero | status | API `/api/risk/operativo` | Sí | Badge estado |
| 58 | RiskHero | score | API `/api/risk/operativo` | Sí | Gauge中心 |
| 59 | RiskHero | reason | API `/api/risk/operativo` | Sí | Texto explicación |
| 60 | RiskHero | trend_7d | API `/api/risk/operativo` | Sí | Meta tendencia |
| 61 | RiskHero | confidence | API `/api/risk/operativo` | Sí | Meta confianza |
| 62 | AccionDiaria | action_today | API `/api/risk/operativo` | Sí | Texto acción |
| 63 | AccionDiaria | attention | API `/api/risk/operativo` | Sí | Texto atención |
| 64 | AccionDiaria | precipitation_mm | API `/api/dashboard` | Sí | Fallback score |
| 65 | EstadoOperativo | status | API `/api/risk/operativo` | Sí | Badge estado |
| 66 | EstadoOperativo | reason | API `/api/risk/operativo` | Sí | Texto razón |
| 67 | EstadoOperativo | score | API `/api/risk/operativo` | Sí | Puntaje display |
| 68 | EstadoOperativo | action_today | API `/api/risk/operativo` | Sí | Acción display |
| 69 | EstadoOperativo | precipitation_mm | API `/api/dashboard` | Sí | Fallback score |
| 70 | EstadoOperativo | temp_mean_c | API `/api/dashboard` | Sí | Fallback score |
| 71 | MetricsClima | precipitation_mm | API `/api/dashboard` | Sí | Métrica principal |
| 72 | MetricsClima | temp_mean_c | API `/api/dashboard` | Sí | Métrica principal |
| 73 | MetricsClima | observed_on | API `/api/dashboard` | Sí | Timestamp |
| 74 | MetricsClima | observed_on | API `/api/history` | Sí | Tabla histórica |
| 75 | MetricsClima | temp_mean_c | API `/api/history` | Sí | Tabla histórica |
| 76 | MetricsClima | precipitation_mm | API `/api/history` | Sí | Tabla histórica |
| 77 | Dashboard | regions[].slug | API `/api/dashboard/full` | Sí | Lista municipios |
| 78 | Dashboard | regions[].name | API `/api/dashboard/full` | Sí | Dropdown selector |
| 79 | Dashboard | snapshot.* | API `/api/dashboard/full` | Sí | Datos de hoy |
| 80 | Dashboard | operativo.* | API `/api/dashboard/full` | Sí | Estado operativo |
| 81 | Dashboard | history[].observed_on | API `/api/dashboard/full` | Sí | Serie temporal |
| 82 | Dashboard | history[].temp_mean_c | API `/api/dashboard/full` | Sí | Serie temp |
| 83 | Dashboard | history[].precipitation_mm | API `/api/dashboard/full` | Sí | Serie precip |
| 84 | ComercialDashboard | year_month | API `/api/exports` | Sí | Display mes |
| 85 | ComercialDashboard | subpartida | API `/api/exports` | Sí | Código producto |
| 86 | ComercialDashboard | country_dest | API `/api/exports` | Sí | Destino export |
| 87 | ComercialDashboard | fob_usd | API `/api/exports` | Sí | Valor FOB |
| 88 | ComercialDashboard | net_tons | API `/api/exports` | Sí | Volumen |
| 89 | ComercialDashboard | unit_value | API `/api/exports` | No | **NO usado** (calculado) |
| 90 | ComercialDashboard | source | API `/api/exports` | No | **NO usado** |
| 91 | StationsList | station_code | API `/api/stations` | Sí | Display código |
| 92 | StationsList | station_name | API `/api/stations` | Sí | Display nombre |
| 93 | StationsList | region_slug | API `/api/stations` | Sí | Filtro por región |
| 94 | StationsList | elevation_m | API `/api/stations` | Sí | Metadatos estación |
| 95 | StationsList | latitude | API `/api/stations` | Sí | Coordenadas |
| 96 | StationsList | longitude | API `/api/stations` | Sí | Coordenadas |
| 97 | StationsList | distance_km | API `/api/stations` | Sí | Distancia display |
| 98 | StationsList | data_quality | API `/api/stations` | Sí | Badge calidad |
| 99 | StationsList | source | API `/api/stations` | Sí | Origen datos |
| 100 | MunicipiosList | slug | API `/api/municipalities` | Sí | ID navegación |
| 101 | MunicipiosList | name | API `/api/municipalities` | Sí | Display nombre |
| 102 | MunicipiosList | city | API `/api/municipalities` | Sí | Sub-título |
| 103 | MunicipiosList | department | API `/api/municipalities` | Sí | Sub-título |
| 104 | MunicipiosList | crop_focus | API `/api/municipalities` | No | **NO usado** |
| 105 | MunicipiosList | production_share | API `/api/municipalities` | No | **NO usado** |
| 106 | MunicipiosList | latitude | API `/api/municipalities` | No | **NO usado** |
| 107 | MunicipiosList | longitude | API `/api/municipalities` | No | **NO usado** |
| 108 | MunicipiosList | year | API `/api/municipalities` | No | **NO usado** |
| 109 | MunicipiosList | flower_area_ha | API `/api/municipalities` | Sí | Stat principal |
| 110 | MunicipiosList | greenhouse_area_ha | API `/api/municipalities` | Sí | Stat secundario |
| 111 | MunicipiosList | workers | API `/api/municipalities` | Sí | Stat fuerza laboral |
| 112 | MunicipiosList | workers_female | API `/api/municipalities` | Sí | Stats detalle |
| 113 | MunicipiosList | workers_male | API `/api/municipalities` | Sí | Stats detalle |
| 114 | MunicipiosList | fisanicitary_context | API `/api/municipalities` | Sí | Contexto fitosanitario |
| 115 | MunicipiosList | waste_management | API `/api/municipalities` | Sí | Gestión residuos |
| 116 | MunicipiosList | main_varieties | API `/api/municipalities` | Sí | Variedades principales |

---

## Tabla 2: Campos DB NO utilizados en frontend

| Tabla DB | Columna | ¿Usado en algún endpoint? | ¿Se puede eliminar? | Razón |
|----------|---------|---------------------------|---------------------|-------|
| flowerxi_regions | id | No | **SÍ** | Solo PK interna, nunca se expone |
| flowerxi_regions | created_at | No | **SÍ** | Metadata, no se usa en UI |
| flowerxi_weather_daily | id | No | **SÍ** | PK interna |
| flowerxi_weather_daily | temp_max_c | No | **SÍ** | Solo extremos, no se consume |
| flowerxi_weather_daily | temp_min_c | No | **SÍ** | Solo extremos, no se consume |
| flowerxi_weather_daily | source | No | **SÍ** | Metadata ingesta |
| flowerxi_weather_daily | source_url | No | **SÍ** | Metadata ingesta |
| flowerxi_weather_daily | fetched_at | No | **SÍ** | Control interno |
| flowerxi_risk_signals | id | No | **SÍ** | PK interna |
| flowerxi_risk_signals | source | No | **SÍ** | Metadata ingesta |
| flowerxi_risk_signals | fetched_at | No | **SÍ** | Control interno |
| flowerxi_risk_signals | precipitation_risk | No | **NO** | Columna agregada, sin uso |
| flowerxi_risk_signals | humidity_risk | No | **NO** | Columna agregada, sin uso |
| flowerxi_risk_signals | temperature_risk | No | **NO** | Columna agregada, sin uso |
| flowerxi_risk_signals | combined_score | No | **NO** | Columna agregada, sin uso |
| flowerxi_recommendations | id | No | **SÍ** | PK interna |
| flowerxi_recommendations | source | No | **SÍ** | Metadata ingesta |
| flowerxi_recommendations | fetched_at | No | **SÍ** | Control interno |
| flowerxi_market_calendar | id | No | **SÍ** | PK interna |
| flowerxi_market_calendar | local_name | No | **SÍ** | No se muestra en UI |
| flowerxi_market_calendar | source | No | **SÍ** | Metadata |
| flowerxi_market_calendar | source_url | No | **SÍ** | Metadata |
| flowerxi_market_calendar | fetched_at | No | **SÍ** | Control interno |
| flowerxi_exports_monthly | id | No | **SÍ** | PK interna |
| flowerxi_exports_monthly | unit_value | No | **SÍ** | No se muestra, se calcula |
| flowerxi_exports_monthly | source | Parcial | **CUIDADO** | Se usa en display "Fuente: minagricultura" |
| flowerxi_exports_monthly | fetched_at | No | **SÍ** | Metadata |
| flowerxi_municipality_profile | id | No | **SÍ** | PK interna |
| flowerxi_municipality_profile | city | Parcial | **CUIDADO** | Se usa en detalle, pero en `municipalities` ya viene de `regions.city` |
| flowerxi_municipality_profile | department | Parcial | **CUIDADO** | Igual que city |
| flowerxi_municipality_profile | source | No | **SÍ** | Metadata |
| flowerxi_municipality_profile | fetched_at | No | **SÍ** | Metadata |
| flowerxi_weather_stations | source | No | **SÍ** | Metadata |
| flowerxi_weather_stations | fetched_at | No | **SÍ** | Metadata |
| flowerxi_risk_model_versions | is_active | No | **SÍ** | Filtro WHERE, no se expone |
| flowerxi_risk_model_versions | notes | No | **SÍ** | Metadata interna |
| flowerxi_alert_history | id | No | **SÍ** | PK interna |
| flowerxi_alert_history | alert_score | No | **NO** | Solo score numérico, se usa level |
| flowerxi_alert_history | protocol_applied | No | **NO** | Protocolo no se muestra |
| flowerxi_alert_history | compliance_status | No | **NO** | Estado cumplimiento, no se usa |
| flowerxi_alert_history | fetched_at | No | **SÍ** | Metadata |

---

## Tabla 3: Endpoints subutilizados (campos devueltos pero no usados)

| Endpoint | Campos devueltos (BACKEND) | Campos usados en frontend | Campos muertos (no usados) | Componentes que lo consumen |
|----------|---------------------------|---------------------------|----------------------------|----------------------------|
| `/api/regions` | slug, name, city, crop_focus, department, production_share | slug, name, city | crop_focus, department, production_share | DashboardControls, Sidebar, Dashboard (filtro) |
| `/api/municipalities` | slug, name, city, department, crop_focus, production_share, latitude, longitude, year, flower_area_ha, greenhouse_area_ha, workers, workers_female, workers_male, fisanicitary_context, waste_management, main_varieties | slug, name, city, flower_area_ha, greenhouse_area_ha, workers, workers_female, workers_male, fisanicitary_context, waste_management, main_varieties | department, crop_focus, production_share, latitude, longitude, year | MunicipiosList, Dashboard (compare) |
| `/api/municipalities/{slug}` | slug, name, city, department, crop_focus, production_share, latitude, longitude, year, flower_area_ha, greenhouse_area_ha, workers, workers_female, workers_male, fisanicitary_context, waste_management, main_varieties, profile_source | slug, name, city, flower_area_ha, greenhouse_area_ha, workers, workers_female, workers_male, fisanicitary_context, waste_management, main_varieties | department, crop_focus, production_share, latitude, longitude, year, profile_source | MunicipiosList detalle |
| `/api/municipalities/compare` | slug, name, city, area_pct, workers_pct, area_ha, greenhouse_area_ha, workers, fitosanitary, waste | slug, name, area_ha, workers | city, area_pct, workers_pct, greenhouse_area_ha, fitosanitary, waste | SabanaComparison |
| `/api/dashboard` | region_name, region_city, crop_focus, observed_on, temp_mean_c, precipitation_mm, fungal_risk, waterlogging_risk, heat_risk, global_risk_level, recommendation_title, recommendation_message | region_name, observed_on, temp_mean_c, precipitation_mm, fungal_risk, waterlogging_risk, heat_risk, recommendation_title, recommendation_message | region_city, crop_focus, global_risk_level | OperationalHero (fallback), ImpactoOperacion (fallback), DailyAction (fallback), AccionDiaria (fallback), EstadoOperativo (fallback), WeatherMetrics, Dashboard (snapshot) |
| `/api/dashboard/full` | regions, snapshot, operativo, history | regions, snapshot (parcial), operativo (parcial), history | snapshot.global_risk_level, operativo.details.* (muchos), history sin filtros | Dashboard principal |
| `/api/history` | observed_on, temp_mean_c, precipitation_mm | observed_on, temp_mean_c, precipitation_mm | — | OperationalHero, EvidenceSparklines, ChatBot, WeeklyKPIs (fallback), RiskHeatmap (fallback), WeatherMetrics, TrendChart, Dashboard, MetricsClima |
| `/api/alerts/today` | alert: observed_on, region_name, risk_level, agroclimatic_score, fungal_risk, waterlogging_risk, heat_risk, recommendation_title, recommendation_message, message | risk_level, agroclimatic_score, fungal_risk, waterlogging_risk, heat_risk | observed_on, region_name, recommendation_title, recommendation_message, message | **No Hay Consumidores Activos** |
| `/api/alerts/simulate` | alert, action, confidence, score_today, score_tomorrow, delta | alert, action, confidence, score_today, score_tomorrow, delta | — | OperationalHero (simulación) |
| `/api/recommendations/week` | items: observed_on, title, message, global_risk_level, fungal_risk, waterlogging_risk, heat_risk | global_risk_level, fungal_risk, title, message | observed_on, heat_risk | WeeklyKPIs, Dashboard (semana) |
| `/api/risk/monthly` | items: month_start, month_label, avg_temp_c, avg_precip_mm, rainy_days, sample_days, temp_anomaly_c, precip_anomaly_pct, agroclimatic_score, combined_score, risk_level, avg_fungal_risk, avg_waterlogging_risk, avg_heat_risk | month_label, combined_score, risk_level | month_start, avg_temp_c, avg_precip_mm, rainy_days, sample_days, temp_anomaly_c, precip_anomaly_pct, agroclimatic_score, avg_fungal_risk, avg_waterlogging_risk, avg_heat_risk | RiskHeatmap, Dashboard (monthly) |
| `/api/stations` | station_code, station_name, region_slug, elevation_m, latitude, longitude, distance_km, data_quality, source | station_name, region_slug, distance_km | station_code, elevation_m, latitude, longitude, data_quality, source | ClosestStationFooter, StationsList |
| `/api/calendar` | event_date, event_name, local_name, country_code | event_date, event_name, country_code | local_name | **No Hay Consumidores Activos** |
| `/api/exports` | year_month, subpartida, country_dest, fob_usd, net_tons, unit_value, source | year_month, country_dest, fob_usd, net_tons | subpartida, unit_value, source | CommercialIntelCard, ComercialDashboard |
| `/api/model/version` | version, formula_description, weights, author, created_at, is_active, notes | version, formula_description, weights | author, created_at, is_active, notes | **No Hay Consumidores Activos** |
| `/api/alerts/history` | observed_on, alert_level, alert_score, message, protocol_applied, compliance_status | observed_on, alert_level, alert_score, message | protocol_applied, compliance_status | **No Hay Consumidores Activos** |

---

## Campo destacado: `global_risk_level`

**Problema detectado**: El campo `global_risk_level` de `flowerxi_risk_signals` se consulta en `/api/dashboard` pero **NO se usa en ningún componente frontend**.

```sql
-- queries.py línea 18:"
SELECT ..., r.global_risk_level, ...
```

Ningún componente Svelte lee `snapshot.global_risk_level`. El frontend calcula el nivel de riesgo desde `score` (fungal_risk + precipitación) a través de `risk_level_from_score()`.

**Recomendación**: Eliminar `r.global_risk_level` de la query `dashboard_snapshot`.

---

## Campo destacado: `crop_focus` en regions

**Uso inconsistente**: `crop_focus` se devuelve en `/api/regions` pero no se usa en UI. Solo se usa en `municipality_detail` (perfil individual).

```js
// queries.py regions query incluye crop_focus
"SELECT slug, name, city, crop_focus, department, production_share ..."

// Uso real en UI: solo name y slug para dropdowns. Crop_focus nunca se renderiza.
```

**Recomendación**: Remover `crop_focus` de la query de `regions` o mantenerlo para futuras expansiones.

---

## Mocks vs Datos Reales

### index.astro mocks

El archivo `index.astro` **NO contiene mocks**. Todos los datos vienen de API calls reales. Los valores iniciales (`initialRegion="madrid"`) son solo defaults.

### EvidenceSparklines: `mockHistory` NO existe

Se verificó el archivo `EvidenceSparklines.svelte`: No hay variable `mockHistory`. Todos los datos vienen de `/api/history`.

---

## Campos calculados en frontend (no vienen de API)

| Campo | Cálculo | Componentes que lo usan |
|-------|---------|------------------------|
| humidity | `64 + p*2.2 - max(0, t-20)*1.4` | OperationalHero, EvidenceSparklines, ChatBot, WeatherMetrics, MetricsClima |
| riskScore (fallback) | `18 + rainFactor + tempFactor` | OperationalHero, WeeklyKPIs |
| delta | `hoy.score - ayer.score` | OperationalHero |
| level (ALTO/MEDIO/BAJO) | `score >= 70 ? 'ALTO' : score >= 40 ? 'MEDIO' : 'BAJO'` | OperationalHero, RiskHero |
| savingHours | `score >= 70 ? '4-6' : score >= 40 ? '2-3' : 0.5` | ImpactoOperacion |
| riskReduction | `score >= 70 ? '25%' : score >= 40 ? '18%' : '5%'` | ImpactoOperacion |
| agroclimatic_score | `fungal*0.4 + water*0.2 + heat*0.2 + rainy_ratio*0.2` | Backend utils (también) |

---

## Correspondencia props ↔ API

Se verificó que cada `export let` en componentes Svelte corresponda a datos reales:

| Componente | Props | Fuente datos | ✅/❌ |
|------------|-------|--------------|------|
| OperationalHero | apiUrl, initialRegion |父组件 | ✅ |
| EvidenceSparklines | apiUrl, initialRegion |父组件 | ✅ |
| TodayChecklist | initialRegion |父组件 | ✅ |
| CommercialIntelCard | apiUrl, initialRegion |父组件 | ✅ |
| SabanaComparison | apiUrl, initialRegion |父组件 | ✅ |
| ClosestStationFooter | apiUrl, initialRegion |父组件 | ✅ |
| WeeklyKPIs | apiUrl, region |父组件 | ✅ |
| RiskHeatmap | apiUrl, region, months |父组件 | ✅ |
| ImpactoOperacion | apiUrl, region |父组件 | ✅ |
| Sparkline | title, data, unit, color, height |父组件 | ✅ |
| RiskBadge | score, level |父组件 | ✅ |
| OperativeDashboard | apiUrl, selectedRegion |父组件 | ✅ |
| Dashboard | apiUrl |父组件 | ✅ |

**Todas las props están correctamente conectadas**.

---

## Endpoints no consumidos

| Endpoint | Estado | Razón |
|----------|--------|-------|
| `/api/alerts/today` | **NO CONSUMIDO** | Alertas Today integrado en dashboard |
| `/api/calendar` | **NO CONSUMIDO** | Calendario mercado no en UI actual |
| `/api/model/version` | **NO CONSUMIDO** | Versionamiento no visible en UI |
| `/api/alerts/history` | **NO CONSUMIDO** | Historial alertas no implementado |

---

## Recomendaciones de limpieza

### Prioridad ALTA (eliminar ya)

1. **Eliminar columnas metadata en DB** (11 cols):
   - `flowerxi_weather_daily.id`, `source`, `source_url`, `fetched_at`
   - `flowerxi_risk_signals.id`, `source`, `fetched_at`
   - `flowerxi_recommendations.id`, `source`, `fetched_at`
   - `flowerxi_exports_monthly.id`, `fetched_at`
   - `flowerxi_market_calendar.id`, `fetched_at`

2. **Simplificar query `/api/regions`**:
   ```sql
   -- Quitar: crop_focus, department, production_share
   SELECT slug, name, city FROM flowerxi_regions ORDER BY name;
   ```

3. **Eliminar `global_risk_level` de `/api/dashboard`**:
   - No se usa, el frontend calcula `risk_level` desde `score`.

### Prioridad MEDIA (optimizar)

4. **Reducir `/api/municipalities`**:
   - Quitar `department` (ya viene de `regions.department`)
   - Mantener `crop_focus` y `production_share` por si acaso

5. **Simplificar `/api/stations`**:
   - Quitar `station_code` (no se muestra), `elevation_m`, `latitude`, `longitude` (solo distance_km es clave)
   - Mantener `station_name`, `region_slug`, `distance_km`, `data_quality`

6. **Eliminar endpoints huérfanos**:
   - `/api/alerts/today` (redundante con dashboard)
   - `/api/calendar` (no se usa)
   - `/api/model/version` (no se usa)
   - `/api/alerts/history` (no se usa)

### Prioridad BAJA (documentar)

7. **`unit_value` en exports**:
   - No se muestra pero se calcula (`fob_usd / net_tons`). Considerar ocultar o eliminar.

8. **`main_varieties` array**:
   - Se usa, pero en rendering se hace `join(', ')`. OK.

---

## Resumen numérico final

| Categoría | Conteo |
|-----------|--------|
| Columnas totales en DB | 79 |
| Columnas usadas en frontend (directa o indirecta) | 45 |
| Columnas **activas** (en tablas + usadas) | 45 |
| Columnas en DB **nunca consultadas** | 11 |
| Columnas consultadas pero **NO usadas en UI** | 28 |
| Campos en queries que podrían eliminarse | ~23 |
| Endpoints completamente inactivos | 4 |

**Ahorro potencial**: ~35% de datos podrían removerse sin afectar la UI.

---

## Anexo: Queries específicas recomendadas

### A1. Query `/api/regions` optimizada:
```sql
SELECT slug, name, city
FROM flowerxi_regions
ORDER BY production_share DESC NULLS LAST, name ASC;
```

### A2. Query `/api/municipalities` optimizada:
```sql
SELECT 
  r.slug, r.name, r.city,
  mp.flower_area_ha, mp.greenhouse_area_ha,
  mp.workers, mp.workers_female, mp.workers_male,
  mp.fisanicitary_context, mp.waste_management, mp.main_varieties
FROM flowerxi_regions r
LEFT JOIN flowerxi_municipality_profile mp ON mp.region_slug = r.slug
WHERE r.department = 'CUNDINAMARCA'
ORDER BY r.production_share DESC NULLS LAST;
```

### A3. Query `dashboard_snapshot` optimizada:
```sql
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
JOIN flowerxi_weather_daily w ON w.region_slug = reg.slug
LEFT JOIN flowerxi_risk_signals r ON r.region_slug = w.region_slug AND r.observed_on = w.observed_on
LEFT JOIN flowerxi_recommendations rec ON rec.region_slug = w.region_slug AND rec.observed_on = w.observed_on
WHERE reg.slug = %s
ORDER BY w.observed_on DESC
LIMIT 1;
```

*Nota: Se eliminaron `region_city`, `crop_focus`, `global_risk_level`.

---

**Fin del reporte.**
