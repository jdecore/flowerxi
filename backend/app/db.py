from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from .config import settings


@contextmanager
def get_conn():
    if not settings.database_configured:
        raise RuntimeError(
            "DATABASE_URL no está configurada. Configura la variable de entorno en Render."
        )
    conn = psycopg.connect(settings.database_url, row_factory=dict_row)
    try:
        yield conn
    finally:
        conn.close()
