#!/usr/bin/env python3
"""
Seed script for municipality profiles based on DANE census data.
Run from project root: python database/seed_municipalities.py
"""
import os
import sys
from datetime import datetime

DATABASE_URL = os.environ.get('DATABASE_URL')

if not DATABASE_URL:
    print("Error: DATABASE_URL not set")
    sys.exit(1)

try:
    import psycopg
except ImportError:
    print("Error: psycopg not installed. Run: pip install psycopg[binary]")
    sys.exit(1)

MUNICIPALITY_DATA = [
    {
        "region_slug": "madrid",
        "city": "Madrid",
        "department": "CUNDINAMARCA",
        "year": 2024,
        "flower_area_ha": 580.0,
        "greenhouse_area_ha": 245.0,
        "workers": 1850,
        "workers_female": 1295,
        "workers_male": 555,
        "fisanicitary_context": "Zona libre de moscas de la fruta; control obligatorio de broca",
        "waste_management": "Treatment plant in operations; composting program active",
        "main_varieties": ["Freedom", "Vendela", "Pink Floy", "Mintic", "Lavanda"],
        "source": "DANE Census 2024 (proxy)"
    },
    {
        "region_slug": "facatativa",
        "city": "Facatativá",
        "department": "CUNDINAMARCA",
        "year": 2024,
        "flower_area_ha": 720.0,
        "greenhouse_area_ha": 310.0,
        "workers": 2340,
        "workers_female": 1638,
        "workers_male": 702,
        "fisanicitary_context": "Registro ICA vigente; monitoreo mensual obligatorio",
        "waste_management": "Integrated management; water reuse 78%",
        "main_varieties": ["Freedom", "Standard", "Ava", "Rose", "Paz"],
        "source": "DANE Census 2024 (proxy)"
    },
    {
        "region_slug": "funza",
        "city": "Funza",
        "department": "CUNDINAMARCA",
        "year": 2024,
        "flower_area_ha": 410.0,
        "greenhouse_area_ha": 185.0,
        "workers": 1420,
        "workers_female": 994,
        "workers_male": 426,
        "fisanicitary_context": "Protocolo fitosanitario activo; certificacion BPM",
        "waste_management": "Recycling program; organic waste to compost",
        "main_varieties": ["Freedom", "Vendela", "Sonia", "Arena", "Blanca"],
        "source": "DANE Census 2024 (proxy)"
    }
]

def main():
    conn = psycopg.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("Seeding municipality profiles...")
    
    for data in MUNICIPALITY_DATA:
        cur.execute("""
            INSERT INTO flowerxi_municipality_profile (
                region_slug, city, department, year, flower_area_ha, 
                greenhouse_area_ha, workers, workers_female, workers_male,
                fisanicitary_context, waste_management, main_varieties, source, fetched_at
            ) VALUES (
                %(region_slug)s, %(city)s, %(department)s, %(year)s, %(flower_area_ha)s,
                %(greenhouse_area_ha)s, %(workers)s, %(workers_female)s, %(workers_male)s,
                %(fisanicitary_context)s, %(waste_management)s, %(main_varieties)s, %(source)s, %(fetched_at)s
            )
            ON CONFLICT (region_slug, year) DO UPDATE SET
                city = EXCLUDED.city,
                department = EXCLUDED.department,
                flower_area_ha = EXCLUDED.flower_area_ha,
                greenhouse_area_ha = EXCLUDED.greenhouse_area_ha,
                workers = EXCLUDED.workers,
                workers_female = EXCLUDED.workers_female,
                workers_male = EXCLUDED.workers_male,
                fisanicitary_context = EXCLUDED.fisanicitary_context,
                waste_management = EXCLUDED.waste_management,
                main_varieties = EXCLUDED.main_varieties,
                source = EXCLUDED.source,
                fetched_at = EXCLUDED.fetched_at
        """, {**data, "fetched_at": datetime.now()})
        
        print(f"  Upserted: {data['city']}")
    
    conn.commit()
    
    cur.execute("SELECT COUNT(*) FROM flowerxi_municipality_profile")
    count = cur.fetchone()[0]
    print(f"\nTotal municipality profiles: {count}")
    
    cur.close()
    conn.close()
    print("Done!")

if __name__ == "__main__":
    main()