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
        return ("rutina", "Rutina normal", "Mantén la rutina de monitoreo sin acciones extraordinarias.")
    if score <= 60:
        return ("vigilancia", "Vigilancia reforzada", "Refuerza revisión de humedad, drenaje y ventilación durante el turno.")
    return ("accion", "Acción requerida", "Ejecuta inspección en campo, registra hallazgos y aplica protocolo preventivo.")


def calculate_risk_score(
    rainy_days: int,
    days_with_precip: int,
    avg_temp: float,
    avg_precip: float,
    prev_avg_precip: float | None,
) -> int:
    if avg_precip and prev_avg_precip and avg_precip > prev_avg_precip * 1 and rainy_days >= 3:
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


def build_reason(rainy_days: int, avg_temp: float, avg_precip: float, prev_avg_precip: float | None) -> str:
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


def build_action_today(rainy_days: int, avg_temp: float, avg_precip: float, prev_avg_precip: float | None) -> str:
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