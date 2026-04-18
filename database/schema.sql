CREATE TABLE IF NOT EXISTS flowerxi_regions (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  crop_focus TEXT NOT NULL,
  department TEXT DEFAULT 'CUNDINAMARCA',
  production_share DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flowerxi_weather_daily (
  id BIGSERIAL PRIMARY KEY,
  region_slug TEXT NOT NULL,
  observed_on DATE NOT NULL,
  temp_mean_c DOUBLE PRECISION,
  precipitation_mm DOUBLE PRECISION,
  UNIQUE(region_slug, observed_on)
);

CREATE TABLE IF NOT EXISTS flowerxi_risk_signals (
  id BIGSERIAL PRIMARY KEY,
  region_slug TEXT NOT NULL,
  observed_on DATE NOT NULL,
  fungal_risk INTEGER NOT NULL,
  waterlogging_risk INTEGER NOT NULL,
  heat_risk INTEGER NOT NULL,
  global_risk_level TEXT NOT NULL,
  UNIQUE(region_slug, observed_on)
);

CREATE TABLE IF NOT EXISTS flowerxi_recommendations (
  id BIGSERIAL PRIMARY KEY,
  region_slug TEXT NOT NULL,
  observed_on DATE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  UNIQUE(region_slug, observed_on)
);

CREATE TABLE IF NOT EXISTS flowerxi_market_calendar (
  id SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_name TEXT NOT NULL,
  local_name TEXT,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(country_code, event_date, event_name)
);

CREATE TABLE IF NOT EXISTS flowerxi_exports_monthly (
  id BIGSERIAL PRIMARY KEY,
  year_month TEXT NOT NULL,
  subpartida TEXT NOT NULL,
  country_dest TEXT NOT NULL,
  fob_usd DECIMAL(15,2),
  net_tons DECIMAL(12,2),
  UNIQUE(year_month, subpartida, country_dest)
);

CREATE TABLE IF NOT EXISTS flowerxi_municipality_profile (
  id SERIAL PRIMARY KEY,
  region_slug TEXT NOT NULL,
  city TEXT NOT NULL,
  department TEXT DEFAULT 'CUNDINAMARCA',
  year INTEGER,
  flower_area_ha DECIMAL(10,2),
  greenhouse_area_ha DECIMAL(8,2),
  workers INTEGER,
  UNIQUE(region_slug, year)
);

CREATE TABLE IF NOT EXISTS flowerxi_weather_stations (
  id SERIAL PRIMARY KEY,
  station_code TEXT NOT NULL,
  station_name TEXT NOT NULL,
  region_slug TEXT NOT NULL,
  distance_km DOUBLE PRECISION,
  UNIQUE(station_code)
);

CREATE TABLE IF NOT EXISTS flowerxi_risk_model_versions (
  id SERIAL PRIMARY KEY,
  version TEXT NOT NULL,
  formula_description TEXT NOT NULL,
  weights JSONB NOT NULL DEFAULT '{}',
  author TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS flowerxi_alert_history (
  id BIGSERIAL PRIMARY KEY,
  region_slug TEXT NOT NULL,
  observed_on DATE NOT NULL,
  alert_level TEXT NOT NULL,
  alert_score INTEGER,
  message TEXT,
  protocol_applied TEXT,
  compliance_status TEXT DEFAULT 'pending',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(region_slug, observed_on)
);

ALTER TABLE flowerxi_risk_signals 
  ADD COLUMN IF NOT EXISTS precipitation_risk INTEGER,
  ADD COLUMN IF NOT EXISTS humidity_risk INTEGER,
  ADD COLUMN IF NOT EXISTS temperature_risk INTEGER,
  ADD COLUMN IF NOT EXISTS combined_score INTEGER;

-- Cleanup de columnas no usadas por el frontend activo
ALTER TABLE flowerxi_weather_daily
  DROP COLUMN IF EXISTS temp_max_c,
  DROP COLUMN IF EXISTS temp_min_c,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS source_url,
  DROP COLUMN IF EXISTS fetched_at;

ALTER TABLE flowerxi_risk_signals
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS fetched_at,
  DROP COLUMN IF EXISTS precipitation_risk,
  DROP COLUMN IF EXISTS humidity_risk,
  DROP COLUMN IF EXISTS temperature_risk,
  DROP COLUMN IF EXISTS combined_score;

ALTER TABLE flowerxi_recommendations
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS fetched_at;

ALTER TABLE flowerxi_exports_monthly
  DROP COLUMN IF EXISTS unit_value,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS fetched_at;

ALTER TABLE flowerxi_municipality_profile
  DROP COLUMN IF EXISTS workers_female,
  DROP COLUMN IF EXISTS workers_male,
  DROP COLUMN IF EXISTS fisanicitary_context,
  DROP COLUMN IF EXISTS waste_management,
  DROP COLUMN IF EXISTS main_varieties,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS fetched_at;

ALTER TABLE flowerxi_weather_stations
  DROP COLUMN IF EXISTS elevation_m,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS data_quality,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS fetched_at;
