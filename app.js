// Vanilla JS SPA for Globalonlinetrading
// - Marketing Homepage + Trading Dashboard
// - Optional Firebase Auth/Firestore and Gemini News
// - Falls back to localStorage when Firebase config is not provided

// ==== Configuration (edit as needed) ====
// Replace with your Firebase project settings to enable cloud storage
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDwVkQ6e1XT1URi9q83iefJilTQuiHxAq0",
  authDomain: "glot-60788.firebaseapp.com",
  projectId: "glot-60788",
  appId: "1:756536891533:web:316150e36f56ba769e2ac4",
  storageBucket: "glot-60788.firebasestorage.app",
  messagingSenderId: "756536891533",
  // measurementId is optional but present in your config
  measurementId: "G-72MJV1RJL4",
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
  if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === "YOUR_FIREBASE_API_KEY") {
    return; // keep fallback when not configured
  }

  const [
    { initializeApp, getApps },
    { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, signInWithCustomToken, createUserWithEmailAndPassword },
    { getFirestore, doc, getDoc, setDoc },
  ] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
  ]);

  if (!getApps().length) {
    fb.app = initializeApp(FIREBASE_CONFIG);
  } else {
    fb.app = getApps()[0];
  }

  // Optional analytics (only if measurementId provided)
  if (FIREBASE_CONFIG.measurementId) {
    try {
      const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js");
      fb.analytics = getAnalytics(fb.app);
    } catch (e) {
      console.warn("Analytics init failed:", e);
    }
  }

  fb.auth = getAuth();
  fb.db = getFirestore();

  // Expose needed functions on fb
  fb.onAuthStateChanged = onAuthStateChanged;
  fb.signInAnonymously = signInAnonymously;
  fb.signInWithEmailAndPassword = signInWithEmailAndPassword;
  fb.signOut = signOut;
  fb.signInWithCustomToken = signInWithCustomToken;
  fb.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
  fb.doc = doc;
  fb.getDoc = getDoc;
  fb.setDoc = setDoc;

  // Wire auth state to UI
  try {
    fb.onAuthStateChanged(fb.auth, (u) => {
      user = u ? { uid: u.uid, email: u.email, anon: u.isAnonymous } : null;
      // Toggle panels
      if (elLoginPanel && elAccountPanel) {
        elLoginPanel.hidden = !!u;
        elAccountPanel.hidden = !u;
      }
      // Update account header
      if (elAccountUser) {
        elAccountUser.textContent = u ? (u.email || "Guest") : "-";
      }
    });
  } catch (e) {
    console.warn("Auth state wiring failed:", e);
  }
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
let currentPage = 'home';
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
// Router + Navigation
function getEl(id) { return document.getElementById(id); }

function setVisible(el, visible) {
  if (!el) return;
  // Support both hidden attr and Bootstrap's d-none
  el.hidden = !visible;
  if (visible) {
    el.classList.remove('d-none');
  } else {
    el.classList.add('d-none');
  }
}

function showPage(name) {
  currentPage = name;

  const pageHome = getEl('page-home');
  const pageDash = getEl('page-dashboard');
  const pageAuth = getEl('page-auth');

  setVisible(pageHome, name === 'home');
  setVisible(pageDash, name === 'dashboard');
  setVisible(pageAuth, name === 'auth');

  // Nav active states (top buttons)
  const navHome = getEl('nav-home');
  const navDashboard = getEl('nav-dashboard');
  [navHome, navDashboard].forEach((btn) => btn && btn.classList.remove('active'));
  if (name === 'home' && navHome) navHome.classList.add('active');
  if (name === 'dashboard' && navDashboard) navDashboard.classList.add('active');

  // Page lifecycle
  if (name === 'home') {
    // Start ticker under hero
    if (typeof initCandlestickTicker === 'function') {
      initCandlestickTicker();
    }
  } else {
    // Stop ticker when leaving home
    if (typeof candleCleanup === 'function') {
      candleCleanup();
    }
  }

  if (name === 'dashboard') {
    // Ensure dashboard UI renders and updates
    try {
      renderPrices?.();
      renderTradeInfo?.();
      startPriceSimulation?.();
      // Update auth panels visibility if you already have initAuth logic
      // If you want stricter gating, we can toggle login-panel/account-panel here.
    } catch (e) {
      console.warn('Dashboard init error:', e);
    }
  }

  // Scroll to top whenever switching pages
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
}

// Hook up navigation
function setupNavigation() {
  const navHome = getEl('nav-home');
  const navDashboard = getEl('nav-dashboard');

  const homeLogin = getEl('home-login');
  const homeRegister = getEl('home-register');

  const footerHome = getEl('footer-home');

  navHome && navHome.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('home');
  });

  navDashboard && navDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('dashboard');
  });

  // Hero actions route to Auth
  homeLogin && homeLogin.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('auth');
  });
  homeRegister && homeRegister.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('auth');
  });

  // Footer links (Home)
  footerHome && footerHome.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('home');
  });
}

// ==== Bootstrap ====
function bootstrap() {
  // Initial renders
  renderPrices?.();
  renderTradeInfo?.();
  startPriceSimulation?.();
  showPage('home');
  initAuth?.().catch((e) => console.warn('Auth init error:', e));
  // Initialize Firebase (if configured)
  initFirebaseIfEnabled()
    .catch((e) => console.warn('Firebase init error:', e))
    .finally(() => {
      // After Firebase init (or fallback), proceed
      renderPrices?.();
      renderTradeInfo?.();
      startPriceSimulation?.();
      showPage('home');

      loadNews?.();
      if (!window.newsInterval) {
        window.newsInterval = setInterval(() => loadNews?.(), 5 * 60 * 1000);
      }

      requestAnimationFrame(() => {
        if (typeof initCandlestickTicker === 'function') {
          initCandlestickTicker();
        }
      });

      setupNavigation();
      setupAuthPage?.();
    });
}

document.addEventListener('DOMContentLoaded', bootstrap);

// SPA logic and helpers
// === Auth: localStorage utilities ===
function getUsers() {
  try { return JSON.parse(localStorage.getItem('glt_users')) || {}; } catch { return {}; }
}
function setUsers(users) {
  localStorage.setItem('glt_users', JSON.stringify(users));
}
function setCurrentUser(user) {
  localStorage.setItem('glt_current_user', JSON.stringify(user));
}
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('glt_current_user')); } catch { return null; }
}

// Attempt Firebase if available, else fallback to localStorage
async function registerUser(email, password) {
  if (window.firebase?.auth) {
    await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = firebase.auth().currentUser;
    setCurrentUser({ uid: user?.uid, email: user?.email });
    return { ok: true, provider: 'firebase' };
  } else {
    const users = getUsers();
    if (users[email]) return { ok: false, error: 'Email already registered' };
    users[email] = { password };
    setUsers(users);
    setCurrentUser({ email });
    return { ok: true, provider: 'local' };
  }
}

async function loginUser(email, password) {
  if (window.firebase?.auth) {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    const user = firebase.auth().currentUser;
    setCurrentUser({ uid: user?.uid, email: user?.email });
    return { ok: true, provider: 'firebase' };
  } else {
    const users = getUsers();
    if (!users[email] || users[email].password !== password) {
      return { ok: false, error: 'Invalid email or password' };
    }
    setCurrentUser({ email });
    return { ok: true, provider: 'local' };
  }
}

async function loginAnonymous() {
  if (window.firebase?.auth) {
    await firebase.auth().signInAnonymously();
    const user = firebase.auth().currentUser;
    setCurrentUser({ uid: user?.uid, anon: true });
    return { ok: true, provider: 'firebase' };
  } else {
    setCurrentUser({ email: 'guest@glt.local', anon: true });
    return { ok: true, provider: 'local' };
  }
}

// === Auth page setup ===
function setupAuthPage() {
  const navAuth = document.getElementById('nav-auth');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginAnonBtn = document.getElementById('login-anon');

  const registerForm = document.getElementById('register-form');
  const registerEmail = document.getElementById('register-email');
  const registerPassword = document.getElementById('register-password');

  const backBtn = document.getElementById('auth-back-home');

  if (navAuth) {
    navAuth.addEventListener('click', (e) => {
      e.preventDefault();
      showPage('auth');
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => showPage('home'));
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginEmail.value.trim();
      const password = loginPassword.value;
      const res = await loginUser(email, password);
      if (!res.ok) {
        alert(res.error || 'Login failed');
        return;
      }
      alert('Logged in successfully');
      // Navigate to trading/dashboard if available, else home
      navigatePostAuth();
    });
  }

  if (loginAnonBtn) {
    loginAnonBtn.addEventListener('click', async () => {
      const res = await loginAnonymous();
      if (!res.ok) {
        alert(res.error || 'Guest login failed');
        return;
      }
      alert('Continuing as Guest');
      navigatePostAuth();
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = registerEmail.value.trim();
      const password = registerPassword.value;
      const res = await registerUser(email, password);
      if (!res.ok) {
        alert(res.error || 'Registration failed');
        return;
      }
      alert('Account created and logged in');
      navigatePostAuth();
    });
  }
}

// Try to go to an existing trading/dashboard section; fallback to home
function navigatePostAuth() {
  try {
    // If your app already has a dashboard/trading page id, this will route correctly.
    const candidates = ['trading', 'dashboard', 'page-trading', 'page-dashboard'];
    for (const key of candidates) {
      try { showPage(key); return; } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  showPage('home');
}