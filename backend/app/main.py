import logging
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_conn
from .queries import SQL_QUERIES
from .utils import (
    DEFAULT_REGION,
    build_agroclimatic_score,
    build_commercial_metrics,
    build_risk_narrative,
    fetch_monthly_risk_rows,
    normalize_origin,
    risk_level_from_score,
    to_float,
)

# Logging config
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("flowerxi-backend")

app = FastAPI(title=settings.app_name)

# Log de arranque
logger.info(f"Iniciando {settings.app_name} en {settings.app_env}")
logger.info(f"Puerto configurado: {settings.app_port}")
if not settings.database_configured:
    logger.warning(
        "DATABASE_URL no configurada. Endpoints DB fallarán hasta configurar."
    )

# CORS
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
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["regions"])
            rows = cur.fetchall()
    return {"ok": True, "default_region": DEFAULT_REGION, "items": rows}


@app.get("/api/municipalities")
def municipalities():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["municipalities"])
            rows = cur.fetchall()
    return {"ok": True, "items": rows, "total": len(rows)}


@app.get("/api/municipalities/{slug}")
def municipality_detail(slug: str):
    sql = """
    SELECT 
      r.slug,
      r.name,
      mp.flower_area_ha,
      mp.workers
    FROM flowerxi_regions r
    LEFT JOIN LATERAL (
      SELECT flower_area_ha, workers
      FROM flowerxi_municipality_profile
      WHERE region_slug = r.slug
      ORDER BY year DESC NULLS LAST
      LIMIT 1
    ) mp ON TRUE
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
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["regions_compare"])
            rows = cur.fetchall()

    total_area = sum(to_float(r.get("flower_area_ha"), 0.0) for r in rows)
    total_workers = sum(int(r.get("workers") or 0) for r in rows)

    comparatives = []
    for row in rows:
        area = to_float(row.get("flower_area_ha"), 0.0)
        workers = int(row.get("workers") or 0)
        comparatives.append(
            {
                "slug": row["slug"],
                "name": row["name"],
                "city": row.get("city"),
                "production_share": to_float(row.get("production_share"), 0.0),
                "area_ha": area,
                "workers": workers,
                "fungal_risk": to_float(row.get("fungal_risk"), 0.0),
                "waterlogging_risk": to_float(row.get("waterlogging_risk"), 0.0),
                "heat_risk": to_float(row.get("heat_risk"), 0.0),
                "risk_score": (
                    int(row["risk_score"]) if row.get("risk_score") is not None else None
                ),
            }
        )

    return {
        "ok": True,
        "items": comparatives,
        "totals": {"area_ha": total_area, "workers": total_workers},
    }


@app.get("/api/exports")
def exports(months: int = Query(12, ge=3, le=36)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["exports"], (months * 10,))
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
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["risk_explain"], (region,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(
            status_code=404, detail=f"No hay datos para explicar riesgo en '{region}'"
        )

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


@app.get("/api/risk/operativo")
def risk_operativo(region: str = Query(DEFAULT_REGION)):
    """
    Retorna estado operativo con acción clara para el dashboard.

    Estados:
    - rutina (0-30): Seguir rutina normal
    - vigilancia (31-60): Revisar punto crítico hoy
    - accion (61-100): Actuar hoy e inspeccionar
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["risk_operativo"], (region,))
            row = cur.fetchone()

    days_available = int(row.get("days_available") or 0) if row else 0
    if not row or days_available <= 0:
        return {
            "ok": True,
            "region": region,
            "status": "sin_datos",
            "status_label": "Sin datos disponibles",
            "score": None,
            "reason": "No hay datos climáticos suficientes para calcular el estado operativo.",
            "action_today": "Consulta más tarde cuando haya datos disponibles.",
            "trend_7d": None,
            "confidence": "baja",
            "attention": None,
        }

    status_raw = row.get("status") or "sin_datos"
    score_raw = row.get("risk_score")
    reason_raw = row.get("reason") or "Datos no disponibles."
    action_raw = row.get("action_today") or "Datos no disponibles."
    trend_raw = row.get("trend_7d") or "stable"
    confidence_raw = row.get("confidence") or "media"

    status_labels = {
        "rutina": "Rutina normal",
        "vigilancia": "Vigilancia reforzada",
        "accion": "Acción requerida",
        "sin_datos": "Sin datos",
    }

    return {
        "ok": True,
        "region": region,
        "status": status_raw,
        "status_label": status_labels.get(status_raw, "Sin datos"),
        "score": score_raw,
        "reason": reason_raw,
        "action_today": action_raw,
        "trend_7d": trend_raw,
        "confidence": confidence_raw,
        "attention": row.get("attention"),
        "details": {
            "rainy_days": row.get("rainy_days"),
            "days_with_precip": row.get("days_with_precip"),
            "avg_temp": (
                round(to_float(row.get("avg_temp")), 1)
                if row.get("avg_temp") is not None
                else None
            ),
            "avg_precip": (
                round(to_float(row.get("avg_precip")), 1)
                if row.get("avg_precip") is not None
                else None
            ),
            "days_available": row.get("days_available"),
        },
    }


@app.get("/api/dashboard")
def dashboard(region: str = Query(DEFAULT_REGION)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["dashboard_snapshot"], (region,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"No data for region '{region}'")

    return {"ok": True, "region": region, "snapshot": row}


@app.get("/api/history")
def history(region: str = Query(DEFAULT_REGION), limit: int = Query(30, ge=1, le=120)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["weather_history"], (region, limit))
            rows = cur.fetchall()
    return {"ok": True, "region": region, "items": rows}


@app.post("/api/alerts/simulate")
def alerts_simulate(payload: dict[str, Any] = Body(default={})):
    region = str(payload.get("region") or DEFAULT_REGION).strip().lower() or DEFAULT_REGION

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["dashboard_snapshot"], (region,))
            snapshot = cur.fetchone()
            cur.execute(SQL_QUERIES["risk_operativo"], (region,))
            operativo = cur.fetchone()

    if not snapshot:
        return {
            "ok": True,
            "region": region,
            "alert": "Datos no disponibles",
            "action": "No hay datos suficientes para simular una alerta.",
            "confidence": 0.3,
            "score_today": None,
            "score_tomorrow": None,
            "delta": None,
        }

    score_today_raw = (operativo or {}).get("risk_score")
    if score_today_raw is None:
        fungal_today = to_float(snapshot.get("fungal_risk"), 0.0)
        water_today = to_float(snapshot.get("waterlogging_risk"), 0.0)
        heat_today = to_float(snapshot.get("heat_risk"), 0.0)
        score_today = int(round((fungal_today * 0.5) + (water_today * 0.3) + (heat_today * 0.2)))
    else:
        score_today = int(score_today_raw)
    temp = to_float(snapshot.get("temp_mean_c"), 0.0)
    precip = to_float(snapshot.get("precipitation_mm"), 0.0)
    trend = (operativo or {}).get("trend_7d") or "stable"

    tomorrow_score = float(score_today)
    if precip >= 4:
        tomorrow_score += 14
    elif precip > 0:
        tomorrow_score += 8

    if 15 <= temp <= 22 and precip > 0:
        tomorrow_score += 10
    elif temp < 12:
        tomorrow_score += 6
    elif temp > 26:
        tomorrow_score += 8

    if trend == "up":
        tomorrow_score += 6
    elif trend == "down":
        tomorrow_score -= 4

    tomorrow_score = max(12, min(95, int(round(tomorrow_score))))
    delta = tomorrow_score - score_today
    level = risk_level_from_score(tomorrow_score)

    action = (
        "Revisar drenaje hoy antes de las 10am y dejar registro fitosanitario."
        if level == "alto"
        else "Reforzar vigilancia de humedad y ventilación durante la mañana."
        if level == "medio"
        else "Mantener rutina normal y revisar nuevamente en 24h."
    )

    confidence_raw = (operativo or {}).get("confidence") or "media"
    confidence = 0.78 if confidence_raw == "alta" else 0.64 if confidence_raw == "media" else 0.52

    return {
        "ok": True,
        "region": region,
        "alert": f"Riesgo {level} mañana",
        "action": action,
        "confidence": round(confidence, 2),
        "score_today": score_today,
        "score_tomorrow": tomorrow_score,
        "delta": delta,
    }


@app.get("/api/recommendations/week")
def recommendations_week(
    region: str = Query(DEFAULT_REGION), days: int = Query(7, ge=3, le=14)
):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["recommendations_week"], (region, days))
            rows = cur.fetchall()

    if not rows:
        return {
            "ok": True,
            "region": region,
            "days": days,
            "risk_distribution": {"alto": 0, "medio": 0, "bajo": 0},
            "items": [],
        }

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
        rainy_ratio = max(0.0, min(100.0, (rainy_days / sample_days) * 100.0))
        fungal = to_float(row.get("avg_fungal_risk"), 0.0)
        water = to_float(row.get("avg_waterlogging_risk"), 0.0)
        heat = to_float(row.get("avg_heat_risk"), 0.0)
        agro_score = build_agroclimatic_score(fungal, water, heat, rainy_ratio)
        if commercial_score is None:
            combined = agro_score
        else:
            combined = round((agro_score * 0.8) + (to_float(commercial_score) * 0.2), 1)

        item = {
            "month_label": row["month_label"],
            "combined_score": combined,
            "risk_level": risk_level_from_score(combined),
            "sample_days": sample_days,
            "rainy_days": rainy_days,
            "rainy_ratio_pct": round(rainy_ratio, 1),
            "avg_fungal_risk": round(fungal, 1),
            "avg_waterlogging_risk": round(water, 1),
            "avg_heat_risk": round(heat, 1),
        }
        items.append(item)

    if not items:
        return {
            "ok": True,
            "region": region,
            "region_name": region_name,
            "months": months,
            "latest": None,
            "items": [],
            "commercial": commercial,
            "narrative": {"summary": "Datos no disponibles.", "details": ""},
            "model_context": {
                "name": "flowerxi-agroclimatic-proxy-v1",
                "scope": "vigilancia y priorizacion de riesgo",
                "note": "No corresponde a diagnostico real de plagas por finca.",
            },
        }

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
        "narrative": narrative,
        "model_context": {
            "name": "flowerxi-agroclimatic-proxy-v1",
            "scope": "vigilancia y priorizacion de riesgo",
            "note": "No corresponde a diagnostico real de plagas por finca.",
        },
    }


@app.get("/api/stations")
def stations(region: str = Query(DEFAULT_REGION)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["stations"], (region,))
            rows = cur.fetchall()
            fallback = False
            if not rows:
                cur.execute(SQL_QUERIES["stations_fallback"], (region,))
                rows = cur.fetchall()
                fallback = bool(rows)
    return {
        "ok": True,
        "region": region,
        "items": rows,
        "total": len(rows),
        "fallback": fallback,
    }
