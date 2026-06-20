# flowerxi — Plataforma de Vigilancia Agroclimática para Flores de Corte

Monitoreo climático, análisis de riesgo y recomendaciones operativas para la
Sabana de Bogotá.

## Stack

| Componente | Tecnología | Destino |
|------------|-----------|---------|
| `frontend/` | Astro + Svelte | Vercel |
| `backend/` | FastAPI (Python) | Render |
| `database/` | InsForge Postgres | Cloud |

## Desarrollo local

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # completar DATABASE_URL, CORS_ORIGINS
python run.py         # http://localhost:8000

# Frontend
cd frontend
npm install
cp .env.example .env  # completar PUBLIC_API_URL
npm run dev           # http://localhost:4321
```

## API (endpoints principales)

```
GET  /api/dashboard?region=madrid        — snapshot diario
GET  /api/history?region=madrid&limit=30 — histórico climático
GET  /api/risk/monthly?region=madrid     — riesgo agroclimático mensual
GET  /api/recommendations/week?region=madrid — plan semanal
POST /api/alerts/simulate                — simular alerta
```

## Base de datos

```bash
./database/apply.sh   # aplicar schema + seed
```

Si falla por project link:
```bash
npx @insforge/cli link --project-id cd418d31-bb64-4dee-b5f2-e845a20f985e -y
```

## Despliegue

- Frontend → Vercel
- Backend → Render (`render.yaml` incluido)
- DB → InsForge (proyecto `glovar`)
