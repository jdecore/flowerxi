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

- Frontend: `astro`, `@astrojs/svelte`, `svelte`
- Backend: `fastapi`, `uvicorn`, `psycopg`
- DB: InsForge Postgres (proyecto `glovar`)

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

Conteos validados en InsForge:

- `flowerxi_regions`: 1
- `flowerxi_weather_daily`: 105
- `flowerxi_risk_signals`: 105
- `flowerxi_recommendations`: 105
- `flowerxi_market_calendar`: 18

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
- `GET /api/dashboard/full?region=...` — datos unificados (regions + snapshot + operativo + history)
- `GET /api/history?region=...&limit=30` — histórico climático
- `GET /api/alerts/today?region=...` — alerta activa del día
- `GET /api/alerts/history?region=...&limit=30` — historial de alertas
- `GET /api/recommendations/week?region=...&days=7` — recomendaciones semanales
- `GET /api/risk/operativo?region=...` — estado operativo con acción concreta
- `GET /api/risk/monthly?region=...&months=6` — riesgo agroclimático mensual + narrativa
- `GET /api/risk/explain?region=...` — explicación del riesgo reciente
- `GET /api/stations?region=...` — estaciones meteorológicas
- `GET /api/calendar?year=2026` — calendario de mercado
- `GET /api/exports?months=12` — datos de exportación (DANE proxy)
- `GET /api/model/version` — versión del modelo de riesgo

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

- **Astro (estático):** layout, copy de decisión y estructura principal.
- **Islas Svelte (dinámico):** datos vivos, interacción y actualización.

Componentes clave implementados:

- `frontend/src/islands/Sidebar.svelte`
  - sidebar morada fija (desktop), colapsable
  - selector de municipio + lote
  - accesos a Chat IA y Modo campo
- `frontend/src/islands/EvidenceSparklines.svelte`
  - evidencia real de 14 días desde `/api/history`
  - estado vacío cuando hay menos de 7 días
- `frontend/src/islands/TodayChecklist.svelte`
  - checklist diario con persistencia en `localStorage`
  - micro-acción "Tomar foto / Sin novedad" para puntos húmedos

Widgets operativos ya integrados en home:

- `WeeklyKPIs.svelte`
- `RiskHeatmap.svelte` (versión ligera en grid, sin dependencia pesada en runtime)
- `ImpactoOperacion.svelte`

Resiliencia de integración API:

- fallback de base URL (`PUBLIC_API_URL` / localhost / same-origin)
- normalización de paths para evitar `/api/api`
- degradación controlada cuando faltan endpoints (derivando desde `/api/dashboard` o `/api/history`)

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

2. Checklist multiusuario:
   - crear tabla `flowerxi_checklist` en DB
   - exponer endpoints backend para guardar/leer tareas por fecha/lote
   - conectar `TodayChecklist.svelte` a API (en vez de solo localStorage)

3. Lotes reales:
   - mover catálogo de lotes desde store frontend a backend
   - incluir lote en endpoints de dashboard/history para segmentación real

4. UX operativa final:
   - drawer de explicabilidad al click en nivel de riesgo
   - mostrar “Actualizado” + próximo auto-refresh en home
   - ajustar modo campo (tipografía/targets) en más componentes

5. Seguridad + CI:
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
