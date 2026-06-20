# flowerxi — Plataforma de Vigilancia Agroclimática para Flores de Corte

Monitoreo climático, análisis de riesgo y recomendaciones operativas para la
Sabana de Bogotá. **Frontend 100% estático — sin servidor, sin base de datos.**

## Stack

- **Frontend:** Astro + Svelte (desplegado en Vercel)
- **Datos históricos:** JSONs estáticos en `frontend/public/data/` (1510 registros, Ene-May 2026)
- **Dato del día:** Open-Meteo Forecast API desde el navegador (CORS-free)

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
