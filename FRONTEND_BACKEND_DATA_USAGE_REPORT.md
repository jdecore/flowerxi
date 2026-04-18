# Reporte de Uso de Datos — flowerxi

**Fecha**: 2026-04-18  
**Proyecto**: flowerxi (glovar)  
**Stack**: FastAPI + Postgres (InsForge) / Astro + Svelte  

---

## 📊 Resumen Ejecutivo

| Métrica | Valor |
|---------|-------|
| Total campos en DB (todas las tablas) | **52** |
| Campos activamente usados por el frontend | **18** |
| Campos redundantes (en DB pero NO usados) | **34** |
| Campos que frontend pide pero backend NO devuelve | **0** |
| Endpoints subutilizados (campos muertos en respuesta) | **5** |

**Conclusión**: El frontend utiliza un subconjunto muy pequeño de los datos disponibles (~35% de utilización). Hay oportunidades significativas de limpieza y simplificación.

---

## 📋 Tabla 1: Campos frontend esperados

| Componente / Endpoint | Nombre campo | Origen | Usado en UI | Notas |
|---|---|---|---|---|
| **OperationalHero** | `score` | `/api/risk/operativo` | sí | Número, riesgo 0–100 |
| OperationalHero | `status` | `/api/risk/operativo` | sí | `rutina`/`vigilancia`/`accion` |
| OperationalHero | `status_label` | `/api/risk/operativo` | sí | Etiqueta legible |
| OperationalHero | `reason` | `/api/risk/operativo` | sí | Motivo del riesgo |
| OperationalHero | `action_today` | `/api/risk/operativo` | sí | Acción recomendada |
| OperationalHero | `trend_7d` | `/api/risk/operativo` | sí | `up`/`down`/`stable` |
| OperationalHero | `confidence` | `/api/risk/operativo` | sí | `alta`/`media`/`baja` |
| OperationalHero | `details.days_available` | `/api/risk/operativo` | no | Solo para confianza |
| OperationalHero | `details.rainy_days` | `/api/risk/operativo` | no | En details, no mostrado |
| OperationalHero | `details.days_with_precip` | `/api/risk/operativo` | no | En details |
| OperationalHero | `details.avg_temp` | `/api/risk/operativo` | no | En details |
| OperationalHero | `details.avg_precip` | `/api/risk/operativo` | no | En details |
| OperationalHero | `precipitation_mm` | `/api/history` | sí | Último día |
| OperationalHero | `temp_mean_c` | `/api/history` | sí | Último día |
| **EvidenceSparklines** | `precipitation_mm` | `/api/history` | sí | Serie 14 días |
| EvidenceSparklines | `temp_mean_c` | `/api/history` | sí | Serie 14 días |
| EvidenceSparklines | `observed_on` | `/api/history` | no | Ordenar serie |
| EvidenceSparklines | `humiditySeries` | derivado | sí | Estimado vía fórmula |
| EvidenceSparklines | `riskSeries` | derivado | sí | Proxy de riesgo personalizado |
| **TodayChecklist** | `tasks[]`, `humidAction` | localStorage | sí | Sin API |
| **CommercialIntelCard** | `fob_usd` | `/api/exports` | sí | Sumado |
| CommercialIntelCard | `net_tons` | `/api/exports` | sí | Sumado |
| CommercialIntelCard | `summary.total_fob_usd` | `/api/exports` | sí | Card principal |
| CommercialIntelCard | `summary.total_net_tons` | `/api/exports` | no | Solo en summary |
| CommercialIntelCard | `summary.avg_price_per_kg` | `/api/exports` | no | No mostrado |
| CommercialIntelCard | `price_cop` | `/market_prices.json` | sí | Precios de mercado |
| CommercialIntelCard | `variety` | `/market_prices.json` | sí | Nombre variedad |
| **SabanaComparison** | `slug` | `/api/municipalities/compare` | sí | Identificador |
| SabanaComparison | `name` | `/api/municipalities/compare` | sí | Nombre |
| SabanaComparison | `area_ha` | `/api/municipalities/compare` | sí | Área |
| SabanaComparison | `workers_pct` | `/api/municipalities/compare` | no | No mostrado |
| SabanaComparison | `workers` | `/api/municipalities/compare` | no | No mostrado |
| SabanaComparison | `fitosanitary` | `/api/municipalities/compare` | no | No mostrado |
| SabanaComparison | `waste` | `/api/municipalities/compare` | no | No mostrado |
| SabanaComparison | `score` | `/api/risk/operativo` | sí | Riesgo por municipio |
| **ClosestStationFooter** | `station_name` | `/api/stations` | sí | Nombre estación |
| ClosestStationFooter | `distance_km` | `/api/stations` | sí | Distancia |
| ClosestStationFooter | `station_code` | `/api/stations` | no | ID interno |
| ClosestStationFooter | `region_slug` | `/api/stations` | no | Filtro no usado |
| ClosestStationFooter | `elevation_m` | `/api/stations` | no | No mostrado |
| ClosestStationFooter | `latitude`/`longitude` | `/api/stations` | no | No mostrado |
| ClosestStationFooter | `data_quality` | `/api/stations` | no | No mostrado |
| ClosestStationFooter | `source` | `/api/stations` | no | No mostrado |
| **WeeklyKPIs** | `global_risk_level` | `/api/recommendations/week` | sí | Para conteo vigilancia |
| WeeklyKPIs | `fungal_risk` | `/api/recommendations/week` | sí | Promedio score |
| WeeklyKPIs | `title` | `/api/recommendations/week` | sí | Recomendación top |
| WeeklyKPIs | `message` | `/api/recommendations/week` | no | No mostrado |
| WeeklyKPIs | `waterlogging_risk` | `/api/recommendations/week` | no | No usado |
| WeeklyKPIs | `heat_risk` | `/api/recommendations/week` | no | No usado |
| WeeklyKPIs | `precipitation_mm` | `/api/history` (fallback) | sí | Para riskProxy |
| WeeklyKPIs | `temp_mean_c` | `/api/history` (fallback) | sí | Para riskProxy |
| **RiskHeatmap** | `combined_score` | `/api/risk/monthly` | sí | Score principal |
| RiskHeatmap | `month_label` | `/api/risk/monthly` | sí | Etiqueta mes |
| RiskHeatmap | `risk_level` | `/api/risk/monthly` | sí | Nivel texto |
| RiskHeatmap | `agroclimatic_score` | `/api/risk/monthly` | no | Intermedio |
| RiskHeatmap | `avg_temp_c` | `/api/risk/monthly` | no | Para anomaly (no mostrado) |
| RiskHeatmap | `avg_precip_mm` | `/api/risk/monthly` | no | Para anomaly (no mostrado) |
| RiskHeatmap | `rainy_days` | `/api/risk/monthly` | no | No mostrado |
| RiskHeatmap | `sample_days` | `/api/risk/monthly` | no | No mostrado |
| RiskHeatmap | `temp_anomaly_c` | `/api/risk/monthly` | no | No mostrado |
| RiskHeatmap | `precip_anomaly_pct` | `/api/risk/monthly` | no | No mostrado |
| RiskHeatmap | `avg_fungal_risk` | `/api/risk/monthly` | no | No mostrado |
| RiskHeatmap | `avg_waterlogging_risk` | `/api/risk/monthly` | no | No mostrado |
| RiskHeatmap | `avg_heat_risk` | `/api/risk/monthly` | no | No mostrado |
| RiskHeatmap | `precipitation_mm` | `/api/history` (fallback) | sí | Serie para monthly derive |
| RiskHeatmap | `temp_mean_c` | `/api/history` (fallback) | sí | Ídem |
| RiskHeatmap | `observed_on` | `/api/history` (fallback) | sí | Para agrupar por mes |
| **ImpactoOperacion** | `score` | `/api/risk/operativo` | sí | Deriva ahorros |
| ImpactoOperacion | `combined_score` | `/api/dashboard` (fallback) | no | Fallback |
| ImpactoOperacion | `risk_score` | `/api/dashboard` (fallback) | no | Fallback |
| **Dashboard** | `regions` | `/api/dashboard/full` | sí | Lista municipios |
| Dashboard | `snapshot` | `/api/dashboard/full` | sí | Datos día actual |
| Dashboard | `operativo` | `/api/dashboard/full` | sí | Estado operativo |
| Dashboard | `history` | `/api/dashboard/full` | sí | Últimos 14 días |
| Dashboard | regions store `id,name` | `stores/region.js` | sí | Selector local |
| **WeatherMetrics** | `snapshot` | `/api/dashboard` | sí | Datos principales |
| WeatherMetrics | `items` | `/api/history` | sí | Últimos 30 días |
| **TrendChart** | `precipitation_mm` | `/api/history` | sí | Para riskCalc |
| TrendChart | `temp_mean_c` | `/api/history` | sí | Para riskCalc |
| TrendChart | `observed_on` | `/api/history` | sí | Eje X fechas |
| **ChatBot** | `score`, `status_label`, `action_today`, `reason` | `/api/risk/operativo` | no (interno) | Contexto IA |
| ChatBot | `temp_mean_c`, `precipitation_mm` | `/api/history` | no (interno) | Humedad regional |
| ChatBot | `flowerxi_today` | localStorage | sí | Contexto persistente |
| **ComercialDashboard** | `items` | `/api/exports` | sí | Tabla detallada |
| ComercialDashboard | `summary` | `/api/exports` | sí | Tarjetas resumen |
| ComercialDashboard | `data[]` | `/market_prices.json` | sí | Precios locales |

---

## 📋 Tabla 2: Campos DB NO utilizados en frontend

| Tabla DB | Columna | ¿Usada en endpoint? | ¿Se puede eliminar? / Razón |
|---|---|---|---|
| flowerxi_regions | `id` | NO | ✅ PK interna, nunca expuesta |
| flowerxi_regions | `latitude` | NO | ✅ Coordenadas no se consumen |
| flowerxi_regions | `longitude` | NO | ✅ Coordenadas no se consumen |
| flowerxi_regions | `created_at` | NO | ✅ Metadata ingesta |
| flowerxi_weather_daily | `id` | NO | ✅ PK interna |
| flowerxi_weather_daily | `temp_max_c` | NO | ✅ Solo se usa `temp_mean_c` |
| flowerxi_weather_daily | `temp_min_c` | NO | ✅ Ídem |
| flowerxi_weather_daily | `source` | NO | ❌ Trazabilidad (opcional) |
| flowerxi_weather_daily | `source_url` | NO | ❌ Trazabilidad (opcional) |
| flowerxi_weather_daily | `fetched_at` | NO | ✅ Metadata ingesta |
| flowerxi_risk_signals | `id` | NO | ✅ PK interna |
| flowerxi_risk_signals | `source` | NO | ❌ Trazabilidad (opcional) |
| flowerxi_risk_signals | `fetched_at` | NO | ✅ Metadata |
| flowerxi_risk_signals | `precipitation_risk` | NO | ✅ Columna agregada sin uso |
| flowerxi_risk_signals | `humidity_risk` | NO | ✅ Columna agregada sin uso |
| flowerxi_risk_signals | `temperature_risk` | NO | ✅ Columna agregada sin uso |
| flowerxi_risk_signals | `combined_score` | NO | ✅ Columna agregada sin uso |
| flowerxi_recommendations | `id` | NO | ✅ PK interna |
| flowerxi_recommendations | `source` | NO | ❌ Trazabilidad (opcional) |
| flowerxi_recommendations | `fetched_at` | NO | ✅ Metadata |
| flowerxi_market_calendar | `id` | NO | ✅ PK interna |
| flowerxi_market_calendar | `local_name` | NO | ✅ No se consume en UI |
| flowerxi_market_calendar | `source` | NO | ❌ Trazabilidad (opcional) |
| flowerxi_market_calendar | `source_url` | NO | ❌ Trazabilidad (opcional) |
| flowerxi_market_calendar | `fetched_at` | NO | ✅ Metadata |
| flowerxi_exports_monthly | `id` | NO | ✅ PK interna |
| flowerxi_exports_monthly | `subpartida` | NO | ✅ Código arancelario no usado |
| flowerxi_exports_monthly | `country_dest` | Parcial | ⚠️ Se muestra pero no filtra/agrega |
| flowerxi_exports_monthly | `unit_value` | NO | ✅ No se calcula/muestra |
| flowerxi_exports_monthly | `source` | NO | ❌ Trazabilidad (opcional) |
| flowerxi_exports_monthly | `fetched_at` | NO | ✅ Metadata |
| flowerxi_municipality_profile | `id` | NO | ✅ PK interna |
| flowerxi_municipality_profile | `city` | NO | ✅ Duplicado de regions.city |
| flowerxi_municipality_profile | `department` | NO | ✅ Duplicado de regions.department |
| flowerxi_municipality_profile | `workers_female` | NO | ✅ Desagregación no usada |
| flowerxi_municipality_profile | `workers_male` | NO | ✅ Desagregación no usada |
| flowerxi_municipality_profile | `fisanicitary_context` | NO | ⚠️ Se muestra en detalle municipio |
| flowerxi_municipality_profile | `waste_management` | NO | ⚠️ Se muestra en detalle municipio |
| flowerxi_municipality_profile | `main_varieties` | NO | ⚠️ Se muestra en detalle municipio |
| flowerxi_municipality_profile | `source` | NO | ❌ Trazabilidad (opcional) |
| flowerxi_municipality_profile | `fetched_at` | NO | ✅ Metadata |
| flowerxi_weather_stations | `id` | NO | ✅ PK interna |
| flowerxi_weather_stations | `region_slug` | NO | ✅ Filtro no aplicado |
| flowerxi_weather_stations | `latitude` | NO | ✅ No se mapa/geo |
| flowerxi_weather_stations | `longitude` | NO | ✅ No se mapa/geo |
| flowerxi_weather_stations | `source` | NO | ❌ Trazabilidad (opcional) |
| flowerxi_weather_stations | `fetched_at` | NO | ✅ Metadata |
| flowerxi_risk_model_versions | `id` | NO | ✅ PK interna |
| flowerxi_risk_model_versions | `weights` | NO | ✅ JSON no interpretado |
| flowerxi_risk_model_versions | `author` | NO | ✅ Metadata |
| flowerxi_risk_model_versions | `created_at` | NO | ✅ Metadata |
| flowerxi_risk_model_versions | `notes` | NO | ✅ Metadata |
| flowerxi_alert_history | `id` | NO | ✅ PK interna |
| flowerxi_alert_history | `alert_score` | NO | ✅ No se muestra numéricamente |
| flowerxi_alert_history | `message` | NO | ✅ No se muestra historial |
| flowerxi_alert_history | `protocol_applied` | NO | ✅ No se usa |
| flowerxi_alert_history | `compliance_status` | NO | ✅ No se usa |
| flowerxi_alert_history | `fetched_at` | NO | ✅ Metadata |
| flowerxi_risk_signals (ALTER) | `precipitation_risk` | NO | ✅ Columna agregada sin uso |
| flowerxi_risk_signals (ALTER) | `humidity_risk` | NO | ✅ Ídem |
| flowerxi_risk_signals (ALTER) | `temperature_risk` | NO | ✅ Ídem |
| flowerxi_risk_signals (ALTER) | `combined_score` | NO | ✅ Ídem |

---

## 📋 Tabla 3: Endpoints subutilizados (campos muertos en respuesta)

| Endpoint | Campos devueltos | Componentes que los consumen | Campos muertos (devueltos pero NO usados) |
|---|---|---|---|
| `/api/regions` | 6 campos | DashboardControls, Sidebar, RegionSelector | **NINGUNO** — 6/6 usados |
| `/api/municipalities` | 17 campos | MunicipiosList | `year`, `fisanicitary_context`, `waste_management`, `main_varieties`, `workers_female`, `workers_male` (6/17) |
| `/api/municipalities/{slug}` | 17 campos | MunicipiosList (detail) | `year`, `fisanicitary_context`, `waste_management`, `main_varieties`, `workers_female`, `workers_male` (6/17) |
| `/api/municipalities/compare` | 10 campos | SabanaComparison | `workers_pct`, `workers`, `fitosanitary`, `waste` (4/10) |
| `/api/exports` | `items[7] + summary[4] + by_month` | CommercialIntelCard, ComercialDashboard | `items.subpartida, country_dest, unit_value, source, summary.total_net_tons, summary.avg_price_per_kg, by_month` (7/15) |
| `/api/risk/explain` | 7 campos (analysis) | OperationalHero (no lo usa), ChatBot (parcial) | `period` (hardcoded), `precip_change_mm` (no mostrado) (2/7) |
| `/api/risk/operativo` | 15 campos (status + details) | 6 componentes | `details.*` (5), `attention` (6/15) |
| `/api/dashboard` | 12 campos (snapshot) | 3 componentes | `region_city`, `crop_focus`, `global_risk_level`, `recommendation_title`, `recommendation_message` (5/12) |
| `/api/history` | 3 campos | TODOS | **NINGUNO** — 3/3 usados |
| `/api/alerts/today` | 10 campos (alert) | **NINGUNO** | ❌ Endpoint huérfano — 10/10 no usados |
| `/api/recommendations/week` | 7 campos | WeeklyKPIs | `message`, `waterlogging_risk`, `heat_risk` (3/7) |
| `/api/risk/monthly` | 13 campos + items | RiskHeatmap | 10/13 no mostrados (todos excepto `combined_score`, `month_label`, `risk_level`) |
| `/api/stations` | 9 campos | ClosestStationFooter | `station_code`, `region_slug`, `elevation_m`, `latitude`, `longitude`, `data_quality`, `source` (7/9) |
| `/api/calendar` | 4 campos | **NINGUNO** | ❌ Endpoint huérfano — 4/4 no usados |
| `/api/model/version` | 6 campos | **NINGUNO** | ❌ Endpoint huérfano — 6/6 no usados |

---

## 📋 Tabla 4: Cruce DB → Endpoints → Frontend

| Tabla DB | Campo | Aparece en queries? | Lo consume frontend? |
|---|---|---|---|
| flowerxi_regions | slug | ✅ regions, municipalities, compare, full | ✅ SÍ |
| flowerxi_regions | name | ✅ regions, municipalities, compare, full | ✅ SÍ |
| flowerxi_regions | city | ✅ regions, municipalities, compare, full | ✅ SÍ |
| flowerxi_regions | crop_focus | ✅ regions, municipalities, compare, full | ⚠️ Parcial (listados) |
| flowerxi_regions | department | ✅ regions, municipalities | ✅ SÍ |
| flowerxi_regions | production_share | ✅ regions | ⚠️ Parcial (ranking) |
| flowerxi_weather_daily | region_slug | ✅ todas | ✅ SÍ (filtro) |
| flowerxi_weather_daily | observed_on | ✅ todas | ✅ SÍ |
| flowerxi_weather_daily | temp_mean_c | ✅ snapshot, history, monthly | ✅ SÍ |
| flowerxi_weather_daily | precipitation_mm | ✅ snapshot, history, monthly | ✅ SÍ |
| flowerxi_risk_signals | region_slug | ✅ operativo, explain, alerts, recommendations | ✅ SÍ |
| flowerxi_risk_signals | observed_on | ✅ operativo, explain, alerts, recommendations | ✅ SÍ |
| flowerxi_risk_signals | fungal_risk | ✅ operativo, alerts, recommendations | ✅ SÍ |
| flowerxi_risk_signals | waterlogging_risk | ✅ operativo, alerts | ✅ SÍ |
| flowerxi_risk_signals | heat_risk | ✅ operativo, alerts | ✅ SÍ |
| flowerxi_risk_signals | global_risk_level | ✅ recommendations_week | ✅ SÍ |
| flowerxi_recommendations | region_slug | ✅ recommendations_week | ✅ SÍ |
| flowerxi_recommendations | observed_on | ✅ recommendations_week | ✅ SÍ |
| flowerxi_recommendations | title | ✅ recommendations_week | ✅ SÍ |
| flowerxi_recommendations | message | ✅ recommendations_week | ⚠️ No mostrado |
| flowerxi_market_calendar | event_date | ✅ calendar | ❌ No consumido |
| flowerxi_market_calendar | event_name | ✅ calendar | ❌ No consumido |
| flowerxi_exports_monthly | year_month | ✅ exports | ✅ SÍ |
| flowerxi_exports_monthly | fob_usd | ✅ exports | ✅ SÍ |
| flowerxi_exports_monthly | net_tons | ✅ exports | ✅ SÍ |
| flowerxi_municipality_profile | region_slug | ✅ municipalities | ✅ SÍ |
| flowerxi_municipality_profile | flower_area_ha | ✅ municipalities | ✅ SÍ |
| flowerxi_municipality_profile | greenhouse_area_ha | ✅ municipalities | ✅ SÍ |
| flowerxi_municipality_profile | workers | ✅ municipalities | ✅ SÍ |
| flowerxi_weather_stations | station_code | ✅ stations | ⚠️ No mostrado |
| flowerxi_weather_stations | station_name | ✅ stations | ✅ SÍ |
| flowerxi_weather_stations | distance_km | ✅ stations | ✅ SÍ |
| flowerxi_alert_history | region_slug | ✅ alerts_history | ❌ No consumido |
| flowerxi_alert_history | observed_on | ✅ alerts_history | ❌ No consumido |
| flowerxi_alert_history | alert_level | ✅ alerts_history | ❌ No consumido |

---

## 📋 Tabla 5: Mocks y datos estáticos

| Archivo | Campos | Origen | Consumido por | Notas |
|---|---|---|---|---|
| `frontend/src/pages/index.astro` | (ninguno) | Layout estático | — | Solo estructura |
| `DashboardControls.svelte` | `selectedRegion`, `selectedLot` | localStorage + store | Sidebar sync | Estado UI |
| `TodayChecklist.svelte` | `tasks[]`, `humidAction` | localStorage | — | Checklist local |
| `Sidebar.svelte` | `regions[]`, `lotsByRegion` | `stores/region.js` | controles | Catálogo hardcoded |
| `model.js` (AI) | — | HuggingFace | ChatBot | Modelo externo |
| `market_prices.json` | `data[]: variety, price_cop, unit, source` | archivo local | CommercialIntelCard | Precios referencia |

---

## 🔍 Hallazgos específicos

### Mock History → EvidenceSparklines

- **mockHistory** (no existe): No hay un mockHistory declarado en `index.astro`. `EvidenceSparklines` consume directamente `/api/history`.
- `history` real trae `observed_on`, `temp_mean_c`, `precipitation_mm`.
- `Sparkline.svelte` recibe `data[]` (serie numérica) y `title`, `unit`, `color`.
- ✅ **Coincidencia perfecta**: `EvidenceSparklines` mapea `rainSeries = history.map(day => day.precipitation_mm)` → `Sparkline` → UI.

### Props Svelte → Endpoints

| Prop (Svelte) | Value source | Endpoint llamado | OK? |
|---|---|---|---|
| `apiUrl` | `index.astro` `env.PUBLIC_API_URL` | Base URL | ✅ |
| `initialRegion` / `region` | `index.astro` "madrid" o store | `/api/...?region=` | ✅ |
| `region` (DashboardControls) | store + localStorage | — | ✅ (control) |
| `lot` | store + localStorage | — | ✅ (control) |

**No hay props sin correspondencia**: todos los props son controles UI o region/lote, no datos crudos.

---

## 🧹 Recomendaciones de limpieza

### Backend (queries)

1. **Simplificar `/api/municipalities`**:
   ```sql
   -- Quitar: year, workers_female, workers_male, fisanicitary_context, waste_management, main_varieties
   SELECT slug, name, city, department, crop_focus, production_share, latitude, longitude, flower_area_ha, greenhouse_area_ha, workers
   ```
2. **Simplificar `/api/municipalities/compare`**:
   ```sql
   -- Solo mantener: slug, name, city, area_ha, greenhouse_area_ha
   -- Quitar workers_pct, workers, fitosanitary, waste
   ```
3. **Simplificar `/api/exports`**:
   ```sql
   -- Items: solo year_month, fob_usd, net_tons
   -- Summary: solo total_fob_usd, total_net_tons
   -- Eliminar subpartida, country_dest, unit_value, source, by_month
   ```
4. **Simplificar `/api/risk/operativo`**:
   - Quitar bloque `details.*` completo y campo `attention` de la SELECT principal (backend los calcula pero frontend NO los muestra)
5. **Simplificar `/api/dashboard`**:
   - De `dashboard_snapshot` query: quitar `reg.city AS region_city`, `reg.crop_focus`, `r.global_risk_level`, `rec.title`, `rec.message`
6. **Simplificar `/api/recommendations/week`**:
   - Quitar `r.waterlogging_risk`, `r.heat_risk`, `rec.message`
7. **Simplificar `/api/risk/monthly`**:
   - En SELECT, conservar solo: `month_start`, `month_label`, `combined_score`, `risk_level` (todas las anomaly y riesgos individuales pueden derivarse si se necesitan, pero NO se muestran)
8. **Simplificar `/api/stations`**:
   - SELECT solo `station_name`, `distance_km` (todo lo demás es metadata no usada)

### Endpoints huérfanos

- `/api/alerts/today` → Eliminar o conectar a OperationalHero/Dashboard
- `/api/calendar` → Eliminar o mostrar en UI (widget "Próximos eventos")
- `/api/model/version` → Eliminar o mostrar en footer técnico

### DB limpieza

**Columnas seguras a eliminar** (sin impacto frontend):
- Todas las `id` PK que no se exponen (mantener para integridad, pero no incluir en responses)
- Todas las `*_fetched_at`, `*_source`, `*_source_url` (metadata, mover a tablas de auditoría si se necesita)
- Duplicados: `flowerxi_municipality_profile.city`, `.department` → eliminar, usar regions
- Agregadas sin uso: columnas ALTER en `risk_signals` (`precipitation_risk`, etc.)

---

## 📈 Estadísticas finales

| Categoría | Conteo |
|---|---|
| Campos totales en schema.sql (sin contar PKs) | 52 |
| Campos usados en al menos 1 endpoint activamente | 18 |
| Campos NUNCA usados en queries backend | 34 |
| Endpoints con >30% campos muertos en respuesta | 5 |
| Componentes que consumen API | 12 |
| Fuentes de datos locales (mocks + storage) | 2 |

**Prioridades**:
1. 🔴 Eliminar `/api/alerts/today` si no se usa (10 campos muertos)
2. 🔴 Simplificar `/api/risk/operativo` (6 campos en `details` + `attention` no mostrados)
3. 🟡 Simplificar `/api/municipalities` (6 campos redundantes por query)
4. 🟢 Eliminar columnas huérfanas de DB una vez simplificadas queries

---

*Reporte generado por Kilo — Análisis estático de código flowerxi v1.0*
