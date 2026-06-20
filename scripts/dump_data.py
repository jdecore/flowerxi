#!/usr/bin/env python3
"""Generate all static JSON data files for flowerxi frontend (no backend needed)."""

from __future__ import annotations

import json
import os
import sys
import datetime as dt
import urllib.request
import urllib.error

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data")

REGIONS = [
    {"slug": "madrid", "name": "Madrid", "city": "Madrid", "department": "CUNDINAMARCA",
     "latitude": 4.7320, "longitude": -74.2640, "production_share": 0.18,
     "flower_area_ha": 420, "workers": 3200, "crop_focus": "rosa de corte"},
    {"slug": "facatativa", "name": "Facatativá", "city": "Facatativá", "department": "CUNDINAMARCA",
     "latitude": 4.8130, "longitude": -74.3540, "production_share": 0.15,
     "flower_area_ha": 385, "workers": 2800, "crop_focus": "rosa de corte"},
    {"slug": "funza", "name": "Funza", "city": "Funza", "department": "CUNDINAMARCA",
     "latitude": 4.7160, "longitude": -74.2110, "production_share": 0.14,
     "flower_area_ha": 360, "workers": 2600, "crop_focus": "rosa de corte"},
    {"slug": "el-rosal", "name": "El Rosal", "city": "El Rosal", "department": "CUNDINAMARCA",
     "latitude": 4.8520, "longitude": -74.2590, "production_share": 0.12,
     "flower_area_ha": 310, "workers": 2200, "crop_focus": "rosa de corte"},
    {"slug": "tocancipa", "name": "Tocancipá", "city": "Tocancipá", "department": "CUNDINAMARCA",
     "latitude": 4.9650, "longitude": -73.9110, "production_share": 0.10,
     "flower_area_ha": 280, "workers": 1900, "crop_focus": "rosa de corte"},
    {"slug": "chia", "name": "Chía", "city": "Chía", "department": "CUNDINAMARCA",
     "latitude": 4.8580, "longitude": -74.0530, "production_share": 0.09,
     "flower_area_ha": 250, "workers": 1700, "crop_focus": "rosa de corte"},
    {"slug": "mosquera", "name": "Mosquera", "city": "Mosquera", "department": "CUNDINAMARCA",
     "latitude": 4.7080, "longitude": -74.2330, "production_share": 0.08,
     "flower_area_ha": 220, "workers": 1500, "crop_focus": "rosa de corte"},
    {"slug": "sopo", "name": "Sopó", "city": "Sopó", "department": "CUNDINAMARCA",
     "latitude": 4.9100, "longitude": -73.9360, "production_share": 0.06,
     "flower_area_ha": 180, "workers": 1200, "crop_focus": "rosa de corte"},
    {"slug": "bojaca", "name": "Bojacá", "city": "Bojacá", "department": "CUNDINAMARCA",
     "latitude": 4.7300, "longitude": -74.3470, "production_share": 0.05,
     "flower_area_ha": 150, "workers": 1000, "crop_focus": "rosa de corte"},
    {"slug": "cachipay", "name": "Cachipay", "city": "Cachipay", "department": "CUNDINAMARCA",
     "latitude": 5.2650, "longitude": -74.5630, "production_share": 0.03,
     "flower_area_ha": 90, "workers": 600, "crop_focus": "rosa de corte"},
]

STATIONS = [
    {"station_name": "Aeropuerto El Dorado", "region_slug": "madrid", "distance_km": 8.5},
    {"station_name": "Aeropuerto El Dorado", "region_slug": "funza", "distance_km": 5.2},
    {"station_name": "Aeropuerto El Dorado", "region_slug": "mosquera", "distance_km": 6.8},
    {"station_name": "Aeropuerto El Dorado", "region_slug": "bojaca", "distance_km": 12.1},
    {"station_name": "Base Aérea Madrid", "region_slug": "madrid", "distance_km": 3.2},
    {"station_name": "Estación Facatativá", "region_slug": "facatativa", "distance_km": 2.1},
    {"station_name": "Estación Facatativá", "region_slug": "el-rosal", "distance_km": 7.5},
    {"station_name": "Estación Tocancipá", "region_slug": "tocancipa", "distance_km": 1.5},
    {"station_name": "Estación Tocancipá", "region_slug": "sopo", "distance_km": 6.3},
    {"station_name": "Estación Chía", "region_slug": "chia", "distance_km": 2.8},
    {"station_name": "Estación Chía", "region_slug": "cachipay", "distance_km": 45.0},
]

EXPORTS = [
    {"year_month": "2026-04", "country_dest": "Estados Unidos", "fob_usd": 28400000.0, "net_tons": 1520.0},
    {"year_month": "2026-04", "country_dest": "Japón", "fob_usd": 12300000.0, "net_tons": 680.0},
    {"year_month": "2026-04", "country_dest": "Reino Unido", "fob_usd": 9800000.0, "net_tons": 510.0},
    {"year_month": "2026-04", "country_dest": "Canadá", "fob_usd": 7200000.0, "net_tons": 390.0},
    {"year_month": "2026-04", "country_dest": "Países Bajos", "fob_usd": 5600000.0, "net_tons": 310.0},
    {"year_month": "2026-03", "country_dest": "Estados Unidos", "fob_usd": 27600000.0, "net_tons": 1480.0},
    {"year_month": "2026-03", "country_dest": "Japón", "fob_usd": 11900000.0, "net_tons": 660.0},
    {"year_month": "2026-03", "country_dest": "Reino Unido", "fob_usd": 9500000.0, "net_tons": 500.0},
    {"year_month": "2026-03", "country_dest": "Canadá", "fob_usd": 7000000.0, "net_tons": 380.0},
    {"year_month": "2026-03", "country_dest": "Países Bajos", "fob_usd": 5400000.0, "net_tons": 300.0},
    {"year_month": "2026-02", "country_dest": "Estados Unidos", "fob_usd": 25200000.0, "net_tons": 1350.0},
    {"year_month": "2026-02", "country_dest": "Japón", "fob_usd": 10800000.0, "net_tons": 600.0},
    {"year_month": "2026-02", "country_dest": "Reino Unido", "fob_usd": 8700000.0, "net_tons": 460.0},
    {"year_month": "2026-02", "country_dest": "Canadá", "fob_usd": 6400000.0, "net_tons": 350.0},
    {"year_month": "2026-02", "country_dest": "Rusia", "fob_usd": 4200000.0, "net_tons": 240.0},
    {"year_month": "2026-01", "country_dest": "Estados Unidos", "fob_usd": 23800000.0, "net_tons": 1280.0},
    {"year_month": "2026-01", "country_dest": "Japón", "fob_usd": 10200000.0, "net_tons": 570.0},
    {"year_month": "2026-01", "country_dest": "Reino Unido", "fob_usd": 8200000.0, "net_tons": 440.0},
    {"year_month": "2026-01", "country_dest": "Canadá", "fob_usd": 6000000.0, "net_tons": 330.0},
    {"year_month": "2026-01", "country_dest": "Países Bajos", "fob_usd": 4800000.0, "net_tons": 270.0},
    {"year_month": "2025-12", "country_dest": "Estados Unidos", "fob_usd": 26500000.0, "net_tons": 1420.0},
    {"year_month": "2025-12", "country_dest": "Japón", "fob_usd": 11400000.0, "net_tons": 630.0},
    {"year_month": "2025-12", "country_dest": "Reino Unido", "fob_usd": 9100000.0, "net_tons": 490.0},
    {"year_month": "2025-12", "country_dest": "Canadá", "fob_usd": 6700000.0, "net_tons": 370.0},
    {"year_month": "2025-12", "country_dest": "Rusia", "fob_usd": 4400000.0, "net_tons": 250.0},
    {"year_month": "2025-11", "country_dest": "Estados Unidos", "fob_usd": 22100000.0, "net_tons": 1190.0},
    {"year_month": "2025-11", "country_dest": "Japón", "fob_usd": 9500000.0, "net_tons": 530.0},
    {"year_month": "2025-11", "country_dest": "Reino Unido", "fob_usd": 7600000.0, "net_tons": 410.0},
    {"year_month": "2025-11", "country_dest": "Canadá", "fob_usd": 5600000.0, "net_tons": 310.0},
    {"year_month": "2025-11", "country_dest": "Países Bajos", "fob_usd": 4300000.0, "net_tons": 240.0},
    {"year_month": "2025-10", "country_dest": "Estados Unidos", "fob_usd": 24800000.0, "net_tons": 1330.0},
    {"year_month": "2025-10", "country_dest": "Japón", "fob_usd": 10600000.0, "net_tons": 590.0},
    {"year_month": "2025-10", "country_dest": "Reino Unido", "fob_usd": 8500000.0, "net_tons": 460.0},
    {"year_month": "2025-10", "country_dest": "Canadá", "fob_usd": 6300000.0, "net_tons": 350.0},
    {"year_month": "2025-10", "country_dest": "Rusia", "fob_usd": 4100000.0, "net_tons": 230.0},
    {"year_month": "2025-09", "country_dest": "Estados Unidos", "fob_usd": 21500000.0, "net_tons": 1160.0},
    {"year_month": "2025-09", "country_dest": "Japón", "fob_usd": 9200000.0, "net_tons": 510.0},
    {"year_month": "2025-09", "country_dest": "Reino Unido", "fob_usd": 7400000.0, "net_tons": 400.0},
    {"year_month": "2025-09", "country_dest": "Canadá", "fob_usd": 5400000.0, "net_tons": 300.0},
    {"year_month": "2025-09", "country_dest": "Países Bajos", "fob_usd": 4100000.0, "net_tons": 230.0},
]

HOLIDAYS_2026 = [
    {"date": "2026-01-01", "name": "Año Nuevo", "type": "public"},
    {"date": "2026-01-06", "name": "Día de los Reyes Magos", "type": "public"},
    {"date": "2026-03-23", "name": "Día de San José", "type": "public"},
    {"date": "2026-03-29", "name": "Domingo de Ramos", "type": "public"},
    {"date": "2026-04-02", "name": "Jueves Santo", "type": "public"},
    {"date": "2026-04-03", "name": "Viernes Santo", "type": "public"},
    {"date": "2026-04-05", "name": "Domingo de Pascua", "type": "public"},
    {"date": "2026-05-01", "name": "Día del Trabajo", "type": "public"},
    {"date": "2026-05-18", "name": "Ascensión del Señor", "type": "public"},
    {"date": "2026-06-08", "name": "Corpus Christi", "type": "public"},
    {"date": "2026-06-15", "name": "Sagrado Corazón de Jesús", "type": "public"},
    {"date": "2026-06-29", "name": "San Pedro y San Pablo", "type": "public"},
    {"date": "2026-07-20", "name": "Día de la Independencia", "type": "public"},
    {"date": "2026-08-07", "name": "Batalla de Boyacá", "type": "public"},
    {"date": "2026-08-17", "name": "Asunción de la Virgen", "type": "public"},
    {"date": "2026-10-12", "name": "Día de la Raza", "type": "public"},
    {"date": "2026-11-02", "name": "Todos los Santos", "type": "public"},
    {"date": "2026-11-16", "name": "Independencia de Cartagena", "type": "public"},
    {"date": "2026-12-08", "name": "Inmaculada Concepción", "type": "public"},
    {"date": "2026-12-25", "name": "Navidad", "type": "public"},
]


def clamp_int(value, min_val=0, max_val=100):
    return max(min_val, min(max_val, round(value)))


def get_risk_level(fungal, water, heat):
    max_risk = max(fungal, water, heat)
    if max_risk >= 70: return "alto"
    if max_risk >= 40: return "medio"
    return "bajo"


def get_recommendation(fungal, water, heat):
    if fungal >= max(water, heat):
        return ("Control fungico en rosa",
                "Aumenta ventilacion, evita mojado nocturno y refuerza monitoreo preventivo para botrytis en boton floral.")
    if water >= max(fungal, heat):
        return ("Drenaje prioritario",
                "Ajusta drenajes y camas para evitar encharcamientos que afecten tallo, vida en florero y calidad de corte.")
    return ("Manejo termico de invernadero",
            "Refuerza sombra en horas pico y calibra riego temprano para proteger calibre, color y firmeza de petalo.")


def build_open_meteo_url(lat, lon, start_date, end_date):
    return (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat:.4f}&longitude={lon:.4f}"
        f"&start_date={start_date}&end_date={end_date}"
        "&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum"
        "&timezone=America%2FBogota"
    )


def fetch_weather_bulk(lat, lon, start_date, end_date):
    url = build_open_meteo_url(lat, lon, start_date, end_date)
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    daily = data.get("daily", {})
    dates = daily.get("time", [])
    temp_means = daily.get("temperature_2m_mean", [])
    temp_maxs = daily.get("temperature_2m_max", [])
    temp_mins = daily.get("temperature_2m_min", [])
    precips = daily.get("precipitation_sum", [])
    results = []
    for i in range(len(dates)):
        if all(v is not None for v in [dates[i], temp_means[i], temp_maxs[i], temp_mins[i], precips[i]]):
            results.append({
                "observed_on": dates[i],
                "temp_mean_c": float(temp_means[i]),
                "temp_max_c": float(temp_maxs[i]),
                "temp_min_c": float(temp_mins[i]),
                "precipitation_mm": float(precips[i]),
            })
    return results


def compute_weather_with_risk(region, weather_records):
    items = []
    for day in weather_records:
        temp_mean = day["temp_mean_c"]
        precip = day["precipitation_mm"]
        fungal = clamp_int((precip * 7.0) + max(0.0, 19.0 - temp_mean) * 2.2)
        water = clamp_int(precip * 9.0)
        heat = clamp_int(max(0.0, temp_mean - 20.0) * 12.0)
        risk_level = get_risk_level(fungal, water, heat)
        rec_title, rec_message = get_recommendation(fungal, water, heat)
        items.append({
            "region_slug": region["slug"],
            "observed_on": day["observed_on"],
            "temp_mean_c": temp_mean,
            "temp_max_c": day["temp_max_c"],
            "temp_min_c": day["temp_min_c"],
            "precipitation_mm": precip,
            "fungal_risk": fungal,
            "waterlogging_risk": water,
            "heat_risk": heat,
            "global_risk_level": risk_level,
            "recommendation_title": rec_title,
            "recommendation_message": rec_message,
        })
    return items


def generate_municipality_profiles(regions):
    profiles = []
    for r in regions:
        profiles.append({
            "region_slug": r["slug"],
            "year": 2026,
            "flower_area_ha": r["flower_area_ha"],
            "workers": r["workers"],
            "crop_focus": r["crop_focus"],
        })
    return profiles


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    start_date = "2026-01-01"
    end_date = "2026-05-31"

    print(f"Fetching weather data from {start_date} to {end_date} for {len(REGIONS)} regions...")

    all_weather = []
    for region in REGIONS:
        try:
            print(f"  {region['slug']}...", end=" ", flush=True)
            records = fetch_weather_bulk(region["latitude"], region["longitude"], start_date, end_date)
            computed = compute_weather_with_risk(region, records)
            all_weather.extend(computed)
            print(f"{len(computed)} days")
        except Exception as e:
            print(f"ERROR: {e}")

    # Write regions
    regions_out = []
    for r in REGIONS:
        regions_out.append({
            "slug": r["slug"],
            "name": r["name"],
            "city": r["city"],
            "department": r["department"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "production_share": r["production_share"],
            "flower_area_ha": r["flower_area_ha"],
            "workers": r["workers"],
        })

    with open(os.path.join(OUTPUT_DIR, "regions.json"), "w") as f:
        json.dump(regions_out, f, indent=2)
    print(f"\nregions.json: {len(regions_out)} regions")

    # Write weather
    with open(os.path.join(OUTPUT_DIR, "weather.json"), "w") as f:
        json.dump(all_weather, f, indent=2)
    print(f"weather.json: {len(all_weather)} records")

    # Write exports
    with open(os.path.join(OUTPUT_DIR, "exports.json"), "w") as f:
        json.dump(EXPORTS, f, indent=2)
    print(f"exports.json: {len(EXPORTS)} records")

    # Write stations
    with open(os.path.join(OUTPUT_DIR, "stations.json"), "w") as f:
        json.dump(STATIONS, f, indent=2)
    print(f"stations.json: {len(STATIONS)} stations")

    # Write municipality profiles
    profiles = generate_municipality_profiles(REGIONS)
    with open(os.path.join(OUTPUT_DIR, "municipality_profiles.json"), "w") as f:
        json.dump(profiles, f, indent=2)
    print(f"municipality_profiles.json: {len(profiles)} profiles")

    # Write market calendar (holidays)
    with open(os.path.join(OUTPUT_DIR, "market_calendar.json"), "w") as f:
        json.dump(HOLIDAYS_2026, f, indent=2)
    print(f"market_calendar.json: {len(HOLIDAYS_2026)} holidays")

    print("\nDone! All JSON files written to", OUTPUT_DIR)


if __name__ == "__main__":
    main()
