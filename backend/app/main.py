from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_conn

app = FastAPI(title=settings.app_name)
DEFAULT_REGION = "madrid"


def normalize_origin(origin: str) -> str:
    clean = origin.strip().strip('"').strip("'")
    return clean.rstrip("/")


allowed_origins = []
for raw_origin in settings.cors_origins.split(","):
    normalized = normalize_origin(raw_origin)
    if normalized:
        allowed_origins.append(normalized)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": settings.app_name, "env": settings.app_env}


@app.get("/api/regions")
def regions():
    sql = """
    SELECT slug, name, city, crop_focus
    FROM flowerxi_regions
    ORDER BY name ASC;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    return {"ok": True, "default_region": DEFAULT_REGION, "items": rows}


@app.get("/api/dashboard")
def dashboard(region: str = Query(DEFAULT_REGION)):
    sql = """
    SELECT
      reg.name AS region_name,
      reg.city AS region_city,
      reg.crop_focus,
      w.observed_on,
      w.temp_mean_c,
      w.precipitation_mm,
      r.fungal_risk,
      r.waterlogging_risk,
      r.heat_risk,
      r.global_risk_level,
      rec.title AS recommendation_title,
      rec.message AS recommendation_message
    FROM flowerxi_regions reg
    JOIN flowerxi_weather_daily w
      ON w.region_slug = reg.slug
    LEFT JOIN flowerxi_risk_signals r
      ON r.region_slug = w.region_slug AND r.observed_on = w.observed_on
    LEFT JOIN flowerxi_recommendations rec
      ON rec.region_slug = w.region_slug AND rec.observed_on = w.observed_on
    WHERE reg.slug = %s
    ORDER BY w.observed_on DESC
    LIMIT 1;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (region,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"No data for region '{region}'")

    return {"ok": True, "region": region, "snapshot": row}


@app.get("/api/history")
def history(region: str = Query(DEFAULT_REGION), limit: int = Query(30, ge=1, le=120)):
    sql = """
    SELECT observed_on, temp_mean_c, precipitation_mm
    FROM flowerxi_weather_daily w
    WHERE region_slug = %s
    ORDER BY w.observed_on DESC
    LIMIT %s;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (region, limit))
            rows = cur.fetchall()

    return {"ok": True, "region": region, "items": rows}
