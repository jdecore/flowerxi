# flowerxi

Plataforma enfocada en rosa de corte para la Sabana de Bogota.

## Estructura

- `frontend/`: Astro + islas Svelte (tema morado), listo para Vercel.
- `backend/`: FastAPI (Python), listo para Render.
- `database/`: esquema y seed de InsForge con datos web de 2026.

## Enfoque funcional

- Cultivo foco: rosa de corte (variedades lavanda/morada).
- Municipios foco: Madrid, Facatativa y Funza.
- El dashboard permite seleccionar municipio y ver riesgo/recomendacion diaria.
- Incluye chat IA en navegador (modelo local con Transformers.js).
- Incluye pagina de precios de mercado en `/precios`.

## Despliegue recomendado

- Frontend: Vercel
- Backend: Render
- Base de datos: InsForge Postgres

## Inicializacion de base de datos

Desde la raiz de `flowerxi`:

```bash
cd flowerxi
./database/apply.sh
```

## Variables de entorno

### Frontend (Vercel)

- `PUBLIC_API_URL` -> URL publica del backend (Render).

### Backend (Render)

- `DATABASE_URL` -> connection string Postgres completa.
- `CORS_ORIGINS` -> dominio(s) del frontend (separados por coma).
- `APP_PORT` -> opcional en Render.

## Automatizacion con GitHub Actions

Workflows incluidos:

- `.github/workflows/market-prices.yml`
  - Ejecuta `scripts/scrape_market.py`.
  - Actualiza `frontend/public/market_prices.json` y commitea solo si hay cambios.
- `.github/workflows/daily-data.yml`
  - Ejecuta `scripts/auto_seed.py`.
  - Inserta/actualiza clima, riesgo y recomendacion diaria en InsForge.

Secretos requeridos en GitHub:

- `INSFORGE_DB_URL` -> URL de conexion directa a PostgreSQL.

## Desarrollo local rapido

```bash
# frontend
cd frontend
npm install
npm run dev

# backend
cd ../backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```
