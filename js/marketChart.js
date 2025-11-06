// Market Candlestick Chart with randomized updates (ApexCharts)
// No exports needed beyond init/start/stop for lifecycle control

let chart = null;
let updateTimerId = null;
let marketData = []; // maintain our own data array so updates are reliable

// Seed with an initial price and volatility
const START_PRICE = 21500;
const VOLATILITY_PCT = 0.008; // ~0.8% per candle

// Faster updates to simulate "per millisecond" trade changes feel (sub-second)
const UPDATE_MIN_MS = 120;
const UPDATE_MAX_MS = 350;

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function nextCandle(prevClose) {
  // Randomize open near previous close
  const open = prevClose * (1 + randBetween(-VOLATILITY_PCT / 2, VOLATILITY_PCT / 2));
  // Move the price during the candle
  const direction = Math.random() < 0.5 ? -1 : 1;
  const drift = direction * randBetween(VOLATILITY_PCT / 4, VOLATILITY_PCT);
  const close = open * (1 + drift);

  // High/Low around open/close (ensure bounds)
  const high = Math.max(open, close) * (1 + randBetween(0, VOLATILITY_PCT / 3));
  const low = Math.min(open, close) * (1 - randBetween(0, VOLATILITY_PCT / 3));

  return [round2(open), round2(high), round2(low), round2(close)];
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function seedSeries(count = 60, startPrice = START_PRICE) {
  const data = [];
  let prevClose = startPrice;
  let ts = Date.now() - count * 60000; // one minute per old candle

  for (let i = 0; i < count; i++) {
    const [o, h, l, c] = nextCandle(prevClose);
    data.push({ x: new Date(ts), y: [o, h, l, c] });
    prevClose = c;
    ts += 60000;
  }
  return { data, lastClose: prevClose };
}

// Module: marketChart.js (initMarketChartSection, scheduleNextUpdate)

function scheduleNextUpdate() {
  const ms = Math.floor(Math.random() * (UPDATE_MAX_MS - UPDATE_MIN_MS + 1)) + UPDATE_MIN_MS;
  updateTimerId = setTimeout(() => {
    if (!chart || marketData.length === 0) return;

    const lastClose = marketData[marketData.length - 1].y[3];
    const [o, h, l, c] = nextCandle(lastClose);
    const point = { x: new Date(), y: [o, h, l, c] };

    marketData.push(point);
    if (marketData.length > 200) marketData.shift();

    chart.updateSeries([{ data: marketData }], true);
    scheduleNextUpdate();
  }, ms);
}

export function initMarketChartSection() {
  const container = document.querySelector("#market-chart");
  if (!container) return;
  if (!window.ApexCharts) {
    console.warn("ApexCharts not loaded. Ensure CDN script is included before module scripts.");
    return;
  }

  const seeded = seedSeries(60, START_PRICE);
  marketData = seeded.data.slice();

  const options = {
    chart: {
      type: "candlestick",
      height: 420,
      background: "transparent", // allow CSS gradient to show
      foreColor: "#eaecef",
      animations: {
        enabled: true,
        easing: "easeinout",
        speed: 220,
        animateGradually: { enabled: true, delay: 40 },
        dynamicAnimation: { enabled: true, speed: 240 }
      },
      toolbar: { show: false } // cleaner look
    },
    series: [{ data: marketData }],
    title: {
      text: "BTC/USDT (Simulated)",
      align: "left",
      style: { color: "#93c5fd", fontSize: "14px", fontWeight: 600 }
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: "#22c55e",
          downward: "#ef4444"
        },
        wick: { useFillColor: true }
      }
    },
    xaxis: {
      type: "datetime",
      labels: { style: { colors: "#a3b3c2", fontSize: "12px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false }
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: { style: { colors: "#a3b3c2", fontSize: "12px" } }
    },
    grid: {
      show: false // remove grid lines
    },
    legend: { show: false },
    states: {
      hover: { filter: { type: "lighten", value: 0.12 } },
      active: { filter: { type: "none" } }
    },
    tooltip: {
      theme: "dark",
      custom: ({ seriesIndex, dataPointIndex }) => {
        const d = marketData[dataPointIndex];
        if (!d) return "";
        const [o, h, l, c] = d.y;
        const time = new Date(d.x).toLocaleTimeString();
        const up = c >= o;
        const changePct = ((c - o) / o) * 100;
        const changeColor = up ? "#22c55e" : "#ef4444";

        return `
          <div class="apex-tooltip">
            <div class="apex-tooltip-title">${time}</div>
            <div class="tt-row"><span>Open</span><span>${o.toFixed(2)}</span></div>
            <div class="tt-row"><span>High</span><span>${h.toFixed(2)}</span></div>
            <div class="tt-row"><span>Low</span><span>${l.toFixed(2)}</span></div>
            <div class="tt-row"><span>Close</span><span>${c.toFixed(2)}</span></div>
            <div class="tt-row"><span>Change</span><span style="color:${changeColor}">${changePct.toFixed(2)}%</span></div>
          </div>
        `;
      }
    },
    theme: { mode: "dark" }
  };

  chart = new window.ApexCharts(container, options);
  chart.render().then(() => {
    startMarketTicker();
  });
}

export function startMarketTicker() {
  stopMarketTicker();
  scheduleNextUpdate();
}

export function stopMarketTicker() {
  if (updateTimerId) {
    clearTimeout(updateTimerId);
    updateTimerId = null;
  }
}