# 🌺 flowerxi - Plataforma Inteligente de Flores de Corte

> Sistema de vigilancia agroclimática y recomendaciones para la Sabana de Bogotá

---

## 📋 Índice

- [🌻 Visión General](#-visión-general)
- [🏗️ Arquitectura](#️-arquitectura)
- [🌍 Enfoque Funcional](#-enfoque-funcional)
- [🔌 API Endpoints](#-api-endpoints)
- [🚀 Despliegue](#-despliegue)
- [🗄️ Base de Datos](#️-base-de-datos)
- [⚙️ Configuración](#️-configuración)
- [🤖 Automatización](#-automatización)
- [💻 Desarrollo Local](#-desarrollo-local)
- [📊 Roadmap](#-roadmap)

---

## 🌻 Visión General

**flowerxi** es una plataforma integral que combina **datos agroclimáticos en tiempo real** con **inteligencia artificial** para apoyar la toma de decisiones en el cultivo de **rosas de corte** en la Sabana de Bogotá.

🌤️ **Monitoreo climático** → 📈 **Análisis de riesgo** → 💡 **Recomendaciones accionables**

---

## 🏗️ Arquitectura

```mermaid
graph TD
    A[Frontend<br/>Astro + Svelte<br/>🎨 Tema Morado] --> B[Backend<br/>FastAPI - Python<br/>🚀 API REST];
    B --> C[Base de Datos<br/>InsForge Postgres<br/>📊 Datos 2026];
    D[GitHub Actions<br/>🤖 Automatización] --> C;
    C --> B;
```

### 📁 Estructura del Backend (Modular)

```
backend/
├── app/
│   ├── main.py          # Endpoints FastAPI (sin duplicados)
│   ├── config.py        # Configuración (env vars)
│   ├── db.py            # Conexión PostgreSQL
│   ├── queries.py       # Consultas SQL centralizadas
│   └── utils.py         # Utilidades y lógica de negocio
├── run.py               # Servidor local (uvicorn)
└── requirements.txt
```

**Características:**
- ✅ **Consultas centralizadas**: Todas las queries SQL en `queries.py`
- ✅ **Lógica reutilizable**: `utils.py` con funciones compartidas
- ✅ **Logging estructurado**: Logs con nivel INFO y formato JSON-ready
- ✅ **Manejo robusto**: Try/except en endpoints críticos
- ✅ **Sin duplicación**: Una única versión de cada consulta

### 📁 Estructura del Proyecto

| Componente | Tecnología | Destino |
|------------|------------|---------|
| `frontend/` | 🚀 Astro + Svelte | Vercel |
| `backend/` | 🐍 FastAPI | Render |
| `database/` | 📊 InsForge Postgres | Cloud |

---

## 🌍 Enfoque Funcional

### 🌹 Cultivo Foco
- **Rosa de corte** (variedades lavanda/morada)
- Cobertura operativa: municipios floricultores de **Cundinamarca** (base actual del seed)

### 📊 Dashboard Interactivo
- ✅ Selector inicial de municipio (modal) con actualización inmediata del dashboard
- ✅ Botón primario de selección de municipio visible al inicio para priorizar contexto antes de cargar todo
- ✅ Estado diario de riesgo con recomendación accionable
- ✅ Evidencia de 14 días (lluvia, temperatura y señales de riesgo reales)
- ✅ Chat IA operativo embebido en home con contexto real del backend
- ✅ Comparativa Sabana ampliada (ranking dinámico top 10 con cobertura total disponible)

### 🛡️ Vigilancia y Priorización
- Capa de **riesgo agroclimático mensual** basada en `risk_signals` reales
- Algoritmo de priorización para atención temprana
- **Nota:** Es un modelo de priorización, **NO** es diagnóstico real por finca

### 🧩 Arquitectura de UI (actual)
- **Astro**: estructura estática, layout principal y topbar
- **Islas Svelte**: datos vivos y eventos (`StartupRegionModal`, `OperationalHero`, `EvidenceSparklines`, `RiskHeatmap`, `ImpactoOperacion`, `SabanaComparison`, `ChatBot`)
- **Hidratación diferida**: módulos no críticos con carga `client:visible` / `client:idle` para mejorar tiempo inicial
- Integración tolerante a fallos: si un endpoint no responde, los widgets derivan desde `/api/history` (sin datos estáticos inventados)

### 🤖 Asistente IA
- Chat en navegador con **WebLLM (MLC AI)** (modelo local)
- Sin dependencias externas de API de IA

### 💰 Inteligencia de Mercado
- Página de precios de mercado en `/precios`
- Datos actualizados automáticamente

---

## 🔌 API Endpoints

### 📈 Dashboard
```http
GET /api/dashboard?region=madrid
```
Snapshots diarios de clima, riesgo y recomendación.

### 📊 Histórico
```http
GET /api/history?region=madrid&limit=30
```
Últimos N días de datos completos (clima + riesgo + recomendación).

### 🚨 Simulación de Alertas
```http
POST /api/alerts/simulate
```
Simula alerta de mañana con acción recomendada y confianza.

### 💡 Recomendaciones Semanales
```http
GET /api/recommendations/week?region=madrid&days=7
```
Plan de acciones para la semana.

### 📅 Riesgo Mensual
```http
GET /api/risk/monthly?region=madrid&months=6
```
Tendencia de riesgo agroclimático para planeación.

### 🏥 Estado Operativo
```http
GET /api/risk/operativo?region=madrid
```
Estado operativo del día con acción concreta.

### 📝 Explicación de Riesgo
```http
GET /api/risk/explain?region=madrid
```
Análisis de por qué subió/bajó el riesgo.

### 📡 Estaciones Meteorológicas
```http
GET /api/stations?region=madrid
```
Lista de estaciones meteorológicas cercanas.

### 📈 Exportaciones
```http
GET /api/exports?months=12
```
Datos de exportación mensuales (proxy DANE).

### 🗺️ Municipios
```http
GET /api/municipalities
```
Perfiles municipales de Cundinamarca.

### 🔍 Comparativo Municipal
```http
GET /api/municipalities/compare
```
Comparativa entre todos los municipios.

---

## 🚀 Despliegue

| Servicio | Plataforma | Estado |
|----------|------------|--------|
| Frontend | Vercel | ✅ Configurado |
| Backend | Render | ✅ Configurado |
| Base de Datos | InsForge Postgres | ✅ Activa |

### 🔗 InsForge
- **Proyecto:** `glovar`
- **ID:** `cd418d31-bb64-4dee-b5f2-e845a20f985e`
- **URL:** `https://6m9r9ikg.us-east.insforge.app`

---

## 🗄️ Base de Datos

### 📋 Tablas
| Tabla | Descripción |
|-------|-------------|
| `flowerxi_regions` | Municipios de la Sabana |
| `flowerxi_weather_daily` | Datos climáticos diarios (Open-Meteo) |
| `flowerxi_risk_signals` | Señales de riesgo diarias |
| `flowerxi_recommendations` | Recomendaciones diarias |
| `flowerxi_market_calendar` | Calendario de mercado (Nager.Date) |
| `flowerxi_municipality_profile` | Perfil operativo municipal |
| `flowerxi_exports_monthly` | Exportaciones mensuales (proxy DANE) |
| `flowerxi_weather_stations` | Estaciones meteorológicas por municipio |

### 🌐 Fuentes de Datos
- **Clima:** Open-Meteo Archive API (Bogotá, 2026)
- **Festivos:** Nager.Date Public Holidays (Colombia, 2026)
- **Cobertura actual:** municipios floricultores de Cundinamarca y serie 2026-01-01 a 2026-04-15 para clima/riesgo/recomendación

### 🚀 Aplicar Schema y Seed
```bash
cd flowerxi
./database/apply.sh
```

**Nota:** Si falla con "No project linked":
```bash
npx @insforge/cli link --project-id cd418d31-bb64-4dee-b5f2-e845a20f985e -y
```

---

## ⚙️ Configuración

### 🌐 Frontend (Vercel)
```env
PUBLIC_API_URL=https://tu-backend.onrender.com
PUBLIC_INSFORGE_URL=https://6m9r9ikg.us-east.insforge.app
PUBLIC_INSFORGE_ANON_KEY=tu_anon_key
```

### 🐍 Backend (Render)
```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
CORS_ORIGINS=https://tu-frontend.vercel.app,https://www.tu-frontend.vercel.app
APP_PORT=8000  # Opcional en Render
```

### 🔒 Seguridad
- ✅ No committear archivos `.env`
- ✅ Validar `CORS_ORIGINS` solo dominios de Vercel
- ✅ Usar variables de entorno en plataforma de despliegue

---

## 🤖 Automatización con GitHub Actions

### 📈 Workflow: Precios de Mercado
**Archivo:** `.github/workflows/market-prices.yml`
- Ejecuta `scripts/scrape_market.py`
- Actualiza `frontend/public/market_prices.json`
- Commitea solo si hay cambios

### 🌤️ Workflow: Datos Diarios
**Archivo:** `.github/workflows/daily-data.yml`
- Ejecuta `scripts/auto_seed.py`
- Inserta/actualiza clima, riesgo y recomendación diaria en InsForge

### 🔐 Secretos Requeridos
```env
INSFORGE_DB_URL=postgresql://...  # URL directa a PostgreSQL
```

---

## 💻 Desarrollo Local Rápido

### 1️⃣ Backend (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Completar DATABASE_URL y CORS_ORIGINS
python run.py
```
👉 API disponible en `http://localhost:8000`

### 2️⃣ Frontend (Astro + Svelte)
```bash
cd frontend
npm install
cp .env.example .env
# Completar PUBLIC_API_URL
npm run dev
```
👉 Dashboard disponible en `http://localhost:4321`

---

## 📊 Roadmap Sugerido

### ✅ Completado (Reorganización Backend)
- [x] Eliminar `backend/main.py` duplicado
- [x] Separar lógica en módulos: `utils.py` y `queries.py`
- [x] Centralizar consultas SQL (evitar duplicación)
- [x] Agregar logging estructurado
- [x] Mejorar manejo de errores

### ✅ Completado (UX Operativa Frontend)
- [x] Separar contenido estático (Astro) y dinámico (islas Svelte)
- [x] Recuperar sidebar morada fija y colapsable
- [x] Agregar selector de lote (además de municipio)
- [x] Reemplazar gráficos mock por evidencia real desde `/api/history`
- [x] Agregar estados vacíos cuando hay pocos días de historial
- [x] Persistir checklist diario en cliente (localStorage)
- [x] Corregir errores SSR (`window is not defined`) para build en Vercel

### 🎯 Próximas Mejoras (Para Agente Futuro)

#### 🚀 Deploy Configs
- [ ] `frontend/vercel.json` (config extra si se necesita)
- [ ] `backend/render.yaml` (config para Render)

#### 🔄 Integración de datos operativos
- [ ] Persistir checklist en backend (`flowerxi_checklist`) para multiusuario
- [ ] Exponer lotes desde backend (hoy están en store frontend)
- [ ] Añadir trazabilidad de evidencia (foto/sin novedad) en API

#### 🎨 Frontend - Afinación final
- [ ] Drawer de explicabilidad al tocar score/nivel
- [ ] Etiqueta de “Actualizado + próximo auto-refresh”
- [ ] Optimizar lazy-load del chat IA para reducir bundle inicial

#### 🔐 Seguridad y CI/CD
- [ ] Validar `CORS_ORIGINS` para Vercel
- [ ] Revisar que no se commiten `.env`
- [ ] GitHub Actions: build frontend
- [ ] GitHub Actions: lint/check backend

---

## 📖 Licencia

Este proyecto está bajo la licencia MIT.

---

## 🙋 Contacto

🤝 **¡Contribuciones bienvenidas!**  
📧 Reporta issues en: https://github.com/tu-usuario/flowerxi/issues

---

<div align="center">

**🌺 Hecho con ❤️ para la Sabana de Bogotá 🌺**

[![Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com)
[![Render](https://img.shields.io/badge/Backend-Render-blue?logo=render)](https://render.com)
[![InsForge](https://img.shields.io/badge/Database-InsForge-purple?logo=postgresql)](https://insforge.app)

</div>
