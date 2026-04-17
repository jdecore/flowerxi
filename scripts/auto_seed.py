#!/usr/bin/env python3
"""Daily weather/risk ingestion for Flowerxi, designed for GitHub Actions."""

from __future__ import annotations

import argparse
import datetime as dt
import os
import sys

import psycopg
import requests

REGIONS = [
    {
        "slug": "madrid",
        "name": "Madrid",
        "city": "Madrid",
        "latitude": 4.7320,
        "longitude": -74.2640,
        "crop_focus": "rosa de corte (lavanda/morada)",
    },
    {
        "slug": "facatativa",
        "name": "Facatativa",
        "city": "Facatativa",
        "latitude": 4.8130,
        "longitude": -74.3540,
        "crop_focus": "rosa de corte (lavanda/morada)",
    },
    {
        "slug": "funza",
        "name": "Funza",
        "city": "Funza",
        "latitude": 4.7160,
        "longitude": -74.2110,
        "crop_focus": "rosa de corte (lavanda/morada)",
    },
]


def clamp(value: int, min_value: int = 0, max_value: int = 100) -> int:
    return max(min_value, min(max_value, value))


def get_risk_level(fungal: int, water: int, heat: int) -> str:
    max_risk = max(fungal, water, heat)
    if max_risk >= 70:
        return "alto"
    if max_risk >= 40:
        return "medio"
    return "bajo"


def get_recommendation(fungal: int, water: int, heat: int) -> tuple[str, str]:
    if fungal >= max(water, heat):
        return (
            "Control fungico en rosa",
            "Aumenta ventilacion, evita mojado nocturno y refuerza monitoreo preventivo para botrytis en boton floral.",
        )
    if water >= max(fungal, heat):
        return (
            "Drenaje prioritario",
            "Ajusta drenajes y camas para evitar encharcamientos que afecten tallo, vida en florero y calidad de corte.",
        )
    return (
        "Manejo termico de invernadero",
        "Refuerza sombra en horas pico y calibra riego temprano para proteger calibre, color y firmeza de petalo.",
    )


def build_open_meteo_url(latitude: float, longitude: float, observed_on: dt.date) -> str:
    date_str = observed_on.isoformat()
    return (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={latitude:.4f}&longitude={longitude:.4f}"
        f"&start_date={date_str}&end_date={date_str}"
        "&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum"
        "&timezone=America%2FBogota"
    )


def fetch_day_weather(latitude: float, longitude: float, observed_on: dt.date) -> tuple[float, float, float, float, str]:
    source_url = build_open_meteo_url(latitude, longitude, observed_on)
    response = requests.get(source_url, timeout=30)
    response.raise_for_status()
    payload = response.json()
    daily = payload.get("daily", {})

    temp_mean = daily.get("temperature_2m_mean", [None])[0]
    temp_max = daily.get("temperature_2m_max", [None])[0]
    temp_min = daily.get("temperature_2m_min", [None])[0]
    precip = daily.get("precipitation_sum", [None])[0]
    if None in (temp_mean, temp_max, temp_min, precip):
        raise ValueError("Incomplete weather payload from Open-Meteo")

    return float(temp_mean), float(temp_max), float(temp_min), float(precip), source_url


def upsert_region(cur: psycopg.Cursor, region: dict) -> None:
    cur.execute(
        """
        INSERT INTO flowerxi_regions (slug, name, city, latitude, longitude, crop_focus)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          crop_focus = EXCLUDED.crop_focus;
        """,
        (
            region["slug"],
            region["name"],
            region["city"],
            region["latitude"],
            region["longitude"],
            region["crop_focus"],
        ),
    )


def upsert_daily_rows(cur: psycopg.Cursor, region: dict, observed_on: dt.date) -> None:
    temp_mean, temp_max, temp_min, precip, source_url = fetch_day_weather(
        region["latitude"], region["longitude"], observed_on
    )

    fungal = clamp(round((precip * 7.0) + max(0.0, 19.0 - temp_mean) * 2.2))
    water = clamp(round(precip * 9.0))
    heat = clamp(round(max(0.0, temp_mean - 20.0) * 12.0))
    risk_level = get_risk_level(fungal, water, heat)
    rec_title, rec_message = get_recommendation(fungal, water, heat)

    cur.execute(
        """
        INSERT INTO flowerxi_weather_daily
          (region_slug, observed_on, temp_mean_c, temp_max_c, temp_min_c, precipitation_mm, source, source_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (region_slug, observed_on) DO UPDATE SET
          temp_mean_c = EXCLUDED.temp_mean_c,
          temp_max_c = EXCLUDED.temp_max_c,
          temp_min_c = EXCLUDED.temp_min_c,
          precipitation_mm = EXCLUDED.precipitation_mm,
          source = EXCLUDED.source,
          source_url = EXCLUDED.source_url,
          fetched_at = NOW();
        """,
        (
            region["slug"],
            observed_on,
            temp_mean,
            temp_max,
            temp_min,
            precip,
            "open-meteo-archive",
            source_url,
        ),
    )

    cur.execute(
        """
        INSERT INTO flowerxi_risk_signals
          (region_slug, observed_on, fungal_risk, waterlogging_risk, heat_risk, global_risk_level, source)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (region_slug, observed_on) DO UPDATE SET
          fungal_risk = EXCLUDED.fungal_risk,
          waterlogging_risk = EXCLUDED.waterlogging_risk,
          heat_risk = EXCLUDED.heat_risk,
          global_risk_level = EXCLUDED.global_risk_level,
          source = EXCLUDED.source,
          fetched_at = NOW();
        """,
        (
            region["slug"],
            observed_on,
            fungal,
            water,
            heat,
            risk_level,
            "flowerxi-risk-model-v1",
        ),
    )

    cur.execute(
        """
        INSERT INTO flowerxi_recommendations
          (region_slug, observed_on, title, message, source)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (region_slug, observed_on) DO UPDATE SET
          title = EXCLUDED.title,
          message = EXCLUDED.message,
          source = EXCLUDED.source,
          fetched_at = NOW();
        """,
        (
            region["slug"],
            observed_on,
            rec_title,
            rec_message,
            "flowerxi-rules-2026",
        ),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Daily auto seed for Flowerxi")
    parser.add_argument(
        "--date",
        help="Observed day in YYYY-MM-DD format (defaults to yesterday UTC-5 approximation)",
    )
    return parser.parse_args()


def resolve_target_date(raw_date: str | None) -> dt.date:
    if raw_date:
        return dt.date.fromisoformat(raw_date)
    return (dt.datetime.utcnow() - dt.timedelta(days=1)).date()


def main() -> None:
    args = parse_args()
    observed_on = resolve_target_date(args.date)

    database_url = os.getenv("INSFORGE_DB_URL") or os.getenv("DB_URL")
    if not database_url:
        print("Missing INSFORGE_DB_URL (or DB_URL) environment variable.", file=sys.stderr)
        raise SystemExit(1)

    print(f"Starting auto seed for {observed_on.isoformat()}")
    failures: list[str] = []

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for region in REGIONS:
                try:
                    upsert_region(cur, region)
                    upsert_daily_rows(cur, region, observed_on)
                    conn.commit()
                    print(f"OK: {region['name']}")
                except Exception as exc:
                    conn.rollback()
                    failures.append(f"{region['slug']}: {exc}")
                    print(f"ERROR: {region['name']} -> {exc}", file=sys.stderr)

    if failures:
        print("Auto seed completed with errors:", file=sys.stderr)
        for item in failures:
            print(f"- {item}", file=sys.stderr)
        raise SystemExit(1)

    print("Auto seed completed successfully.")


if __name__ == "__main__":
    main()

