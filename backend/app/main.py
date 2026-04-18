import json
from pathlib import Path
from statistics import mean, pstdev
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_conn

app = FastAPI(title=settings.app_name)
DEFAULT_REGION = "madrid"
MARKET_PRICES_PATH = (
    Path(__file__).resolve().parents[2] / "frontend" / "public" / "market_prices.json"
)


def normalize_origin(origin: str) -> str:
    clean = origin.strip().strip('"').strip("'")
    return clean.rstrip("/")


def clamp(value: float, min_value: float = 0.0, max_value: float = 100.0) -> float:
    return max(min_value, min(max_value, value))


def risk_level_from_score(score: float) -> str:
    if score >= 70:
        return "alto"
    if score >= 40:
        return "medio"
    return "bajo"


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def build_agroclimatic_score(
    fungal_risk: float,
    waterlogging_risk: float,
    heat_risk: float,
    rainy_days_ratio: float,
) -> float:
    score = (
        fungal_risk * 0.35
        + waterlogging_risk * 0.30
        + (100.0 - heat_risk) * 0.15
        + rainy_days_ratio * 0.20
    )
    return round(clamp(score), 1)


def load_market_prices() -> dict[str, Any]:
    default_payload = {
        "scraped_at": None,
        "generated_at": None,
        "sources": [],
        "data": [],
        "stale": False,
    }
    try:
        raw = MARKET_PRICES_PATH.read_text(encoding="utf-8")
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            return default_payload
        payload.setdefault("sources", [])
        payload.setdefault("data", [])
        payload.setdefault("stale", False)
        payload.setdefault("scraped_at", None)
        payload.setdefault("generated_at", None)
        return payload
    except (OSError, json.JSONDecodeError):
        return default_payload


def build_commercial_metrics() -> dict[str, Any]:
    payload = load_market_prices()
    prices = [
        to_float(item.get("price_cop"), 0.0)
        for item in payload.get("data", [])
        if to_float(item.get("price_cop"), 0.0) > 0
    ]

    if not prices:
        return {
            "status": "sin_datos",
            "average_price_cop": None,
            "volatility_pct": None,
            "concentration_pct": None,
            "commercial_risk_score": None,
            "sources": payload.get("sources", []),
            "last_update": payload.get("scraped_at") or payload.get("generated_at"),
            "stale": bool(payload.get("stale")),
        }

    total_price = sum(prices)
    avg_price = mean(prices)
    volatility_pct = (
        (pstdev(prices) / avg_price * 100.0)
        if len(prices) > 1 and avg_price > 0
        else 0.0
    )
    concentration_pct = (max(prices) / total_price * 100.0) if total_price > 0 else 0.0
    commercial_risk_score = clamp((volatility_pct * 1.15) + (concentration_pct * 0.55))

    return {
        "status": "ok",
        "average_price_cop": round(avg_price, 0),
        "volatility_pct": round(volatility_pct, 1),
        "concentration_pct": round(concentration_pct, 1),
        "commercial_risk_score": round(commercial_risk_score, 1),
        "sources": payload.get("sources", []),
        "last_update": payload.get("scraped_at") or payload.get("generated_at"),
        "stale": bool(payload.get("stale")),
    }


def build_risk_narrative(
    region_name: str, latest: dict[str, Any], commercial: dict[str, Any]
) -> str:
    drivers: list[str] = []
    rainy_days = int(latest.get("rainy_days", 0))
    temp_anomaly = to_float(latest.get("temp_anomaly_c"), 0.0)
    precip_anomaly = to_float(latest.get("precip_anomaly_pct"), 0.0)
    agro_score = to_float(latest.get("agroclimatic_score"), 0.0)

    if rainy_days >= 12:
        drivers.append("subieron los dias con lluvia")
    if precip_anomaly >= 20:
        drivers.append("la precipitacion mensual estuvo por encima del baseline")
    if temp_anomaly <= -1.5:
        drivers.append("la temperatura media estuvo por debajo del promedio")
    elif temp_anomaly >= 1.5:
        drivers.append("hubo mayor estres termico respecto al promedio")

    if (
        commercial.get("commercial_risk_score") is not None
        and to_float(commercial["commercial_risk_score"]) >= 55
    ):
        drivers.append("aparecio presion comercial por volatilidad de precios")

    if not drivers:
        drivers.append("el comportamiento agroclimatico se mantuvo estable")

    driver_text = (
        ", ".join(drivers[:-1]) + f" y {drivers[-1]}"
        if len(drivers) > 1
        else drivers[0]
    )
    return (
        f"En {region_name}, el indice operativo-comercial de {latest.get('month_label', 'este periodo')} "
        f"quedo en {round(to_float(latest.get('combined_score'), agro_score), 1)} puntos: {driver_text}. "
        "Se recomienda mantener vigilancia fitosanitaria y ajustar protocolos segun alerta."
    )


def fetch_monthly_risk_rows(
    region: str, months: int
) -> tuple[str, list[dict[str, Any]]]:
    sql = """
    WITH region_base AS (
      SELECT
        AVG(w.temp_mean_c) AS baseline_temp_c,
        AVG(w.precipitation_mm) AS baseline_precip_mm
      FROM flowerxi_weather_daily w
      WHERE w.region_slug = %s
    ),
    monthly AS (
      SELECT
        DATE_TRUNC('month', w.observed_on)::date AS month_start,
        TO_CHAR(DATE_TRUNC('month', w.observed_on), 'TMMonth YYYY') AS month_label,
        AVG(w.temp_mean_c) AS avg_temp_c,
        AVG(w.precipitation_mm) AS avg_precip_mm,
        SUM(CASE WHEN w.precipitation_mm >= 0.5 THEN 1 ELSE 0 END)::int AS rainy_days,
        AVG(r.fungal_risk) AS avg_fungal_risk,
        AVG(r.waterlogging_risk) AS avg_waterlogging_risk,
        AVG(r.heat_risk) AS avg_heat_risk,
        COUNT(*)::int AS sample_days
      FROM flowerxi_weather_daily w
      LEFT JOIN flowerxi_risk_signals r
        ON r.region_slug = w.region_slug AND r.observed_on = w.observed_on
      WHERE w.region_slug = %s
      GROUP BY 1, 2
      ORDER BY month_start DESC
      LIMIT %s
    )
    SELECT
      reg.name AS region_name,
      m.month_start,
      BTRIM(m.month_label) AS month_label,
      m.avg_temp_c,
      m.avg_precip_mm,
      m.rainy_days,
      m.avg_fungal_risk,
      m.avg_waterlogging_risk,
      m.avg_heat_risk,
      m.sample_days,
      rb.baseline_temp_c,
      rb.baseline_precip_mm
    FROM monthly m
    CROSS JOIN region_base rb
    JOIN flowerxi_regions reg ON reg.slug = %s
    ORDER BY m.month_start DESC;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (region, region, months, region))
            rows = cur.fetchall()

    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No monthly data for region '{region}'"
        )

    region_name = rows[0]["region_name"]
    return region_name, rows


allowed_origins: list[str] = []
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
    SELECT slug, name, city, crop_focus, department, production_share
    FROM flowerxi_regions
    ORDER BY production_share DESC NULLS LAST, name ASC;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    return {"ok": True, "default_region": DEFAULT_REGION, "items": rows}


@app.get("/api/municipalities")
def municipalities():
    """Lista perfiles municipales con contexto territorial."""
    sql = """
    SELECT 
      r.slug,
      r.name,
      r.city,
      r.department,
      r.crop_focus,
      r.production_share,
      r.latitude,
      r.longitude,
      mp.year,
      mp.flower_area_ha,
      mp.greenhouse_area_ha,
      mp.workers,
      mp.workers_female,
      mp.workers_male,
      mp.fisanicitary_context,
      mp.waste_management,
      mp.main_varieties
    FROM flowerxi_regions r
    LEFT JOIN flowerxi_municipality_profile mp ON mp.region_slug = r.slug
    WHERE r.department = 'CUNDINAMARCA'
    ORDER BY r.production_share DESC NULLS LAST;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    return {"ok": True, "items": rows, "total": len(rows)}


@app.get("/api/municipalities/{slug}")
def municipality_detail(slug: str):
    """Detalle de un municipio con perfil."""
    sql = """
    SELECT 
      r.slug,
      r.name,
      r.city,
      r.department,
      r.crop_focus,
      r.production_share,
      r.latitude,
      r.longitude,
      mp.year,
      mp.flower_area_ha,
      mp.greenhouse_area_ha,
      mp.workers,
      mp.workers_female,
      mp.workers_male,
      mp.fisanicitary_context,
      mp.waste_management,
      mp.main_varieties,
      mp.source AS profile_source
    FROM flowerxi_regions r
    LEFT JOIN flowerxi_municipality_profile mp ON mp.region_slug = r.slug
    WHERE r.slug = %s;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (slug,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Municipio '{slug}' no encontrado")

    return {"ok": True, "item": row}


@app.get("/api/municipalities/compare")
def municipalities_compare():
    """Comparativo entre todos los municipios."""
    sql = """
    SELECT 
      r.slug,
      r.name,
      r.city,
      r.production_share,
      mp.flower_area_ha,
      mp.greenhouse_area_ha,
      mp.workers,
      mp.fisanicitary_context,
      mp.waste_management
    FROM flowerxi_regions r
    LEFT JOIN flowerxi_municipality_profile mp ON mp.region_slug = r.slug
    WHERE r.department = 'CUNDINAMARCA'
    ORDER BY r.production_share DESC NULLS LAST;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    total_area = sum(to_float(r.get("flower_area_ha"), 0.0) for r in rows)
    total_workers = sum(int(r.get("workers") or 0) for r in rows)

    comparatives = []
    for row in rows:
        area = to_float(row.get("flower_area_ha"), 0.0)
        workers = int(row.get("workers") or 0)
        comparatives.append({
            "slug": row["slug"],
            "name": row["name"],
            "city": row["city"],
            "area_pct": round((area / total_area * 100.0), 1) if total_area > 0 else 0,
            "workers_pct": round((workers / total_workers * 100.0), 1) if total_workers > 0 else 0,
            "area_ha": area,
            "greenhouse_area_ha": to_float(row.get("greenhouse_area_ha"), 0.0),
            "workers": workers,
            "fitosanitary": row.get("fisanicitary_context"),
            "waste": row.get("waste_management"),
        })

    return {"ok": True, "items": comparatives, "totals": {"area_ha": total_area, "workers": total_workers}}


@app.get("/api/exports")
def exports(months: int = Query(12, ge=3, le=36)):
    """Datos de exportaciones mensuales (DANE proxy)."""
    sql = """
    SELECT 
      year_month,
      subpartida,
      country_dest,
      fob_usd,
      net_tons,
      unit_value,
      source
    FROM flowerxi_exports_monthly
    ORDER BY year_month DESC, fob_usd DESC
    LIMIT %s;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (months * 10,))
            rows = cur.fetchall()

    if not rows:
        return {"ok": True, "items": [], "summary": None}

    month_data: dict[str, dict] = {}
    for row in rows:
        month = row["year_month"]
        if month not in month_data:
            month_data[month] = {"fob_usd": 0.0, "net_tons": 0.0}
        month_data[month]["fob_usd"] += to_float(row.get("fob_usd"), 0.0)
        month_data[month]["net_tons"] += to_float(row.get("net_tons"), 0.0)

    total_fob = sum(m["fob_usd"] for m in month_data.values())
    total_net = sum(m["net_tons"] for m in month_data.values())
    avg_price = (total_fob / total_net) if total_net > 0 else 0

    summary = {
        "total_fob_usd": round(total_fob, 2),
        "total_net_tons": round(total_net, 2),
        "avg_price_per_kg": round(avg_price, 4),
        "months_count": len(month_data),
    }

    return {"ok": True, "items": rows, "summary": summary, "by_month": month_data}


@app.get("/api/risk/explain")
def risk_explain(region: str = Query(DEFAULT_REGION)):
    """Explica por qué subió o bajó el riesgo."""
    sql = """
    WITH last_7 AS (
      SELECT 
        observed_on,
        precipitation_mm,
        temp_mean_c,
        LAG(precipitation_mm) OVER (ORDER BY observed_on DESC) AS prev_precip,
        LAG(temp_mean_c) OVER (ORDER BY observed_on DESC) AS prev_temp
      FROM flowerxi_weather_daily
      WHERE region_slug = %s
      ORDER BY observed_on DESC
      LIMIT 7
    ),
    summary AS (
      SELECT 
        AVG(precipitation_mm) AS avg_precip,
        AVG(temp_mean_c) AS avg_temp,
        SUM(CASE WHEN precipitation_mm >= 4 THEN 1 ELSE 0 END)::int AS rainy_days,
        AVG(prev_precip) AS prev_avg_precip
      FROM last_7
    )
    SELECT 
      s.avg_precip,
      s.avg_temp,
      s.rainy_days,
      s.prev_avg_precip,
      s.avg_precip - s.prev_avg_precip AS precip_change,
      CASE 
        WHEN s.rainy_days >= 4 THEN 'Alta precipitación acumulada (≥4 días con lluvia)'
        WHEN s.avg_precip > (s.prev_avg_precip * 1.3) THEN 'Aumento significativo de precipitación vs semana anterior'
        WHEN s.avg_temp <= 12 THEN 'Temperaturas bajas favorecen humedad relativa alta'
        WHEN s.avg_temp >= 22 THEN 'Temperaturas elevadas aumentan estrés hídrico'
        ELSE 'Condiciones dentro de rangos normales'
      END AS primary_driver,
      CASE 
        WHEN s.rainy_days >= 4 THEN 'Revisar drenajes, aplicar fungicida preventivo, intensificar monitoreo fitosanitario'
        WHEN s.avg_precip > (s.prev_avg_precip * 1.3) THEN 'Verificar acumulaciones de agua, mejorar ventilación'
        WHEN s.avg_temp <= 12 THEN 'Controlar humedad, evitar condensación en invernadero'
        WHEN s.avg_temp >= 22 THEN 'Aumentar riego por goteo, sombra temporal si aplica'
        ELSE 'Mantener protocolo habitual de vigilancia'
      END AS recommendation
    FROM summary s;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (region,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"No hay datos para explicar riesgo en '{region}'")

    return {
        "ok": True,
        "region": region,
        "analysis": {
            "period": "últimos 7 días",
            "avg_precip_mm": round(to_float(row.get("avg_precip")), 1),
            "avg_temp_c": round(to_float(row.get("avg_temp")), 1),
            "rainy_days": row.get("rainy_days"),
            "precip_change_mm": round(to_float(row.get("precip_change")), 1),
            "primary_driver": row.get("primary_driver"),
            "recommendation": row.get("recommendation"),
        },
    }


@app.get("/api/municipios")
def municipios():
    """Lista los 10 municipios floricultores con perfil."""
    sql = """
    SELECT 
      r.slug,
      r.name,
      r.city,
      r.crop_focus,
      r.department,
      r.production_share,
      r.latitude,
      r.longitude,
      mp.area_ha,
      mp.greenhouse_ha,
      mp.workers,
      mp.crop_types
    FROM flowerxi_regions r
    LEFT JOIN flowerxi_municipality_profile mp ON mp.region_slug = r.slug
    WHERE r.department = 'CUNDINAMARCA'
    ORDER BY r.production_share DESC NULLS LAST;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    return {"ok": True, "items": rows, "total": len(rows)}


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


@app.get("/api/alerts/today")
def alerts_today(region: str = Query(DEFAULT_REGION)):
    sql = """
    SELECT
      reg.name AS region_name,
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
        raise HTTPException(
            status_code=404, detail=f"No alert data for region '{region}'"
        )

    fungal = to_float(row.get("fungal_risk"), 0.0)
    water = to_float(row.get("waterlogging_risk"), 0.0)
    heat = to_float(row.get("heat_risk"), 0.0)
    rainy_ratio = 100.0 if to_float(row.get("precipitation_mm"), 0.0) >= 4.0 else 30.0
    score = build_agroclimatic_score(fungal, water, heat, rainy_ratio)
    level = risk_level_from_score(score)

    message = (
        "Prioriza ventilacion y monitoreo fungico."
        if level == "alto"
        else "Mantener seguimiento diario de humedad y drenaje."
        if level == "medio"
        else "Condicion estable, mantener protocolo habitual."
    )

    return {
        "ok": True,
        "region": region,
        "alert": {
            "observed_on": row["observed_on"],
            "region_name": row["region_name"],
            "risk_level": level,
            "agroclimatic_score": score,
            "fungal_risk": row["fungal_risk"],
            "waterlogging_risk": row["waterlogging_risk"],
            "heat_risk": row["heat_risk"],
            "recommendation_title": row.get("recommendation_title"),
            "recommendation_message": row.get("recommendation_message"),
            "message": message,
        },
    }


@app.get("/api/recommendations/week")
def recommendations_week(
    region: str = Query(DEFAULT_REGION), days: int = Query(7, ge=3, le=14)
):
    sql = """
    SELECT
      rec.observed_on,
      rec.title,
      rec.message,
      r.global_risk_level,
      r.fungal_risk,
      r.waterlogging_risk,
      r.heat_risk
    FROM flowerxi_recommendations rec
    LEFT JOIN flowerxi_risk_signals r
      ON r.region_slug = rec.region_slug AND r.observed_on = rec.observed_on
    WHERE rec.region_slug = %s
    ORDER BY rec.observed_on DESC
    LIMIT %s;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (region, days))
            rows = cur.fetchall()

    if not rows:
        raise HTTPException(
            status_code=404, detail=f"No recommendations for region '{region}'"
        )

    level_counts = {"alto": 0, "medio": 0, "bajo": 0}
    for item in rows:
        level = str(item.get("global_risk_level") or "bajo").lower().strip()
        if level in level_counts:
            level_counts[level] += 1

    return {
        "ok": True,
        "region": region,
        "days": days,
        "risk_distribution": level_counts,
        "items": rows,
    }


@app.get("/api/risk/monthly")
def risk_monthly(
    region: str = Query(DEFAULT_REGION), months: int = Query(6, ge=3, le=24)
):
    region_name, rows = fetch_monthly_risk_rows(region, months)
    commercial = build_commercial_metrics()
    commercial_score = commercial.get("commercial_risk_score")

    items: list[dict[str, Any]] = []
    for row in rows:
        sample_days = max(int(row.get("sample_days", 0)), 1)
        rainy_days = int(row.get("rainy_days", 0))
        rainy_ratio = clamp((rainy_days / sample_days) * 100.0)
        fungal = to_float(row.get("avg_fungal_risk"), 0.0)
        water = to_float(row.get("avg_waterlogging_risk"), 0.0)
        heat = to_float(row.get("avg_heat_risk"), 0.0)
        agro_score = build_agroclimatic_score(fungal, water, heat, rainy_ratio)
        if commercial_score is None:
            combined = agro_score
        else:
            combined = round((agro_score * 0.8) + (to_float(commercial_score) * 0.2), 1)

        baseline_temp = row.get("baseline_temp_c")
        baseline_precip = row.get("baseline_precip_mm")
        avg_temp = to_float(row.get("avg_temp_c"), 0.0)
        avg_precip = to_float(row.get("avg_precip_mm"), 0.0)
        temp_anomaly = (
            avg_temp - to_float(baseline_temp, avg_temp)
            if baseline_temp is not None
            else 0.0
        )
        precip_anomaly_pct = 0.0
        if baseline_precip is not None and to_float(baseline_precip) > 0:
            precip_anomaly_pct = (
                (avg_precip - to_float(baseline_precip)) / to_float(baseline_precip)
            ) * 100.0

        item = {
            "month_start": row["month_start"],
            "month_label": row["month_label"],
            "avg_temp_c": round(avg_temp, 2),
            "avg_precip_mm": round(avg_precip, 2),
            "rainy_days": rainy_days,
            "sample_days": sample_days,
            "temp_anomaly_c": round(temp_anomaly, 2),
            "precip_anomaly_pct": round(precip_anomaly_pct, 1),
            "agroclimatic_score": agro_score,
            "combined_score": combined,
            "risk_level": risk_level_from_score(combined),
            "avg_fungal_risk": round(fungal, 1),
            "avg_waterlogging_risk": round(water, 1),
            "avg_heat_risk": round(heat, 1),
        }
        items.append(item)

    latest = items[0]
    narrative = build_risk_narrative(region_name, latest, commercial)

    return {
        "ok": True,
        "region": region,
        "region_name": region_name,
        "months": months,
        "latest": latest,
        "items": items,
        "commercial": commercial,
        "kpis": {
            "fob_value_monthly": None,
            "net_kg_monthly": None,
            "implicit_price_per_kg": None,
            "climate_risk_score": latest["agroclimatic_score"],
            "operational_commercial_score": latest["combined_score"],
        },
        "narrative": narrative,
        "model_context": {
            "name": "flowerxi-agroclimatic-proxy-v1",
            "scope": "vigilancia y priorizacion de riesgo",
            "note": "No corresponde a diagnostico real de plagas por finca.",
        },
    }


@app.get("/api/stations")
def stations(region: str = Query(DEFAULT_REGION)):
    """Lista estaciones meteorologicas."""
    sql = """
    SELECT station_code, station_name, region_slug, elevation_m, 
           latitude, longitude, distance_km, data_quality, source
    FROM flowerxi_weather_stations
    ORDER BY distance_km ASC;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    return {"ok": True, "items": rows, "total": len(rows)}


@app.get("/api/calendar")
def calendar(year: int = Query(2026)):
    """Lista feriados y dias inhábiles."""
    sql = """
    SELECT event_date, event_name, local_name, country_code
    FROM flowerxi_market_calendar
    WHERE EXTRACT(YEAR FROM event_date) = %s
    ORDER BY event_date ASC;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (year,))
            rows = cur.fetchall()

    return {"ok": True, "year": year, "items": rows, "total": len(rows)}


@app.get("/api/model/version")
def model_version():
    """ get current risk model version"""
    sql = """
    SELECT version, formula_description, weights, author, created_at, is_active, notes
    FROM flowerxi_risk_model_versions
    WHERE is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            row = cur.fetchone()

    if not row:
        return {"ok": True, "version": "v1.0", "formula": "default", "weights": {}}

    return {
        "ok": True,
        "version": row["version"],
        "formula": row["formula_description"],
        "weights": row["weights"],
        "author": row["author"],
        "created_at": row["created_at"],
        "notes": row["notes"],
    }


@app.get("/api/alerts/history")
def alerts_history(region: str = Query(DEFAULT_REGION), limit: int = Query(30, ge=1, le=90)):
    """ get alert history"""
    sql = """
    SELECT observed_on, alert_level, alert_score, message, protocol_applied, compliance_status
    FROM flowerxi_alert_history
    WHERE region_slug = %s
    ORDER BY observed_on DESC
    LIMIT %s;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (region, limit))
            rows = cur.fetchall()

    return {"ok": True, "region": region, "items": rows, "total": len(rows)}
