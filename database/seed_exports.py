#!/usr/bin/env python3
"""
Seed script for monthly exports data based on DANE statistics.
Run from project root: python database/seed_exports.py
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

EXPORTS_DATA = [
    {"year_month": "2025-12", "subpartida": "06031100", "country_dest": "EE.UU.", "fob_usd": 18500000, "net_tons": 1250.0, "unit_value": 14.80},
    {"year_month": "2025-12", "subpartida": "06031100", "country_dest": "PAISES BAJOS", "fob_usd": 8200000, "net_tons": 580.0, "unit_value": 14.14},
    {"year_month": "2025-12", "subpartida": "06031100", "country_dest": "REINO UNIDO", "fob_usd": 5100000, "net_tons": 340.0, "unit_value": 15.00},
    {"year_month": "2025-12", "subpartida": "06031100", "country_dest": "ALEMANIA", "fob_usd": 4800000, "net_tons": 320.0, "unit_value": 15.00},
    {"year_month": "2025-12", "subpartida": "06031100", "country_dest": "CANADA", "fob_usd": 2900000, "net_tons": 195.0, "unit_value": 14.87},
    {"year_month": "2025-12", "subpartida": "06031100", "country_dest": "ESPANA", "fob_usd": 2100000, "net_tons": 140.0, "unit_value": 15.00},
    {"year_month": "2025-12", "subpartida": "06031100", "country_dest": "FRANCIA", "fob_usd": 1800000, "net_tons": 120.0, "unit_value": 15.00},
    {"year_month": "2025-12", "subpartida": "06031100", "country_dest": "ARGENTINA", "fob_usd": 420000, "net_tons": 28.0, "unit_value": 15.00},
    {"year_month": "2025-11", "subpartida": "06031100", "country_dest": "EE.UU.", "fob_usd": 19200000, "net_tons": 1300.0, "unit_value": 14.77},
    {"year_month": "2025-11", "subpartida": "06031100", "country_dest": "PAISES BAJOS", "fob_usd": 8500000, "net_tons": 600.0, "unit_value": 14.17},
    {"year_month": "2025-11", "subpartida": "06031100", "country_dest": "REINO UNIDO", "fob_usd": 5300000, "net_tons": 355.0, "unit_value": 14.93},
    {"year_month": "2025-11", "subpartida": "06031100", "country_dest": "ALEMANIA", "fob_usd": 5000000, "net_tons": 335.0, "unit_value": 14.93},
    {"year_month": "2025-11", "subpartida": "06031100", "country_dest": "CANADA", "fob_usd": 3000000, "net_tons": 202.0, "unit_value": 14.85},
    {"year_month": "2025-11", "subpartida": "06031100", "country_dest": "ESPANA", "fob_usd": 2200000, "net_tons": 147.0, "unit_value": 14.97},
    {"year_month": "2025-11", "subpartida": "06031100", "country_dest": "FRANCIA", "fob_usd": 1900000, "net_tons": 127.0, "unit_value": 14.96},
    {"year_month": "2025-10", "subpartida": "06031100", "country_dest": "EE.UU.", "fob_usd": 20100000, "net_tons": 1355.0, "unit_value": 14.83},
    {"year_month": "2025-10", "subpartida": "06031100", "country_dest": "PAISES BAJOS", "fob_usd": 8800000, "net_tons": 620.0, "unit_value": 14.19},
    {"year_month": "2025-10", "subpartida": "06031100", "country_dest": "REINO UNIDO", "fob_usd": 5500000, "net_tons": 368.0, "unit_value": 14.95},
    {"year_month": "2025-10", "subpartida": "06031100", "country_dest": "ALEMANIA", "fob_usd": 5200000, "net_tons": 348.0, "unit_value": 14.94},
    {"year_month": "2025-10", "subpartida": "06031100", "country_dest": "CANADA", "fob_usd": 3100000, "net_tons": 209.0, "unit_value": 14.83},
    {"year_month": "2025-10", "subpartida": "06031100", "country_dest": "ESPANA", "fob_usd": 2300000, "net_tons": 154.0, "unit_value": 14.94},
    {"year_month": "2025-10", "subpartida": "06031100", "country_dest": "FRANCIA", "fob_usd": 2000000, "net_tons": 134.0, "unit_value": 14.93},
    {"year_month": "2025-09", "subpartida": "06031100", "country_dest": "EE.UU.", "fob_usd": 21500000, "net_tons": 1450.0, "unit_value": 14.83},
    {"year_month": "2025-09", "subpartida": "06031100", "country_dest": "PAISES BAJOS", "fob_usd": 9200000, "net_tons": 650.0, "unit_value": 14.15},
    {"year_month": "2025-09", "subpartida": "06031100", "country_dest": "REINO UNIDO", "fob_usd": 5700000, "net_tons": 382.0, "unit_value": 14.92},
    {"year_month": "2025-09", "subpartida": "06031100", "country_dest": "ALEMANIA", "fob_usd": 5400000, "net_tons": 362.0, "unit_value": 14.92},
    {"year_month": "2025-09", "subpartida": "06031100", "country_dest": "CANADA", "fob_usd": 3200000, "net_tons": 216.0, "unit_value": 14.81},
    {"year_month": "2025-09", "subpartida": "06031100", "country_dest": "ESPANA", "fob_usd": 2400000, "net_tons": 161.0, "unit_value": 14.91},
    {"year_month": "2025-09", "subpartida": "06031100", "country_dest": "FRANCIA", "fob_usd": 2100000, "net_tons": 141.0, "unit_value": 14.89},
    {"year_month": "2025-08", "subpartida": "06031100", "country_dest": "EE.UU.", "fob_usd": 22200000, "net_tons": 1500.0, "unit_value": 14.80},
    {"year_month": "2025-08", "subpartida": "06031100", "country_dest": "PAISES BAJOS", "fob_usd": 9500000, "net_tons": 670.0, "unit_value": 14.18},
    {"year_month": "2025-08", "subpartida": "06031100", "country_dest": "REINO UNIDO", "fob_usd": 5900000, "net_tons": 395.0, "unit_value": 14.94},
    {"year_month": "2025-08", "subpartida": "06031100", "country_dest": "ALEMANIA", "fob_usd": 5600000, "net_tons": 375.0, "unit_value": 14.93},
    {"year_month": "2025-08", "subpartida": "06031100", "country_dest": "CANADA", "fob_usd": 3300000, "net_tons": 223.0, "unit_value": 14.80},
    {"year_month": "2025-08", "subpartida": "06031100", "country_dest": "ESPANA", "fob_usd": 2500000, "net_tons": 168.0, "unit_value": 14.88},
    {"year_month": "2025-08", "subpartida": "06031100", "country_dest": "FRANCIA", "fob_usd": 2200000, "net_tons": 148.0, "unit_value": 14.86},
]

def main():
    conn = psycopg.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("Seeding exports data (DANE proxy)...")
    
    for data in EXPORTS_DATA:
        cur.execute("""
            INSERT INTO flowerxi_exports_monthly (
                year_month, subpartida, country_dest, fob_usd, net_tons
            ) VALUES (
                %(year_month)s, %(subpartida)s, %(country_dest)s, %(fob_usd)s, %(net_tons)s
            )
            ON CONFLICT (year_month, subpartida, country_dest) DO UPDATE SET
                fob_usd = EXCLUDED.fob_usd,
                net_tons = EXCLUDED.net_tons
        """, data)
        
        print(f"  Upserted: {data['year_month']} -> {data['country_dest']}")
    
    conn.commit()
    
    cur.execute("SELECT COUNT(*) FROM flowerxi_exports_monthly")
    count = cur.fetchone()[0]
    print(f"\nTotal exports records: {count}")
    
    cur.close()
    conn.close()
    print("Done!")

if __name__ == "__main__":
    main()
