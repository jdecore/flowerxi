# flowerxi — Plataforma de Vigilancia Agroclimática para Flores de Corte

Monitoreo climático, análisis de riesgo y recomendaciones operativas para la
Sabana de Bogotá. **Sin servidor backend — todo corre en el navegador.**

## Stack

- **Frontend:** Astro + Svelte (desplegado en Vercel)
- **Histórico:** JSONs precargados en `frontend/public/data/` (Ene-May 2026)
- **Hoy en vivo:** Open-Meteo Forecast API consultada directamente desde el navegador
- **Motor de riesgo:** Puerto JS del modelo original (`engine.js`)

## Desarrollo local

```bash
cd frontend
npm install
npm run dev     # http://localhost:4321
```

## Regenerar datos estáticos (opcional)

```bash
pip install requests
python scripts/dump_data.py
```

Esto fetchea Open-Meteo Archive y escribe los JSONs en `frontend/public/data/`.

## Deploy

Solo el `frontend/` en Vercel. Sin backend, sin DB, sin secrets.
