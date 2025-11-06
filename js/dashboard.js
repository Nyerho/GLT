import { App, DEFAULT_ASSETS, formatCurrency, randomWalkPrice, clampQuantity, computePortfolioAndEquity, lsLoadOrInit, lsUpdate, showPage } from "./common.js";

export function initDashboard() {
  // Route button
  document.getElementById("nav-dashboard")?.addEventListener("click", (e) => {
    e.preventDefault();
    showPage("dashboard");
  });

  // Initialize account
  const uid = App.user?.uid || "local";
  App.account = lsLoadOrInit(uid);
  renderAccount();

  // Prices
  renderPrices();
  startPriceSimulation();

  // Trade interactions
  const tradeSymbol = document.getElementById("trade-symbol");
  const tradeSide = document.getElementById("trade-side");
  const tradeQty = document.getElementById("trade-qty");
  const btnExecute = document.getElementById("trade-execute");

  tradeSymbol?.addEventListener("change", renderTradeInfo);
  tradeSide?.addEventListener("change", renderTradeInfo);
  tradeQty?.addEventListener("input", renderTradeInfo);
  btnExecute?.addEventListener("click", executeTrade);

  // Logout
  const btnLogout = document.getElementById("btn-logout");
  btnLogout?.addEventListener("click", async () => {
    try {
      if (App.fb?.auth && App.fb.signOut) {
        await App.fb.signOut(App.fb.auth);
      }
    } catch {}
    localStorage.removeItem("glt_current_user");
    App.user = null;
    document.getElementById("account-user").textContent = "-";
    alert("Logged out");
    showPage("home");
  });

  // Initial render
  renderHoldings();
  renderTradeInfo();
}

export function renderPrices() {
  const grid = document.getElementById("prices-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const symbols = Object.keys(App.prices);
  symbols.forEach((sym) => {
    const price = App.prices[sym].price;
    const col = document.createElement("div");
    col.className = "col-6 col-md-3";
    col.innerHTML = `
      <div class="price-tile card card-body bg-dark border-secondary text-center">
        <div class="price-symbol text-muted">${sym}</div>
        <div class="price-value h5">${formatCurrency(price)}</div>
      </div>
    `;
    grid.appendChild(col);
  });
}

export function startPriceSimulation() {
  if (App.pricesInterval) clearInterval(App.pricesInterval);
  App.pricesInterval = setInterval(() => {
    Object.keys(App.prices).forEach((sym) => {
      const current = App.prices[sym].price;
      App.prices[sym].price = randomWalkPrice(current);
    });
    renderPrices();
    renderTradeInfo();
    renderAccount(); // equity changes with price
  }, 2000);
}

export function renderHoldings() {
  const tbody = document.getElementById("holdings-tbody");
  if (!tbody) return;
  const holdings = App.account?.holdings || {};
  const symbols = Object.keys(holdings);
  if (!symbols.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; opacity:0.7">No holdings yet</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  symbols.forEach((sym) => {
    const qty = holdings[sym].qty || 0;
    const price = App.prices[sym]?.price || DEFAULT_ASSETS[sym]?.price || 0;
    const mv = qty * price;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${sym}</td>
      <td>${qty}</td>
      <td>${formatCurrency(mv)}</td>
    `;
    tbody.appendChild(tr);
  });
}

export function renderTradeInfo() {
  const sym = document.getElementById("trade-symbol")?.value || "BTC";
  const side = document.getElementById("trade-side")?.value || "BUY";
  const qty = clampQuantity(document.getElementById("trade-qty")?.value || 0);
  const price = App.prices[sym]?.price || DEFAULT_ASSETS[sym]?.price || 0;

  const estLabel = document.getElementById("trade-est-label");
  const est = document.getElementById("trade-est");
  const priceEl = document.getElementById("trade-price");

  estLabel.textContent = side === "BUY" ? "Cost" : "Proceeds";
  est.textContent = formatCurrency(side === "BUY" ? qty * price : qty * price);
  priceEl.textContent = formatCurrency(price);
}

export function executeTrade() {
  const sym = document.getElementById("trade-symbol")?.value || "BTC";
  const side = document.getElementById("trade-side")?.value || "BUY";
  const qty = clampQuantity(document.getElementById("trade-qty")?.value || 0);
  const price = App.prices[sym]?.price || DEFAULT_ASSETS[sym]?.price || 0;
  if (qty <= 0) return alert("Enter quantity > 0");

  const cost = qty * price;
  const acc = App.account;

  if (side === "BUY") {
    if (acc.balance < cost) return alert("Insufficient balance");
    acc.balance = Number((acc.balance - cost).toFixed(2));
    acc.holdings[sym] = { qty: Number(((acc.holdings[sym]?.qty || 0) + qty).toFixed(8)) };
  } else {
    const held = acc.holdings[sym]?.qty || 0;
    if (held < qty) return alert("Insufficient holdings");
    acc.balance = Number((acc.balance + cost).toFixed(2));
    acc.holdings[sym] = { qty: Number((held - qty).toFixed(8)) };
    if (acc.holdings[sym].qty <= 0) delete acc.holdings[sym];
  }

  const totals = computePortfolioAndEquity(acc.holdings, App.prices, acc.balance);
  acc.portfolioValue = totals.portfolioValue;
  acc.equity = totals.equity;
  lsUpdate(acc);

  renderAccount();
  renderHoldings();
  alert("Trade executed");
}

export function renderAccount() {
  const acc = App.account || { balance: 0, holdings: {} };
  const totals = computePortfolioAndEquity(acc.holdings, App.prices, acc.balance);
  acc.portfolioValue = totals.portfolioValue;
  acc.equity = totals.equity;

  document.getElementById("account-balance").textContent = formatCurrency(acc.balance);
  document.getElementById("account-portfolio").textContent = formatCurrency(acc.portfolioValue);
  document.getElementById("account-equity").textContent = formatCurrency(acc.equity);
  document.getElementById("account-user").textContent = App.user?.email || App.user?.uid || "-";
}