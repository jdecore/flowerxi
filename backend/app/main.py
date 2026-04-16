from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_conn

app = FastAPI(title=settings.app_name)

allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
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


@app.get("/api/dashboard")
def dashboard(region: str = Query("sabana-bogota")):
    sql = """
    SELECT
      w.observed_on,
      w.temp_mean_c,
      w.precipitation_mm,
      r.fungal_risk,
      r.waterlogging_risk,
      r.heat_risk,
      r.global_risk_level,
      rec.title AS recommendation_title,
      rec.message AS recommendation_message
    FROM flowerxi_weather_daily w
    LEFT JOIN flowerxi_risk_signals r
      ON r.region_slug = w.region_slug AND r.observed_on = w.observed_on
    LEFT JOIN flowerxi_recommendations rec
      ON rec.region_slug = w.region_slug AND rec.observed_on = w.observed_on
    WHERE w.region_slug = %s
    ORDER BY w.observed_on DESC
    LIMIT 1;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (region,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No data for selected region")

    return {"ok": True, "region": region, "snapshot": row}


@app.get("/api/history")
def history(region: str = Query("sabana-bogota"), limit: int = Query(30, ge=1, le=120)):
    sql = """
    SELECT observed_on, temp_mean_c, precipitation_mm
    FROM flowerxi_weather_daily
    WHERE region_slug = %s
    ORDER BY observed_on DESC
    LIMIT %s;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (region, limit))
            rows = cur.fetchall()

    return {"ok": True, "region": region, "items": rows}
