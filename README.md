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
- Municipios principales: **Madrid**, **Facatativá**, **Funza**

### 📊 Dashboard Interactivo
- ✅ Selección de municipio
- ✅ Indicador diario de riesgo agroclimático
- ✅ Recomendaciones personalizadas
- ✅ Histórico de últimos 30 días

### 🛡️ Vigilancia y Priorización
- Capa de **riesgo agroclimático mensual** (proxy fitosanitario)
- Algoritmo de priorización para atención temprana
- **Nota:** Es un modelo de priorización, **NO** es diagnóstico real por finca

### 🤖 Asistente IA
- Chat en navegador con **Transformers.js** (modelo local)
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

### 🚨 Alertas
```http
GET /api/alerts/today?region=madrid
```
Alertas activas del día para el municipio.

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

### 🌐 Fuentes de Datos
- **Clima:** Open-Meteo Archive API (Bogotá, 2026)
- **Festivos:** Nager.Date Public Holidays (Colombia, 2026)
- **Conteo inicial:** 105 registros por tabla (weather, risk, recommendations)

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

### 🎯 Próximas Mejoras (Para Agente Futuro)

#### 🚀 Deploy Configs
- [ ] `frontend/vercel.json` (config extra si se necesita)
- [ ] `backend/render.yaml` (config para Render)

#### 🐛 Backend - Mejoras Demo Laboral
- [ ] Endpoint `/api/alerts/today` (alertas de hoy)
- [ ] Endpoint `/api/recommendations/week` (recomendaciones semanales)
- [ ] Logging estructurado JSON

#### 🎨 Frontend - Storytelling Postulación
- [ ] Tarjetas KPI semanales
- [ ] Mini gráfica de tendencia (últimos 14 días)
- [ ] Bloque "impacto en operación" orientado a negocio

#### 🔐 Seguridad y CI
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
