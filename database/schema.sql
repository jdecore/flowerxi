CREATE TABLE IF NOT EXISTS flowerxi_regions (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  crop_focus TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flowerxi_weather_daily (
  id BIGSERIAL PRIMARY KEY,
  region_slug TEXT NOT NULL,
  observed_on DATE NOT NULL,
  temp_mean_c DOUBLE PRECISION,
  temp_max_c DOUBLE PRECISION,
  temp_min_c DOUBLE PRECISION,
  precipitation_mm DOUBLE PRECISION,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(region_slug, observed_on)
);

CREATE TABLE IF NOT EXISTS flowerxi_recommendations (
  id BIGSERIAL PRIMARY KEY,
  region_slug TEXT NOT NULL,
  observed_on DATE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(region_slug, observed_on)
);

CREATE TABLE IF NOT EXISTS flowerxi_market_calendar (
  id BIGSERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_name TEXT NOT NULL,
  local_name TEXT,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(country_code, event_date, event_name)
);
