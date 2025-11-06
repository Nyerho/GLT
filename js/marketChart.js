// Market Candlestick Chart with randomized updates (ApexCharts)
// No exports needed beyond init/start/stop for lifecycle control

let chart = null;
let updateTimerId = null;
let marketData = []; // maintain our own data array so updates are reliable

// Seed with an initial price and volatility
const START_PRICE = 21500;
const VOLATILITY_PCT = 0.008; // ~0.8% per candle

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

function scheduleNextUpdate() {
  const ms = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000; // 1–3 seconds
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
      background: "#0b0f19",   // dark background
      foreColor: "#eaecef",     // light text
      animations: { enabled: true, easing: "easeinout", speed: 300 },
      toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true } }
    },
    series: [{ data: marketData }],
    title: { text: "BTC/USDT (Simulated)", align: "left", style: { color: "#93c5fd", fontSize: "14px", fontWeight: 600 } },
    plotOptions: {
      candlestick: {
        colors: {
          upward: "#22c55e",  // green for up
          downward: "#ef4444" // red for down
        },
        wick: { useFillColor: true }
      }
    },
    xaxis: {
      type: "datetime",
      labels: { style: { colors: "#94a3b8" } },
      axisBorder: { color: "#1e293b" },
      axisTicks: { color: "#1e293b" }
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: { style: { colors: "#94a3b8" } },
    },
    grid: {
      borderColor: "#1e293b",
      strokeDashArray: 3
    },
    theme: { mode: "dark" } // force dark theme
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