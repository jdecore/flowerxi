#!/usr/bin/env python3
"""
Seed script for municipality profiles based on DANE census data.
Run from project root: python database/seed_municipalities.py
"""
import os
import sys

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
    },
    {
        "region_slug": "facatativa",
        "city": "Facatativá",
        "department": "CUNDINAMARCA",
        "year": 2024,
        "flower_area_ha": 720.0,
        "greenhouse_area_ha": 310.0,
        "workers": 2340,
    },
    {
        "region_slug": "funza",
        "city": "Funza",
        "department": "CUNDINAMARCA",
        "year": 2024,
        "flower_area_ha": 410.0,
        "greenhouse_area_ha": 185.0,
        "workers": 1420,
    }
]

def main():
    conn = psycopg.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("Seeding municipality profiles...")
    
    for data in MUNICIPALITY_DATA:
        cur.execute("""
            INSERT INTO flowerxi_municipality_profile (
                region_slug, city, department, year, flower_area_ha, greenhouse_area_ha, workers
            ) VALUES (
                %(region_slug)s, %(city)s, %(department)s, %(year)s, %(flower_area_ha)s, %(greenhouse_area_ha)s, %(workers)s
            )
            ON CONFLICT (region_slug, year) DO UPDATE SET
                city = EXCLUDED.city,
                department = EXCLUDED.department,
                flower_area_ha = EXCLUDED.flower_area_ha,
                greenhouse_area_ha = EXCLUDED.greenhouse_area_ha,
                workers = EXCLUDED.workers
        """, data)
        
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
