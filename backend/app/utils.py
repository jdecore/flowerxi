import logging
from functools import wraps
from typing import Any, Callable

from fastapi import HTTPException, Query

logger = logging.getLogger(__name__)

DEFAULT_REGION = "madrid"


def clamp(value: float, min_value: float = 0.0, max_value: float = 100.0) -> float:
    return max(min_value, min(max_value, value))


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def normalize_origin(origin: str) -> str | None:
    """Normaliza una CORS origin: limpia espacios, asegura scheme, elimina trailing slash."""
    if not origin:
        return None
    origin = origin.strip()
    if not origin:
        return None
    # Si no tiene scheme, asumir https (para CORS)
    if not origin.startswith(("http://", "https://")):
        origin = "https://" + origin
    # Eliminar trailing slash
    return origin.rstrip("/")


def handle_db_error(func: Callable) -> Callable:
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"DB error in {func.__name__}: {e}")
            raise HTTPException(status_code=500, detail="Error de base de datos")

    return wrapper


def build_operativo_status(score: int) -> tuple[str, str, str]:
    if score <= 30:
        return (
            "rutina",
            "Rutina normal",
            "Mantén la rutina de monitoreo sin acciones extraordinarias.",
        )
    if score <= 60:
        return (
            "vigilancia",
            "Vigilancia reforzada",
            "Refuerza revisión de humedad, drenaje y ventilación durante el turno.",
        )
    return (
        "accion",
        "Acción requerida",
        "Ejecuta inspección en campo, registra hallazgos y aplica protocolo preventivo.",
    )


def calculate_risk_score(
    rainy_days: int,
    days_with_precip: int,
    avg_temp: float,
    avg_precip: float,
    prev_avg_precip: float | None,
) -> int:
    if (
        avg_precip
        and prev_avg_precip
        and avg_precip > prev_avg_precip
        and rainy_days >= 3
    ):
        return rainy_days * 15 + days_with_precip * 8
    if rainy_days >= 5:
        return 85
    if rainy_days >= 4:
        return 72
    if rainy_days >= 3 and 15 <= avg_temp <= 22:
        return 68
    if rainy_days >= 3 and avg_temp < 12:
        return 55
    if avg_temp > 28:
        return 78
    if avg_temp < 8:
        return 45
    if avg_temp <= 12 and rainy_days >= 2:
        return 52
    if avg_temp >= 22 and days_with_precip > 0:
        return 48
    return 22


def build_reason(
    rainy_days: int, avg_temp: float, avg_precip: float, prev_avg_precip: float | None
) -> str:
    if rainy_days >= 5:
        return "Acumulación crítica de lluvia (5+ días)"
    if rainy_days >= 3 and 15 <= avg_temp <= 22:
        return "Humedad + temperatura templada = riesgo fungal elevado"
    if rainy_days >= 3 and avg_temp < 12:
        return "Frío + humedad = estrés para las plantas"
    if rainy_days >= 3 and avg_temp >= 22:
        return "Lluvia + calor = condiciones favorables para hongos"
    if avg_precip and prev_avg_precip and avg_precip > prev_avg_precip * 3:
        return "Aumento crítico de precipitación (300%+)"
    if avg_temp > 28:
        return "Temperatura muy alta (>28°C) - estrés térmico"
    if avg_temp < 8:
        return "Temperatura muy baja (<8°C) - riesgo de frío"
    if avg_temp <= 12 and rainy_days >= 2:
        return "Temperatura baja + humedad = vigilancia por hongos"
    return "Condiciones dentro de rangos normales"


def build_action_today(
    rainy_days: int, avg_temp: float, avg_precip: float, prev_avg_precip: float | None
) -> str:
    if rainy_days >= 5:
        return "Aplicar fungicida inmediatamente + revisar sistema de drenaje. Registra inspección."
    if rainy_days >= 3 and 15 <= avg_temp <= 22:
        return "Inspección fitosanitaria prioritaria hoy. Aumenta ventilación 20 min extra."
    if rainy_days >= 3 and avg_temp < 12:
        return "Revisa calefacción o protección anticongelante. Controla condensación."
    if rainy_days >= 3 and avg_temp >= 22:
        return "Aumenta ventilación y revisa sombreado. Monitorea estrés hídrico."
    if avg_precip and prev_avg_precip and avg_precip > prev_avg_precip * 3:
        return "Revisa drenajes inmediatamente. Elimina acumulaciones de agua."
    if avg_temp > 28:
        return "Activa sombreado de emergencia. Aumenta riego por goteo."
    if avg_temp < 8:
        return "Activa protección anticongelante. Revisa estado de plantas sensibles."
    if avg_temp <= 12 and rainy_days >= 2:
        return "Aumenta ventilación para reducir condensación. Controla humedad."
    return "Mantén rutina habitual. Revisa humedad del suelo."


def get_confidence(days_available: int) -> str:
    if days_available >= 7:
        return "alta"
    if days_available >= 4:
        return "media"
    return "baja"


# ——— Nuevas funciones requeridas por main.py ———


def build_agroclimatic_score(
    fungal: float, water: float, heat: float, rainy_ratio: float
) -> float:
    """Score 0-100 combinando factores agroclimáticos."""
    fungal = clamp(fungal, 0, 100)
    water = clamp(water, 0, 100)
    heat = clamp(heat, 0, 100)
    rainy_ratio = clamp(rainy_ratio, 0, 100)
    # Pesos simples: fungal 40%, water 20%, heat 20%, rainy_ratio 20%
    score = fungal * 0.4 + water * 0.2 + heat * 0.2 + rainy_ratio * 0.2
    return round(min(100, max(0, score)), 1)


def risk_level_from_score(score: float) -> str:
    """Convierte score numérico a nivel de riesgo."""
    if score >= 70:
        return "alto"
    if score >= 40:
        return "medio"
    return "bajo"


def build_commercial_metrics() -> dict:
    """Placeholder: métricas comerciales. En producción, leer de DB o API."""
    return {"commercial_risk_score": None}


def build_risk_narrative(
    region_name: str, latest: dict, commercial: dict | None
) -> dict:
    """Genera narrativa humana para el riesgo mensual."""
    level = latest.get("risk_level", "bajo")
    return {
        "summary": f"En {region_name} el riesgo agroclimático está en nivel {level}.",
        "details": f"Mes {latest.get('month_label', 'N/A')} con puntaje combinado {latest.get('combined_score', 'N/A')}.",
    }


def fetch_monthly_risk_rows(region: str, months: int):
    """Obtiene datos mensuales agregados desde la base de datos."""
    try:
        from .db import get_conn

        sql = """
            WITH region_bounds AS (
              SELECT MAX(observed_on) AS latest_observed_on
              FROM flowerxi_weather_daily
              WHERE region_slug = %s
            )
            SELECT
              COALESCE(reg.name, %s) AS region_name,
              to_char(date_trunc('month', w.observed_on), 'YYYY-MM') AS month_label,
              COUNT(*)::int AS sample_days,
              SUM(CASE WHEN COALESCE(w.precipitation_mm, 0) > 0 THEN 1 ELSE 0 END)::int AS rainy_days,
              AVG(COALESCE(r.fungal_risk, 0)) AS avg_fungal_risk,
              AVG(COALESCE(r.waterlogging_risk, 0)) AS avg_waterlogging_risk,
              AVG(COALESCE(r.heat_risk, 0)) AS avg_heat_risk
            FROM flowerxi_weather_daily w
            CROSS JOIN region_bounds rb
            LEFT JOIN flowerxi_risk_signals r
              ON r.region_slug = w.region_slug AND r.observed_on = w.observed_on
            LEFT JOIN flowerxi_regions reg
              ON reg.slug = w.region_slug
            WHERE w.region_slug = %s
              AND (
                rb.latest_observed_on IS NULL
                OR date_trunc('month', w.observed_on)
                   >= date_trunc('month', rb.latest_observed_on)
                      - (((%s)::int - 1)::text || ' months')::interval
              )
            GROUP BY COALESCE(reg.name, %s), date_trunc('month', w.observed_on)
            ORDER BY date_trunc('month', w.observed_on) DESC
            LIMIT %s;
        """

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (region, region, region, months, region, months))
                rows = cur.fetchall()

        region_name = rows[0]["region_name"] if rows else region
        return region_name, rows
    except Exception as e:
        logger.error(f"Error fetch_monthly_risk_rows: {e}")
        return region, []


def load_market_prices() -> dict:
    """Placeholder: carga precios de mercado desde archivo o API."""
    return {}
