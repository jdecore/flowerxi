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
