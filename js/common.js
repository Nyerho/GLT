export const DEFAULT_ASSETS = {
  BTC: { symbol: "BTC", price: 65000 },
  ETH: { symbol: "ETH", price: 3500 },
  GOOG: { symbol: "GOOG", price: 160 },
  TSLA: { symbol: "TSLA", price: 250 },
};

export const App = {
  currentPage: "home",
  prices: { ...DEFAULT_ASSETS },
  user: null,
  account: null,
  pricesInterval: null,
  fb: null, // firebase handles
};

export function formatCurrency(n) {
  try {
    return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  } catch {
    return `$${Number(n).toFixed(2)}`;
  }
}
export function randomWalkPrice(current) {
  const maxPctMove = 0.006;
  const deltaPct = (Math.random() * 2 - 1) * maxPctMove;
  const next = current * (1 + deltaPct);
  return Math.max(0.0001, Number(next.toFixed(2)));
}
export function clampQuantity(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Number(n.toFixed(8));
}
export function computePortfolioAndEquity(holdings, prices, balance) {
  let portfolioValue = 0;
  Object.keys(holdings || {}).forEach((sym) => {
    const qty = Number(holdings[sym]?.qty || 0);
    const price = Number(prices[sym]?.price || 0);
    portfolioValue += qty * price;
  });
  const equity = portfolioValue + Number(balance || 0);
  return { portfolioValue: Number(portfolioValue.toFixed(2)), equity: Number(equity.toFixed(2)) };
}

/* Local storage fallback */
const LS_KEY = "glt_account";
export function lsLoadOrInit(uid = "local") {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) return JSON.parse(raw);
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
export function lsUpdate(payload) {
  const next = { ...payload, updatedAt: Date.now() };
  localStorage.setItem(LS_KEY, JSON.stringify(next));
}

/* Router helpers */
function setVisible(el, visible) {
  if (!el) return;
  if (visible) el.classList.remove("d-none");
  else el.classList.add("d-none");
}
export function showPage(name) {
  App.currentPage = name;
  const pageHome = document.getElementById("page-home");
  const pageAuth = document.getElementById("page-auth");
  const pageDash = document.getElementById("page-dashboard");
  setVisible(pageHome, name === "home");
  setVisible(pageAuth, name === "auth");
  setVisible(pageDash, name === "dashboard");

  const navHome = document.getElementById("nav-home");
  const navAuth = document.getElementById("nav-auth");
  const navDash = document.getElementById("nav-dashboard");
  [navHome, navAuth, navDash].forEach((b) => b && b.classList.remove("active"));
  if (name === "home" && navHome) navHome.classList.add("active");
  if (name === "auth" && navAuth) navAuth.classList.add("active");
  if (name === "dashboard" && navDash) navDash.classList.add("active");

  try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
}