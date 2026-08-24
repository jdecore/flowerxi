# 🌺 flowerxi — Inteligencia Agroclimática para Floricultura de Exportación

> **Plataforma de vigilancia agroclimática y toma de decisiones operativas en tiempo real para productores de flores de corte en la Sabana de Bogotá.**

---

## 💼 Impacto Comercial: ¿Cómo ayuda a tu empresa?

En la floricultura de exportación (rosa, clavel, hortensia), un cambio brusco de humedad relativa en la madrugada puede desencadenar brotes masivos de *Botrytis cinerea* o *Mildiú*, generando **pérdidas de hasta el 30% en poscosecha y rechazos en puerto de destino**.

**Flowerxi transforma datos climáticos complejos en acciones operativas concretas a las 6:00 AM:**
* **🛡️ Reducción de Pérdidas por Hongos:** Alertas tempranas de condensación foliar para programar la apertura de cortinas y evitar esporulación.
* **💧 Optimización de Fertirriego:** Ajusta el volumen (L/m²) y las horas de riego según la evapotranspiración y saturación del sustrato del día.
* **⏱️ Ahorro de Tiempo y Costos:** Recomendaciones fitosanitarias automáticas sin depender de consultorías externas tardías.
* **📈 Alineación Comercial:** Correlaciona el riesgo climático con los picos de exportación clave (*San Valentín* y *Día de la Madre*).

---

## 🛠️ Arquitectura Técnica

Arquitectura *Edge-First* de alto rendimiento, diseñada para operar **sin servidor backend en vivo**, garantizando máxima velocidad, cero latencia y costos mínimos de infraestructura.

```
┌────────────────────────────────────────────────────────┐
│                   Vercel Edge (Astro)                  │
├──────────────────────────┬─────────────────────────────┤
│   Datos Agroclimáticos   │     IA Especialista Local   │
│   • Open-Meteo API       │     • Qwen2.5 0.5B Instruct │
│   • Estaciones IDEAM     │     • ONNX / WASM In-Browser│
│   • Registros DANE       │     • Privacidad Total      │
└──────────────────────────┴─────────────────────────────┘
```

### 🧱 Componentes del Sistema

* **Frontend:** [Astro](https://astro.build/) en modo estático (`output: "static"`) con arquitectura de islas interactivas.
* **Modelos de IA en Navegador:** Motor de inferencia local con **Qwen2.5 0.5B-Instruct** y **LFM2.5** ejecutados en WebAssembly (WASM) / ONNX Runtime — *no envía datos del cultivo a servidores externos*.
* **Pipeline de Datos Automatizado:** GitHub Actions periódicos que actualizan el histórico microclimático y pronósticos en `frontend/public/data/`.
* **Fuentes de Información:**
  * Microclima y radiación: **Open-Meteo Forecast & Archive API**.
  * Red de referencia: **Estaciones Meteorológicas IDEAM** (Madrid, Funza, Facatativá, Chía, Sopó, etc.).
  * Comercio exterior: Estadísticas oficiales **DANE / Asocolflores**.

---

## 🚀 Inicio Rápido

### Requisitos
* Node.js 18+
* npm

### Instalación y Ejecución Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/jdecore/flowerxi.git
cd flowerxi/frontend

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo
npm run dev
```

Abre en tu navegador: `http://localhost:4321`

### Compilación para Producción

```bash
npm run build
```

---

## 📦 Despliegue en Vercel

El proyecto está configurado para desplegarse de forma directa en **Vercel** apuntando a la carpeta `frontend/`:
* **Framework Preset:** Astro
* **Root Directory:** `frontend`
* **Build Command:** `npm run build`
* **Output Directory:** `dist`
* *Sin variables de entorno obligatorias ni base de datos conectada en tiempo de ejecución.*

---

© 2026 **flowerxi** — Diseñado para la floricultura de la Sabana de Bogotá.
