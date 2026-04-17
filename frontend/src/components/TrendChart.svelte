<script>
  import { LayerCake, Svg } from 'layercake';
  import { scaleTime, scaleLinear } from 'd3-scale';
  import { line, area, curveMonotoneX } from 'd3-shape';
  import { timeDay } from 'd3-time';

  export let data = [];

  const parseDate = (str) => {
    if (!str) return new Date();
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const getData = () => {
    return data.map((d) => ({
      date: parseDate(d.observed_on),
      temp: d.temp_mean_c != null ? Number(d.temp_mean_c) : null,
      precip: d.precipitation_mm != null ? Number(d.precipitation_mm) : null,
    })).filter((d) => d.temp != null || d.precip != null);
  };

  $: chartData = getData();

  $: xDomain = chartData.length > 0 
    ? [chartData[0].date, chartData[chartData.length - 1].date]
    : [new Date(), new Date()];

  $: yTempMin = chartData.length > 0 ? Math.min(...chartData.map(d => d.temp).filter(t => t != null)) - 2 : 5;
  $: yTempMax = chartData.length > 0 ? Math.max(...chartData.map(d => d.temp).filter(t => t != null)) + 2 : 20;
  $: yPrecipMax = chartData.length > 0 ? Math.max(...chartData.map(d => d.precip).filter(p => p != null)) : 10;

  $: x = scaleTime().domain(xDomain).range([0, 100]);
  $: yTemp = scaleLinear().domain([yTempMin, yTempMax]).range([100, 0]);
  $: yPrecip = scaleLinear().domain([0, yPrecipMax]).range([100, 0]);

  $: lineTemp = line()
    .x(d => x(d.date))
    .y(d => yTemp(d.temp))
    .curve(curveMonotoneX);

  $: areaPrecip = area()
    .x(d => x(d.date))
    .y0(100)
    .y1(d => yPrecip(d.precip))
    .curve(curveMonotoneX);

  $: pathTemp = chartData.length > 0 ? lineTemp(chartData) : '';
  $: pathPrecip = chartData.length > 0 ? areaPrecip(chartData) : '';

  const formatX = (d) => {
    const idx = Math.round((d - xDomain[0]) / (xDomain[1] - xDomain[0]) * (chartData.length - 1));
    const item = chartData[Math.max(0, Math.min(idx, chartData.length - 1))];
    if (!item) return '';
    return item.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const ticksX = chartData.length > 0 
    ? timeDay.range(xDomain[0], xDomain[1], Math.ceil(chartData.length / 7))
    : [];

  $: xTicks = ticksX.length > 0 ? ticksX : [xDomain[0], xDomain[1]];
</script>

<div class="chart-container">
  <LayerCake
    padding={{ top: 10, right: 10, bottom: 28, left: 36 }}
    x={x}
    y={yTemp}
    {chartData}
  >
    <Svg>
      <defs>
        <linearGradient id="precip-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.5" />
          <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.15" />
        </linearGradient>
      </defs>

      {#if pathPrecip}
        <path 
          d={pathPrecip} 
          fill="url(#precip-gradient)" 
          stroke="none"
        />
      {/if}

      {#if pathTemp}
        <path 
          d={pathTemp} 
          fill="none" 
          stroke="#c084fc" 
          stroke-width="2.5" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />
      {/if}

      {#each chartData as d, i}
        {#if d.temp != null}
          <circle 
            cx={x(d.date)} 
            cy={yTemp(d.temp)} 
            r="3" 
            fill="#c084fc"
          />
        {/if}
      {/each}

      <g class="axis x-axis">
        {#each xTicks as tick}
          <g class="tick" transform="translate({x(tick)}, 0)">
            <line y1="0" y2="4" stroke="#6b5b8c" stroke-width="1" />
            <text y="16" text-anchor="middle" fill="#9d8abf" font-size="9">
              {formatX(tick)}
            </text>
          </g>
        {/each}
      </g>

      <g class="axis y-axis-left">
        {#each yTemp.ticks(5) as tick}
          <g class="tick" transform="translate(0, {yTemp(tick)})">
            <line x1="0" x2="-4" stroke="#6b5b8c" stroke-width="1" />
            <text x="-8" text-anchor="end" dominant-baseline="middle" fill="#9d8abf" font-size="9">
              {tick}°
            </text>
          </g>
        {/each}
      </g>

      <g class="axis y-axis-right">
        {#each yPrecip.ticks(4) as tick}
          <g class="tick" transform="translate(100, {yPrecip(tick)})">
            <line x1="0" x2="4" stroke="#06b6d4" stroke-width="1" stroke-dasharray="2,2" />
            <text x="8" text-anchor="start" dominant-baseline="middle" fill="#06b6d4" font-size="9">
              {tick}mm
            </text>
          </g>
        {/each}
      </g>
    </Svg>
  </LayerCake>

  <div class="legend">
    <span class="legend-item">
      <span class="legend-dot" style="background: #c084fc;"></span>
      Temperatura (°C)
    </span>
    <span class="legend-item">
      <span class="legend-box" style="background: linear-gradient(180deg, #06b6d4 0%, #06b6d4 100%);"></span>
      Precipitación (mm)
    </span>
  </div>
</div>

<style>
  .chart-container {
    width: 100%;
    height: 240px;
    position: relative;
  }

  :global(.chart-container svg) {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .legend {
    display: flex;
    justify-content: center;
    gap: 1.2rem;
    margin-top: 0.6rem;
    font-size: 0.78rem;
    color: #9d8abf;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .legend-box {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }
</style>