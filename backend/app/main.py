import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
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
    handle_db_error,
    load_market_prices,
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
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["municipalities"])
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
                "city": row["city"],
                "area_pct": round((area / total_area * 100.0), 1)
                if total_area > 0
                else 0,
                "workers_pct": round((workers / total_workers * 100.0), 1)
                if total_workers > 0
                else 0,
                "area_ha": area,
                "greenhouse_area_ha": to_float(row.get("greenhouse_area_ha"), 0.0),
                "workers": workers,
                "fitosanitary": row.get("fisanicitary_context"),
                "waste": row.get("waste_management"),
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

    if not row:
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

    status_raw = row.get("status") or "rutina"
    score_raw = row.get("risk_score") or 22
    reason_raw = row.get("reason") or "Condiciones normales"
    action_raw = row.get("action_today") or "Mantén rutina habitual"
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
        "status_label": status_labels.get(status_raw, "Rutina normal"),
        "score": score_raw,
        "reason": reason_raw,
        "action_today": action_raw,
        "trend_7d": trend_raw,
        "confidence": confidence_raw,
        "attention": row.get("attention"),
        "details": {
            "rainy_days": row.get("rainy_days"),
            "days_with_precip": row.get("days_with_precip"),
            "avg_temp": round(row.get("avg_temp") or 0, 1),
            "avg_precip": round(row.get("avg_precip") or 0, 1),
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


@app.get("/api/dashboard/full")
def dashboard_full(region: str = Query(DEFAULT_REGION)):
    """
    Endpoint unificado que devuelve:
    - regions: lista de municipios
    - snapshot: datos del día actual
    - operativo: estado operativo con acción
    - history: últimos 14 días
    Todo en una sola respuesta para reducir requests.
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["regions"])
            regions = cur.fetchall()

            cur.execute(SQL_QUERIES["dashboard_snapshot"], (region,))
            snapshot = cur.fetchone()

            cur.execute(SQL_QUERIES["weather_history"], (region, 14))
            history_rows = cur.fetchall()

            operativo = None
            if snapshot:
                try:
                    cur.execute(SQL_QUERIES["risk_operativo"], (region,))
                    row = cur.fetchone()
                    if row:
                        operativo = {
                            "ok": True,
                            "region": region,
                            "status": row.get("status") or "rutina",
                            "status_label": {
                                "rutina": "Rutina normal",
                                "vigilancia": "Vigilancia reforzada",
                                "accion": "Acción requerida",
                            }.get(row.get("status"), "Rutina normal"),
                            "score": row.get("risk_score") or 22,
                            "reason": row.get("reason") or "Condiciones normales",
                            "action_today": row.get("action_today")
                            or "Mantén rutina habitual",
                            "trend_7d": row.get("trend_7d") or "stable",
                            "confidence": row.get("confidence") or "media",
                        }
                except Exception as e:
                    logger.error(f"Error calculating operativo for {region}: {e}")
                    operativo = None

        if not operativo:
            fungal = to_float(snapshot.get("fungal_risk"), 0.0) if snapshot else 0
            precip = to_float(snapshot.get("precipitation_mm"), 0.0)
            score = max(
                22,
                min(
                    85,
                    int(fungal * 0.6 + (precip > 4 and precip > 0 and 30 or 0) * 0.4),
                ),
            )
            operativo = {
                "ok": True,
                "region": region,
                "status": "rutina"
                if score <= 30
                else "vigilancia"
                if score <= 60
                else "accion",
                "status_label": "Rutina normal"
                if score <= 30
                else "Vigilancia reforzada"
                if score <= 60
                else "Acción requerida",
                "score": score,
                "reason": "Estado calculado desde datos disponibles",
                "action_today": "Mantén rutina de monitoreo",
                "trend_7d": "stable",
                "confidence": "baja",
            }

    history = list(reversed(history_rows)) if history_rows else []

    return {
        "ok": True,
        "region": region,
        "regions": regions,
        "snapshot": snapshot,
        "operativo": operativo,
        "history": history,
    }


@app.get("/api/history")
def history(region: str = Query(DEFAULT_REGION), limit: int = Query(30, ge=1, le=120)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["weather_history"], (region, limit))
            rows = cur.fetchall()
    return {"ok": True, "region": region, "items": rows}


@app.get("/api/alerts/today")
def alerts_today(region: str = Query(DEFAULT_REGION)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["dashboard_snapshot"], (region,))
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
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["recommendations_week"], (region, days))
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

    items: list[dict[str, any]] = []
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
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["stations"])
            rows = cur.fetchall()
    return {"ok": True, "items": rows, "total": len(rows)}


@app.get("/api/calendar")
def calendar(year: int = Query(2026)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["calendar"], (year,))
            rows = cur.fetchall()
    return {"ok": True, "year": year, "items": rows, "total": len(rows)}


@app.get("/api/model/version")
def model_version():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["model_version"])
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
def alerts_history(
    region: str = Query(DEFAULT_REGION), limit: int = Query(30, ge=1, le=90)
):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SQL_QUERIES["alerts_history"], (region, limit))
            rows = cur.fetchall()
    return {"ok": True, "region": region, "items": rows, "total": len(rows)}
