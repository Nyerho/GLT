// Vanilla JS SPA for Globalonlinetrading
// - Marketing Homepage + Trading Dashboard
// - Optional Firebase Auth/Firestore and Gemini News
// - Falls back to localStorage when Firebase config is not provided

// ==== Configuration (edit as needed) ====
// Replace with your Firebase project settings to enable cloud storage
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID",
  storageBucket: "YOUR_STORAGE_BUCKET.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
};

// Replace with your Gemini API key (Google Generative Language API) to enable live market news
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";

// Application ID used for Firestore pathing
const APP_ID = "globalonlinetrading";

// Assets universe for simulated trading
const DEFAULT_ASSETS = {
  BTC: { symbol: "BTC", price: 65000 },
  ETH: { symbol: "ETH", price: 3500 },
  GOOG: { symbol: "GOOG", price: 160 },
  TSLA: { symbol: "TSLA", price: 250 },
};

// ==== Optional Firebase (CDN imports) ====
// We only import Firebase if the config seems set (simple heuristic on apiKey)
let firebaseEnabled = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "YOUR_FIREBASE_API_KEY";
let fb = { app: null, auth: null, db: null };

async function initFirebaseIfEnabled() {
  if (!firebaseEnabled) return;
  // Import Firebase modules via CDN (v10)
  const [{ initializeApp, getApps }, { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, signInWithCustomToken }, { getFirestore, doc, getDoc, setDoc }] =
    await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
    ]);
  if (!getApps().length) {
    fb.app = initializeApp(FIREBASE_CONFIG);
  }
  fb.auth = getAuth();
  fb.db = getFirestore();

  // Expose needed functions on fb
  fb.onAuthStateChanged = onAuthStateChanged;
  fb.signInAnonymously = signInAnonymously;
  fb.signInWithEmailAndPassword = signInWithEmailAndPassword;
  fb.signOut = signOut;
  fb.signInWithCustomToken = signInWithCustomToken;
  fb.doc = doc;
  fb.getDoc = getDoc;
  fb.setDoc = setDoc;
}

// ==== Utilities ====
function formatCurrency(n) {
  try {
    return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
}

function randomWalkPrice(current) {
  const maxPctMove = 0.006; // 0.6% per tick
  const deltaPct = (Math.random() * 2 - 1) * maxPctMove;
  const next = current * (1 + deltaPct);
  return Math.max(0.0001, Number(next.toFixed(2)));
}

function clampQuantity(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Number(n.toFixed(8));
}

function computePortfolioAndEquity(holdings, prices, balance) {
  let portfolioValue = 0;
  Object.keys(holdings || {}).forEach((sym) => {
    const qty = Number(holdings[sym]?.qty || 0);
    const price = Number(prices[sym]?.price || 0);
    portfolioValue += qty * price;
  });
  const equity = portfolioValue + Number(balance || 0);
  return { portfolioValue: Number(portfolioValue.toFixed(2)), equity: Number(equity.toFixed(2)) };
}

// ==== Local Storage Fallback (when Firebase disabled) ====
const LS_KEY = "globalonlinetrading_local_account_summary";
function lsLoadOrInit(uid = "local") {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    return JSON.parse(raw);
  }
  const initial = {
    uid,
    balance: 100000,
    holdings: {},
    portfolioValue: 0,
    equity: 100000,
    updatedAt: Date.now(),
  };
  localStorage.setItem(LS_KEY, JSON.stringify(initial));
  return initial;
}
function lsUpdate(payload) {
  const next = { ...payload, updatedAt: Date.now() };
  localStorage.setItem(LS_KEY, JSON.stringify(next));
}

// ==== Gemini News ====
async function fetchMarketNews(apiKey) {
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
    return [
      { title: "Provide a valid GEMINI_API_KEY to enable live market news.", source: "System", url: "#" },
      { title: "This panel uses Gemini for fresh headlines. Set your API key in app.js.", source: "System", url: "#" },
    ];
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: "Return a concise JSON array of 6 up-to-date financial headlines across BTC, ETH, TSLA, and GOOG for today. Each item must have {title, url, source}. Keep titles short." }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
  };
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.slice(0, 6);
    } catch {
      const match = text.match(/\[\s*{[\s\S]*}\s*\]/m);
      if (match) {
        const fallback = JSON.parse(match[0]);
        if (Array.isArray(fallback)) return fallback.slice(0, 6);
      }
    }
    return [{ title: "Received non-JSON response from Gemini.", source: "System", url: "#" }, { title: text || "No content", source: "System", url: "#" }];
  } catch (err) {
    return [{ title: "Error fetching news from Gemini API.", source: "System", url: "#" }, { title: String(err?.message || err), source: "System", url: "#" }];
  }
}

// ==== App State ====
let currentPage = "home";
let prices = { ...DEFAULT_ASSETS };
let user = null; // { uid: string }
let account = null; // { balance, holdings, portfolioValue, equity }
let pricesInterval = null;

// ==== DOM References ====
const elPageHome = document.getElementById("page-home");
const elPageDash = document.getElementById("page-dashboard");
const elNavHome = document.getElementById("nav-home");
const elNavDashboard = document.getElementById("nav-dashboard");
const elNavAbout = document.getElementById("nav-about");
const elNavFaq = document.getElementById("nav-faq");
const elNavContact = document.getElementById("nav-contact");
const elHomeLogin = document.getElementById("home-login");
const elHomeRegister = document.getElementById("home-register");

const elLoginPanel = document.getElementById("login-panel");
const elAccountPanel = document.getElementById("account-panel");
const elAccountBalance = document.getElementById("account-balance");
const elAccountPortfolio = document.getElementById("account-portfolio");
const elAccountEquity = document.getElementById("account-equity");
const elAccountUser = document.getElementById("account-user");

const elBtnEmailSignin = document.getElementById("btn-email-signin");
const elBtnTokenSignin = document.getElementById("btn-token-signin");
const elBtnAnonSignin = document.getElementById("btn-anon-signin");
const elBtnLogout = document.getElementById("btn-logout");
const elAuthEmail = document.getElementById("auth-email");
const elAuthPassword = document.getElementById("auth-password");
const elAuthToken = document.getElementById("auth-token");

const elPricesGrid = document.getElementById("prices-grid");
const elHoldingsTbody = document.getElementById("holdings-tbody");

const elTradeSymbol = document.getElementById("trade-symbol");
const elTradeSide = document.getElementById("trade-side");
const elTradeQty = document.getElementById("trade-qty");
const elTradeExecute = document.getElementById("trade-execute");
const elTradePrice = document.getElementById("trade-price");
const elTradeEstLabel = document.getElementById("trade-est-label");
const elTradeEst = document.getElementById("trade-est");

const elNewsList = document.getElementById("news-list");

// ==== Navigation ====
function showPage(page) {
  currentPage = page;
  const isHome = page === "home";
  elPageHome.hidden = !isHome;
  elPageDash.hidden = isHome;
  elNavHome.classList.toggle("active", isHome);
  elNavDashboard.classList.toggle("active", !isHome);
}

elNavHome.addEventListener("click", () => showPage("home"));
elNavDashboard.addEventListener("click", () => showPage("dashboard"));
elHomeLogin.addEventListener("click", () => showPage("dashboard"));
elHomeRegister.addEventListener("click", () => showPage("dashboard"));

document.getElementById("footer-home").addEventListener("click", () => showPage("home"));
document.getElementById("footer-about").addEventListener("click", () => alert("About Us: Founded by professional traders and investors in 2013."));
document.getElementById("footer-faq").addEventListener("click", () => alert("FAQ: This is a demo SPA. Configure Firebase/Gemini to enable cloud features."));
document.getElementById("footer-contact").addEventListener("click", () => alert("Contact: support@Globalonlinetrading.com"));

elNavAbout.addEventListener("click", () => alert("About Us: Founded by professional traders and investors in 2013."));
elNavFaq.addEventListener("click", () => alert("FAQ: This is a demo SPA. Configure Firebase/Gemini to enable cloud features."));
elNavContact.addEventListener("click", () => alert("Contact: support@Globalonlinetrading.com"));

// ==== Prices Rendering ====
function renderPrices() {
  elPricesGrid.innerHTML = "";
  Object.keys(prices).forEach((sym) => {
    const tile = document.createElement("div");
    // Use Bootstrap responsive columns for tiles
    tile.className = "price-tile col-6 col-md-3";
    tile.innerHTML = `
      <div class="price-symbol">${sym}</div>
      <div class="price-value">${formatCurrency(prices[sym].price)}</div>
    `;
    elPricesGrid.appendChild(tile);
  });
}

function startPriceSimulation() {
  if (pricesInterval) return;
  pricesInterval = setInterval(() => {
    Object.keys(prices).forEach((sym) => {
      prices[sym].price = randomWalkPrice(prices[sym].price);
    });
    renderPrices();
    renderTradeInfo();
    recalcAndPersistAccount();
  }, 2000);
}

// ==== Account Persistence ====
async function loadOrInitAccountSummary(uid) {
  if (firebaseEnabled && fb.db) {
    const ref = fb.doc(fb.db, "artifacts", APP_ID, "users", uid, "trading_data", "account_summary");
    const snap = await fb.getDoc(ref);
    if (snap.exists()) {
      return { ref, data: snap.data() };
    }
    const initial = {
      balance: 100000,
      holdings: {},
      portfolioValue: 0,
      equity: 100000,
      updatedAt: Date.now(),
    };
    await fb.setDoc(ref, initial);
    return { ref, data: initial };
  } else {
    const data = lsLoadOrInit(uid);
    return { ref: null, data };
  }
}

async function updateAccountSummary(ref, payload) {
  if (firebaseEnabled && fb.db && ref) {
    await fb.setDoc(ref, { ...payload, updatedAt: Date.now() }, { merge: true });
  } else {
    lsUpdate(payload);
  }
}

// ==== Account/UI Rendering ====
function renderAccountUI() {
  if (!account) return;
  elAccountBalance.textContent = formatCurrency(account.balance || 0);
  elAccountPortfolio.textContent = formatCurrency(account.portfolioValue || 0);
  elAccountEquity.textContent = formatCurrency(account.equity || 0);
  elAccountUser.textContent = user?.uid || "-";

  // Holdings
  const symbols = Object.keys(account.holdings || {});
  elHoldingsTbody.innerHTML = "";
  if (!symbols.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3" style="text-align:center; opacity:0.7">No holdings yet</td>`;
    elHoldingsTbody.appendChild(tr);
  } else {
    symbols.forEach((sym) => {
      const qty = Number(account.holdings[sym]?.qty || 0);
      const mv = Number((qty * (prices[sym]?.price || 0)).toFixed(2));
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${sym}</td>
        <td>${qty}</td>
        <td>${formatCurrency(mv)}</td>
      `;
      elHoldingsTbody.appendChild(tr);
    });
  }
}

function recalcAndPersistAccount() {
  if (!account) return;
  const { portfolioValue, equity } = computePortfolioAndEquity(account.holdings || {}, prices, account.balance || 0);
  account.portfolioValue = portfolioValue;
  account.equity = equity;
  renderAccountUI();

  // Persist lightweight updates
  updateAccountSummary(account._ref || null, account).catch(() => {});
}

// ==== Auth/Login Control ====
function showLogin(show) {
  elLoginPanel.hidden = !show;
  elAccountPanel.hidden = show;
}

async function initAuth() {
  if (firebaseEnabled) {
    await initFirebaseIfEnabled();
    fb.onAuthStateChanged(fb.auth, async (u) => {
      user = u || null;
      if (user) {
        const { ref, data } = await loadOrInitAccountSummary(user.uid);
        account = { ...data, _ref: ref };
        showLogin(false);
        renderAccountUI();
        recalcAndPersistAccount();
      } else {
        account = null;
        showLogin(true);
        renderAccountUI();
      }
    });
  } else {
    // No Firebase: use local storage and a local user
    user = { uid: "local-user" };
    const { ref, data } = await loadOrInitAccountSummary(user.uid);
    account = { ...data, _ref: ref };
    showLogin(false);
    renderAccountUI();
    recalcAndPersistAccount();
  }
}

// Sign-in handlers
elBtnEmailSignin.addEventListener("click", async () => {
  if (!firebaseEnabled) {
    alert("Firebase not configured. Using local storage mode. Continue anonymously.");
    return;
  }
  try {
    const email = (elAuthEmail.value || "").trim();
    const password = (elAuthPassword.value || "").trim();
    if (!email || !password) return alert("Enter email and password.");
    await fb.signInWithEmailAndPassword(fb.auth, email, password);
  } catch (e) {
    alert(`Email sign-in failed: ${e.message}`);
  }
});

elBtnTokenSignin.addEventListener("click", async () => {
  if (!firebaseEnabled) {
    alert("Firebase not configured. Using local storage mode. Continue anonymously.");
    return;
  }
  try {
    const token = (elAuthToken.value || "").trim();
    if (!token) return alert("Enter a custom token.");
    await fb.signInWithCustomToken(fb.auth, token);
  } catch (e) {
    alert(`Custom token sign-in failed: ${e.message}`);
  }
});

elBtnAnonSignin.addEventListener("click", async () => {
  if (!firebaseEnabled) {
    // Local storage mode
    user = { uid: "local-user" };
    const { ref, data } = await loadOrInitAccountSummary(user.uid);
    account = { ...data, _ref: ref };
    showLogin(false);
    renderAccountUI();
    recalcAndPersistAccount();
    return;
  }
  try {
    await fb.signInAnonymously(fb.auth);
  } catch (e) {
    alert(`Anonymous sign-in failed: ${e.message}`);
  }
});

elBtnLogout.addEventListener("click", async () => {
  if (!firebaseEnabled) {
    // Local mode: clear local "session"
    user = null;
    account = null;
    showLogin(true);
    renderAccountUI();
    return;
  }
  try {
    await fb.signOut(fb.auth);
  } catch (e) {
    alert(`Sign out failed: ${e.message}`);
  }
});

// ==== Trade Logic ====
function renderTradeInfo() {
  const symbol = elTradeSymbol.value;
  const side = elTradeSide.value;
  const qty = clampQuantity(elTradeQty.value);
  const price = prices[symbol]?.price || 0;
  elTradePrice.textContent = formatCurrency(price);
  elTradeEstLabel.textContent = side === "BUY" ? "Cost" : "Proceeds";
  elTradeEst.textContent = formatCurrency(qty * price);
}

elTradeSymbol.addEventListener("change", renderTradeInfo);
elTradeSide.addEventListener("change", renderTradeInfo);
elTradeQty.addEventListener("input", renderTradeInfo);

elTradeExecute.addEventListener("click", async () => {
  if (!user || !account) {
    alert("Sign in to trade.");
    return;
  }
  const symbol = elTradeSymbol.value;
  const side = elTradeSide.value;
  const qty = clampQuantity(elTradeQty.value);
  if (qty <= 0) return alert("Enter a positive quantity.");
  const price = prices[symbol]?.price || 0;
  if (price <= 0) return alert("Price not available.");
  const cost = Number((qty * price).toFixed(2));

  const next = { ...account, holdings: { ...(account.holdings || {}) } };
  const currentQty = Number(next.holdings[symbol]?.qty || 0);

  if (side === "BUY") {
    if (next.balance < cost) return alert("Insufficient balance.");
    next.balance = Number((next.balance - cost).toFixed(2));
    next.holdings[symbol] = { qty: Number((currentQty + qty).toFixed(8)) };
  } else {
    if (currentQty < qty) return alert("Insufficient holdings.");
    next.balance = Number((next.balance + cost).toFixed(2));
    next.holdings[symbol] = { qty: Number((currentQty - qty).toFixed(8)) };
  }

  const { portfolioValue, equity } = computePortfolioAndEquity(next.holdings, prices, next.balance);
  next.portfolioValue = portfolioValue;
  next.equity = equity;

  try {
    await updateAccountSummary(next._ref || account._ref || null, next);
    account = next;
    renderAccountUI();
  } catch (e) {
    alert(`Trade failed to persist: ${e.message}`);
  }
});

// ==== News ====
async function loadNews() {
  const items = await fetchMarketNews(GEMINI_API_KEY);
  elNewsList.innerHTML = "";
  items.forEach((n) => {
    const li = document.createElement("li");
    li.className = "news-item";
    li.innerHTML = `<a href="${n.url}" target="_blank" rel="noreferrer">${n.title}</a> <span class="news-source">${n.source}</span>`;
    elNewsList.appendChild(li);
  });
}
let newsInterval = null;

// ==== Bootstrap ====
function bootstrap() {
  // Initial renders
  renderPrices();
  renderTradeInfo();
  startPriceSimulation();
  showPage("home");
  initAuth().catch((e) => console.warn("Auth init error:", e));
  loadNews();
  if (!newsInterval) {
    newsInterval = setInterval(loadNews, 5 * 60 * 1000);
  }

  // Candlestick ticker (under hero)
  let candleTicker = null;
  let candleCleanup = null;
  
  function initCandlestickTicker() {
    // If already running, stop and rebuild
    if (candleCleanup) {
      candleCleanup();
      candleCleanup = null;
    }
  
    const canvas = document.getElementById("candles-canvas");
    if (!canvas) return;
  
    const ctx = canvas.getContext("2d");
    const DPR = Math.max(1, Math.round(window.devicePixelRatio || 1));
    let W = 0, H = 0;
  
    const config = {
      candleWidth: 12,
      candleGap: 6,
      speedPxPerFrame: 1.5,
      maxAmplitude: 40,
      wickExtra: 10,
      baseLine: 60,
      bull: "#21c87a",
      bear: "#ff5f5f",
    };
  
    function fit() {
      // Prefer parent width; fallback to canvas rect; final fallback to window width
      const parent = canvas.parentElement;
      const parentWidth = parent ? parent.clientWidth : 0;
      const rect = canvas.getBoundingClientRect();
      W = Math.max(parentWidth, Math.floor(rect.width), window.innerWidth);
      H = Math.max(Math.floor(rect.height), 120);
  
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
  
    // Delay fitting until layout is stable
    function safeInit() {
      fit();
      if (W <= 0) {
        // Try again next frame if width is still zero
        requestAnimationFrame(safeInit);
        return;
      }
      seedCandles();
      loop();
    }
  
    window.addEventListener("resize", fit);
  
    // Candle model
    const candles = [];
    function randomWalk(prevClose) {
      const step = (Math.random() * 2 - 1) * (config.maxAmplitude * 0.25);
      const open = prevClose;
      const close = open + step;
      const high = Math.max(open, close) + Math.random() * config.wickExtra;
      const low = Math.min(open, close) - Math.random() * config.wickExtra;
      return { o: open, h: high, l: low, c: close };
    }
    function genCandle(prev) {
      const btc = prices?.BTC?.price || 65000;
      const normalized = (btc % 100) / 100;
      const baseline = config.baseLine + (normalized - 0.5) * (config.maxAmplitude * 0.5);
  
      const ohlc = randomWalk(prev?.c ?? baseline);
      const color = ohlc.c >= ohlc.o ? config.bull : config.bear;
      return { x: W + config.candleGap, ...ohlc, color };
    }
    function seedCandles() {
      candles.length = 0;
      let prev = null;
      const total = Math.ceil(W / (config.candleWidth + config.candleGap)) + 2;
      for (let i = 0; i < total; i++) {
        const c = genCandle(prev);
        c.x = i * (config.candleWidth + config.candleGap);
        candles.push(c);
        prev = c;
      }
    }
  
    let blinkPhase = 0;
  
    function draw() {
      // Background fill for visibility
      ctx.fillStyle = "rgba(31,42,68,0.85)";
      ctx.fillRect(0, 0, W, H);
  
      // Move and cull
      for (let i = 0; i < candles.length; i++) {
        candles[i].x -= config.speedPxPerFrame;
      }
      while (candles.length && candles[0].x < -config.candleWidth) {
        candles.shift();
      }
      while (candles.length < Math.ceil(W / (config.candleWidth + config.candleGap)) + 2) {
        const last = candles[candles.length - 1];
        candles.push(genCandle(last));
      }
  
      // Draw candles
      candles.forEach((c, idx) => {
        const x = c.x;
        const w = config.candleWidth;
  
        // Wick
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, c.h);
        ctx.lineTo(x + w / 2, c.l);
        ctx.stroke();
  
        // Body
        const top = Math.min(c.o, c.c);
        const bottom = Math.max(c.o, c.c);
        ctx.fillStyle = c.color;
        ctx.fillRect(x, top, w, Math.max(1, bottom - top));
  
        // Blink/glow on latest candle
        if (idx === candles.length - 1) {
          blinkPhase += 0.08;
          const glow = 0.35 + 0.25 * Math.abs(Math.sin(blinkPhase));
          ctx.shadowColor = `rgba(212,175,55,${glow})`;
          ctx.shadowBlur = 12 + 10 * glow;
          ctx.fillRect(x, top, w, Math.max(1, bottom - top));
          ctx.shadowBlur = 0;
        }
      });
    }
  
    function loop() {
      draw();
      candleTicker = requestAnimationFrame(loop);
    }
  
    // Start after layout
    requestAnimationFrame(safeInit);
  
    // Cleanup handle
    candleCleanup = () => {
      if (candleTicker) cancelAnimationFrame(candleTicker);
      window.removeEventListener("resize", fit);
      candleTicker = null;
    };
  }

  // Initialize candlestick ticker beneath hero (after layout)
  initCandlestickTicker();
}

document.addEventListener("DOMContentLoaded", bootstrap);