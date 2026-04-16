# flowerxi

Plataforma enfocada en Flores de Corte para la Sabana de Bogota.

## Estructura

- `frontend/`: Astro + islas Svelte (tema morado), listo para Vercel.
- `backend/`: FastAPI (Python), listo para Render.
- `database/`: esquema y seed de InsForge con datos web de 2026.

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
