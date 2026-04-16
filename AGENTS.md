# AGENTS.md - flowerxi

## Proyecto

`flowerxi` es un proyecto orientado a **Flores de Corte** en la Sabana de Bogota, con arquitectura separada por despliegue:

- `frontend/` -> Astro + islas Svelte (UI morada), pensado para Vercel.
- `backend/` -> FastAPI (Python), pensado para Render.
- `database/` -> esquema SQL + seed desde internet (2026) para InsForge.

---

## Estado actual (handoff)

### 1) Estructura y stack

Ya creada en `/home/juan/lab/glovar/flowerxi`:

- `frontend/`
- `backend/`
- `database/`

Tecnologias:

- Frontend: `astro`, `@astrojs/svelte`, `svelte`
- Backend: `fastapi`, `uvicorn`, `psycopg`
- DB: InsForge Postgres (proyecto `glovar`)

### 2) Skills de InsForge

Las skills ya estan presentes y sincronizadas en:

- `flowerxi/.agents/skills/insforge`
- `flowerxi/.agents/skills/insforge-cli`
- `flowerxi/.agents/skills/insforge-debug`
- `flowerxi/.agents/skills/insforge-integrations`
- `flowerxi/.agents/skills/find-skills`

### 3) Vinculacion a InsForge

`flowerxi` ya esta linked al proyecto:

- `project_id`: `cd418d31-bb64-4dee-b5f2-e845a20f985e`
- `project_name`: `glovar`
- `oss_host`: `https://6m9r9ikg.us-east.insforge.app`

Archivo: `flowerxi/.insforge/project.json`

### 4) Base de datos creada y cargada

Tablas (`database/schema.sql`):

- `flowerxi_regions`
- `flowerxi_weather_daily`
- `flowerxi_risk_signals`
- `flowerxi_recommendations`
- `flowerxi_market_calendar`

Seed cargado con datos de internet 2026 (`database/seed_from_web.py`) usando:

- Open-Meteo Archive API (Bogota, 2026)
- Nager.Date Public Holidays API (Colombia 2026)

Conteos validados en InsForge:

- `flowerxi_regions`: 1
- `flowerxi_weather_daily`: 105
- `flowerxi_risk_signals`: 105
- `flowerxi_recommendations`: 105
- `flowerxi_market_calendar`: 18

Script de aplicacion:

- `./database/apply.sh`

### 5) Backend funcional

Endpoints implementados (`backend/app/main.py`):

- `GET /health`
- `GET /api/dashboard?region=sabana-bogota`
- `GET /api/history?region=sabana-bogota&limit=30`

Variables esperadas (`backend/.env.example`):

- `DATABASE_URL`
- `CORS_ORIGINS`
- `APP_PORT`

### 6) Frontend funcional

Pantalla principal en `frontend/src/pages/index.astro` con dashboard Svelte:

- consume `PUBLIC_API_URL`
- estilo morado (tema principal)
- muestra snapshot de riesgo y recomendacion diaria

Variables esperadas (`frontend/.env.example`):

- `PUBLIC_API_URL`
- `PUBLIC_INSFORGE_URL`
- `PUBLIC_INSFORGE_ANON_KEY`

### 7) Validaciones ya ejecutadas

- Frontend build OK: `cd frontend && npm run build`
- Backend sintaxis OK: `python3 -m py_compile ...`
- Seed dry-run OK y apply OK en InsForge

---

## Como correr local

1) Backend:

```bash
cd flowerxi/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# completar DATABASE_URL y CORS_ORIGINS
python run.py
```

2) Frontend:

```bash
cd flowerxi/frontend
npm install
cp .env.example .env
# completar PUBLIC_API_URL apuntando al backend local o deploy
npm run dev
```

3) Base de datos (cuando se actualice esquema/seed):

```bash
cd flowerxi
./database/apply.sh
```

---

## Proximo trabajo recomendado (para siguiente agente)

1. Crear deploy configs:
   - `frontend/vercel.json` (si hace falta config extra)
   - `backend/render.yaml` o instrucciones cerradas para Render

2. Mejorar backend para demo laboral:
   - endpoint `/api/alerts/today`
   - endpoint `/api/recommendations/week`
   - logging estructurado JSON

3. Mejorar frontend para storytelling de postulacion:
   - tarjetas KPI semanales
   - mini grafica de tendencia (ultimos 14 dias)
   - bloque "impacto en operacion" orientado a negocio

4. Seguridad/config:
   - validar `CORS_ORIGINS` de Vercel
   - revisar que no se commiteen `.env`

5. GitHub + CI minimo:
   - workflow de build frontend
   - lint/check basico backend (compile + import test)

---

## Nota operativa

Si `database/apply.sh` falla con "No project linked", ejecutar desde raiz `flowerxi`:

```bash
npx @insforge/cli link --project-id cd418d31-bb64-4dee-b5f2-e845a20f985e -y
```

y volver a correr `./database/apply.sh`.
