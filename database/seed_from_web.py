#!/usr/bin/env python3
"""Fetches public 2026 data from internet and seeds InsForge Postgres tables."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
import urllib.request
from typing import Iterable

START_DATE = "2026-01-01"
END_DATE = "2026-04-15"
HOLIDAYS_URL = "https://date.nager.at/api/v3/PublicHolidays/2026/CO"
REGIONS = [
    {
        "slug": "madrid",
        "name": "Madrid",
        "city": "Madrid, Cundinamarca",
        "latitude": 4.7320,
        "longitude": -74.2640,
        "crop_focus": "rosa de corte",
        "department": "CUNDINAMARCA",
        "production_share": 18.0,
    },
    {
        "slug": "facatativa",
        "name": "Facatativá",
        "city": "Facatativá, Cundinamarca",
        "latitude": 4.8130,
        "longitude": -74.3540,
        "crop_focus": "rosa, clavel",
        "department": "CUNDINAMARCA",
        "production_share": 9.0,
    },
    {
        "slug": "el-rosal",
        "name": "El Rosal",
        "city": "El Rosal, Cundinamarca",
        "latitude": 4.7760,
        "longitude": -74.3360,
        "crop_focus": "rosa, crisantemo",
        "department": "CUNDINAMARCA",
        "production_share": 8.0,
    },
    {
        "slug": "funza",
        "name": "Funza",
        "city": "Funza, Cundinamarca",
        "latitude": 4.7160,
        "longitude": -74.2110,
        "crop_focus": "rosa, clavel, alstroemeria",
        "department": "CUNDINAMARCA",
        "production_share": 5.0,
    },
    {
        "slug": "tocancipa",
        "name": "Tocancipá",
        "city": "Tocancipá, Cundinamarca",
        "latitude": 4.9530,
        "longitude": -73.9170,
        "crop_focus": "rosa de corte",
        "department": "CUNDINAMARCA",
        "production_share": 5.0,
    },
    {
        "slug": "chia",
        "name": "Chía",
        "city": "Chía, Cundinamarca",
        "latitude": 4.8670,
        "longitude": -73.8000,
        "crop_focus": "rosa, follajes",
        "department": "CUNDINAMARCA",
        "production_share": 3.0,
    },
    {
        "slug": "mosquera",
        "name": "Mosquera",
        "city": "Mosquera, Cundinamarca",
        "latitude": 4.6880,
        "longitude": -74.2290,
        "crop_focus": "rosa, clavel",
        "department": "CUNDINAMARCA",
        "production_share": 3.0,
    },
    {
        "slug": "sopo",
        "name": "Sopó",
        "city": "Sopó, Cundinamarca",
        "latitude": 4.9270,
        "longitude": -73.7740,
        "crop_focus": "rosa, hortensia",
        "department": "CUNDINAMARCA",
        "production_share": 2.0,
    },
    {
        "slug": "bojaca",
        "name": "Bojacá",
        "city": "Bojacá, Cundinamarca",
        "latitude": 4.7450,
        "longitude": -74.3890,
        "crop_focus": "rosa de corte",
        "department": "CUNDINAMARCA",
        "production_share": 2.0,
    },
    {
        "slug": "cachipay",
        "name": "Cachipay",
        "city": "Cachipay, Cundinamarca",
        "latitude": 4.7060,
        "longitude": -74.4550,
        "crop_focus": "flores de corte",
        "department": "CUNDINAMARCA",
        "production_share": 1.0,
    },
]


def build_open_meteo_url(latitude: float, longitude: float) -> str:
    return (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={latitude:.4f}&longitude={longitude:.4f}"
        f"&start_date={START_DATE}&end_date={END_DATE}"
        "&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum"
        "&timezone=America%2FBogota"
    )


def fetch_json(url: str):
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


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


def sql_escape(text: str) -> str:
    return text.replace("'", "''")


def run_insforge_query(query: str) -> None:
    result = subprocess.run(
        ["npx", "@insforge/cli", "db", "query", query],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise RuntimeError("InsForge query failed")


def chunked(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def build_data_rows():
    holidays = fetch_json(HOLIDAYS_URL)
    rows_weather: list[str] = []
    rows_risk: list[str] = []
    rows_recommendations: list[str] = []

    weather_sources: dict[str, str] = {}
    for region in REGIONS:
        region_slug = region["slug"]
        weather_url = build_open_meteo_url(region["latitude"], region["longitude"])
        weather_sources[region_slug] = weather_url
        weather = fetch_json(weather_url)
        daily = weather["daily"]

        for idx, day in enumerate(daily["time"]):
            temp_mean = float(daily["temperature_2m_mean"][idx])
            temp_max = float(daily["temperature_2m_max"][idx])
            temp_min = float(daily["temperature_2m_min"][idx])
            precip = float(daily["precipitation_sum"][idx])

            fungal = clamp(round((precip * 7.0) + max(0.0, 19.0 - temp_mean) * 2.2))
            water = clamp(round(precip * 9.0))
            heat = clamp(round(max(0.0, temp_mean - 20.0) * 12.0))
            risk_level = get_risk_level(fungal, water, heat)
            rec_title, rec_message = get_recommendation(fungal, water, heat)

            rows_weather.append(
                "("
                + ",".join(
                    [
                        f"'{region_slug}'",
                        f"'{day}'",
                        f"{temp_mean:.2f}",
                        f"{temp_max:.2f}",
                        f"{temp_min:.2f}",
                        f"{precip:.2f}",
                        "'open-meteo-archive'",
                        f"'{weather_url}'",
                    ]
                )
                + ")"
            )

            rows_risk.append(
                "("
                + ",".join(
                    [
                        f"'{region_slug}'",
                        f"'{day}'",
                        str(fungal),
                        str(water),
                        str(heat),
                        f"'{risk_level}'",
                        "'flowerxi-risk-model-v1'",
                    ]
                )
                + ")"
            )

            rows_recommendations.append(
                "("
                + ",".join(
                    [
                        f"'{region_slug}'",
                        f"'{day}'",
                        f"'{sql_escape(rec_title)}'",
                        f"'{sql_escape(rec_message)}'",
                        "'flowerxi-rules-2026'",
                    ]
                )
                + ")"
            )

    rows_holidays: list[str] = []
    for item in holidays:
        date_raw = item["date"]
        dt.date.fromisoformat(date_raw)
        name = sql_escape(item.get("name", "Holiday"))
        local = sql_escape(item.get("localName", ""))
        rows_holidays.append(
            "("
            + ",".join(
                [
                    "'CO'",
                    f"'{date_raw}'",
                    f"'{name}'",
                    f"'{local}'",
                    "'nager-public-holidays'",
                    f"'{HOLIDAYS_URL}'",
                ]
            )
            + ")"
        )

    return rows_weather, rows_risk, rows_recommendations, rows_holidays, weather_sources


def apply_seed() -> None:
    region_rows: list[str] = []
    for region in REGIONS:
        region_rows.append(
            "("
            + ",".join(
                [
                    f"'{sql_escape(region['slug'])}'",
                    f"'{sql_escape(region['name'])}'",
                    f"'{sql_escape(region['city'])}'",
                    f"{region['latitude']:.4f}",
                    f"{region['longitude']:.4f}",
                    f"'{sql_escape(region['crop_focus'])}'",
                    f"'{sql_escape(region['department'])}'",
                    f"{region.get('production_share', 'NULL')}",
                ]
            )
            + ")"
        )

    run_insforge_query(
        """
        INSERT INTO flowerxi_regions (slug, name, city, latitude, longitude, crop_focus, department, production_share)
        VALUES
        """.strip()
        + "\n"
        + ",\n".join(region_rows)
        + """
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          city = EXCLUDED.city,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          crop_focus = EXCLUDED.crop_focus,
          department = EXCLUDED.department,
          production_share = EXCLUDED.production_share;
        """.rstrip()
    )

    rows_weather, rows_risk, rows_recommendations, rows_holidays, _ = build_data_rows()

    for chunk in chunked(rows_weather, 30):
        run_insforge_query(
            """
            INSERT INTO flowerxi_weather_daily
              (region_slug, observed_on, temp_mean_c, temp_max_c, temp_min_c, precipitation_mm, source, source_url)
            VALUES
            """.strip()
            + "\n"
            + ",\n".join(chunk)
            + "\nON CONFLICT (region_slug, observed_on) DO UPDATE SET\n"
            + "temp_mean_c = EXCLUDED.temp_mean_c, temp_max_c = EXCLUDED.temp_max_c, temp_min_c = EXCLUDED.temp_min_c, precipitation_mm = EXCLUDED.precipitation_mm, source = EXCLUDED.source, source_url = EXCLUDED.source_url, fetched_at = NOW();"
        )

    for chunk in chunked(rows_risk, 30):
        run_insforge_query(
            """
            INSERT INTO flowerxi_risk_signals
              (region_slug, observed_on, fungal_risk, waterlogging_risk, heat_risk, global_risk_level, source)
            VALUES
            """.strip()
            + "\n"
            + ",\n".join(chunk)
            + "\nON CONFLICT (region_slug, observed_on) DO UPDATE SET\n"
            + "fungal_risk = EXCLUDED.fungal_risk, waterlogging_risk = EXCLUDED.waterlogging_risk, heat_risk = EXCLUDED.heat_risk, global_risk_level = EXCLUDED.global_risk_level, source = EXCLUDED.source, fetched_at = NOW();"
        )

    for chunk in chunked(rows_recommendations, 30):
        run_insforge_query(
            """
            INSERT INTO flowerxi_recommendations
              (region_slug, observed_on, title, message, source)
            VALUES
            """.strip()
            + "\n"
            + ",\n".join(chunk)
            + "\nON CONFLICT (region_slug, observed_on) DO UPDATE SET\n"
            + "title = EXCLUDED.title, message = EXCLUDED.message, source = EXCLUDED.source, fetched_at = NOW();"
        )

    for chunk in chunked(rows_holidays, 20):
        run_insforge_query(
            """
            INSERT INTO flowerxi_market_calendar
              (country_code, event_date, event_name, local_name, source, source_url)
            VALUES
            """.strip()
            + "\n"
            + ",\n".join(chunk)
            + "\nON CONFLICT (country_code, event_date, event_name) DO UPDATE SET\n"
            + "local_name = EXCLUDED.local_name, source = EXCLUDED.source, source_url = EXCLUDED.source_url, fetched_at = NOW();"
        )

    print("Seed completed:")
    print(f"- regions: {len(REGIONS)}")
    print(f"- weather rows: {len(rows_weather)}")
    print(f"- risk rows: {len(rows_risk)}")
    print(f"- recommendation rows: {len(rows_recommendations)}")
    print(f"- market calendar rows: {len(rows_holidays)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed InsForge with 2026 FlowerXi data"
    )
    parser.add_argument(
        "--apply", action="store_true", help="Apply seed directly to InsForge"
    )
    args = parser.parse_args()

    if not args.apply:
        (
            rows_weather,
            rows_risk,
            rows_recommendations,
            rows_holidays,
            weather_sources,
        ) = build_data_rows()
        print(
            json.dumps(
                {
                    "regions": [region["slug"] for region in REGIONS],
                    "weather_rows": len(rows_weather),
                    "risk_rows": len(rows_risk),
                    "recommendation_rows": len(rows_recommendations),
                    "market_calendar_rows": len(rows_holidays),
                    "weather_sources": weather_sources,
                    "calendar_source": HOLIDAYS_URL,
                },
                indent=2,
            )
        )
        return

    apply_seed()


if __name__ == "__main__":
    main()
