# AGENTS.md - flowerxi

## Proyecto

`flowerxi` es un proyecto orientado a **Flores de Corte** en la Sabana de Bogota, con arquitectura separada por despliegue:

- `frontend/` -> Astro + islas Svelte (UI morada), pensado para Vercel.
- `backend/` -> FastAPI (Python), pensado para Render.
- `database/` -> esquema SQL + seed desde internet (2026) para InsForge.

---

## Estado actual (handoff)

### 1) Estructura y stack

Ya creada en `/home/juan/lab/flowerxi`:

- `frontend/`
- `backend/`
- `backend/app/` (módulos organizados)
- `database/`

Tecnologias:

- Frontend: `astro`, `@astrojs/svelte`, `svelte`, `@mlc-ai/web-llm` (chat local)
- Backend: `fastapi`, `uvicorn`, `psycopg`
- DB: InsForge Postgres (proyecto `glovar`)
- AI: WebLLM en navegador (sin API externa)

### 2) Backend - Estructura modular (actualizada)

```
backend/
├── app/
│   ├── main.py          # Endpoints FastAPI (limpiado, sin duplicados)
│   ├── config.py        # Configuración (env vars)
│   ├── db.py           # Conexión PostgreSQL
│   ├── queries.py      # Consultas SQL centralizadas
│   └── utils.py        # Utilidades y lógica de negocio
├── run.py              # Servidor local (uvicorn)
└── requirements.txt
```

### 3) Skills de InsForge

Las skills ya estan presentes y sincronizadas en:

- `flowerxi/.agents/skills/insforge`
- `flowerxi/.agents/skills/insforge-cli`
- `flowerxi/.agents/skills/insforge-debug`
- `flowerxi/.agents/skills/insforge-integrations`
- `flowerxi/.agents/skills/find-skills`

### 4) Vinculacion a InsForge

`flowerxi` ya esta linked al proyecto:

- `project_id`: `cd418d31-bb64-4dee-b5f2-e845a20f985e`
- `project_name`: `glovar`
- `oss_host`: `https://6m9r9ikg.us-east.insforge.app`

Archivo: `flowerxi/.insforge/project.json`

### 5) Base de datos creada y cargada

Tablas (`database/schema.sql`):

- `flowerxi_regions`
- `flowerxi_weather_daily`
- `flowerxi_risk_signals`
- `flowerxi_recommendations`
- `flowerxi_market_calendar`
- `flowerxi_municipality_profile`
- `flowerxi_exports_monthly`
- `flowerxi_weather_stations`
- `flowerxi_risk_model_versions`
- `flowerxi_alert_history`

Seed cargado con datos de internet 2026 (`database/seed_from_web.py`) usando:

- Open-Meteo Archive API (Bogota, 2026)
- Nager.Date Public Holidays API (Colombia 2026)

Conteos validados en InsForge (seed 2026 + complementos operativos):

- `flowerxi_regions`: 11
- `flowerxi_weather_daily`: 1155
- `flowerxi_risk_signals`: 1155
- `flowerxi_recommendations`: 1155
- `flowerxi_market_calendar`: 18
- `flowerxi_municipality_profile`: >= 3
- `flowerxi_exports_monthly`: >= 12
- `flowerxi_weather_stations`: >= 5

Script de aplicacion:

- `./database/apply.sh`

### 6) Backend optimizado

**Endpoints implementados** (`backend/app/main.py`):

- `GET /health` — estado del servicio
- `GET /api/regions` — lista de municipios
- `GET /api/municipalities` — perfiles municipales (Cundinamarca)
- `GET /api/municipalities/{slug}` — detalle de municipio
- `GET /api/municipalities/compare` — comparativo municipal
- `GET /api/dashboard?region=...` — snapshot del día actual
- `GET /api/history?region=...&limit=30` — histórico climático
- `GET /api/recommendations/week?region=...&days=7` — recomendaciones semanales
- `GET /api/risk/operativo?region=...` — estado operativo con acción concreta
- `GET /api/risk/monthly?region=...&months=6` — riesgo agroclimático mensual + narrativa
- `GET /api/risk/explain?region=...` — explicación del riesgo reciente
- `GET /api/stations?region=...` — estaciones meteorológicas
- `GET /api/exports?months=12` — datos de exportación (DANE proxy)
- `POST /api/alerts/simulate` — simulación operativa de alerta

**Mejoras aplicadas**:

- ✅ Eliminado `backend/main.py` duplicado
- ✅ Módulos separados: `queries.py` (SQL) y `utils.py` (lógica)
- ✅ Logging estructurado (`logging.getLogger("flowerxi-backend")`)
- ✅ Consultas SQL centralizadas (sin duplicación)
- ✅ Manejo de errores robusto (try/except en endpoints críticos)
- ✅ Código más mantenible y testeable

Variables de entorno (`backend/.env.example`):

- `DATABASE_URL` — conexión PostgreSQL (InsForge)
- `CORS_ORIGINS` — dominios permitidos (comma-separated)
- `APP_PORT` — puerto del servidor (opcional en Render)

### 7) Frontend funcional (actualizado)

Pantalla principal en `frontend/src/pages/index.astro` con separación clara:

- **Astro (estático):** topbar, layout y composición de bloques.
- **Islas Svelte (dinámico):** fetch, eventos y actualización por municipio.

Componentes activos en home:

- `frontend/src/islands/StartupRegionModal.svelte`
  - modal inicial de selección de municipio
  - cambio de municipio en tiempo real (evento `regionchange`)
- `frontend/src/islands/OperationalHero.svelte`
  - riesgo del día, explicación de factores y simulación de alerta
- `frontend/src/islands/EvidenceSparklines.svelte`
  - evidencia real de 14 días desde `/api/history`
- `frontend/src/components/RiskHeatmap.svelte`
  - calendario ampliado de riesgo (12 meses con factores)
- `frontend/src/components/ImpactoOperacion.svelte`
  - resumen operativo semanal basado en datos reales
- `frontend/src/islands/SabanaComparison.svelte`
  - comparativa dinámica entre municipios disponibles
- `frontend/src/islands/ChatBot.svelte`
  - chat operativo embebido, respuestas rápidas con datos backend + WebLLM local

Resiliencia de integración API:

- fallback de base URL (`PUBLIC_API_URL` / localhost / same-origin)
- normalización de paths para evitar `/api/api`
- degradación controlada cuando faltan endpoints (derivando desde `/api/history`)

Variables esperadas (`frontend/.env.example`):

- `PUBLIC_API_URL`
- `PUBLIC_INSFORGE_URL`
- `PUBLIC_INSFORGE_ANON_KEY`

### 8) Validaciones ya ejecutadas

- Frontend build OK: `cd frontend && npm run build`
- Backend sintaxis OK: `python3 -m py_compile app/main.py app/utils.py app/queries.py app/db.py app/config.py`
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

1. Deploy y operación:
   - `frontend/vercel.json` (si hace falta config extra)
   - `backend/render.yaml` o instrucciones cerradas para Render

2. UX operativa final:
   - drawer de explicabilidad al click en nivel de riesgo
   - mostrar “Actualizado” + próximo auto-refresh en home
   - mejorar carga diferida del chat WebLLM para reducir bundle inicial

3. Seguridad + CI:
   - validar `CORS_ORIGINS` de Vercel
   - revisar que no se commiteen `.env`
   - workflow de build frontend
   - check básico backend (compile + import test)

---

## Nota operativa

Si `database/apply.sh` falla con "No project linked", ejecutar desde raiz `flowerxi`:

```bash
npx @insforge/cli link --project-id cd418d31-bb64-4dee-b5f2-e845a20f985e -y
```

y volver a correr `./database/apply.sh`.
